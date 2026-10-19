import assert from "node:assert/strict";
import test from "node:test";
import { runtime, captureFetch, requestAt, query } from "./helpers/runtime.js";

for (const [baseURL, endpoint] of [
  ["https://api.example", "https://api.example/responses"],
  ["https://api.example/v1/", "https://api.example/v1/responses"],
  ["https://api.example/v1///", "https://api.example/v1/responses"],
  ["https://api.example/v1/responses", "https://api.example/v1/responses"],
  ["https://api.example/v1/responses/", "https://api.example/v1/responses"],
  ["https://api.example/v1/chat/completions/", "https://api.example/v1/responses"],
  ["https://api.example/custom/root?tenant=a#fragment", "https://api.example/custom/root/responses?tenant=a"],
  ["http://127.0.0.1:8080/v1", "http://127.0.0.1:8080/v1/responses"]
]) {
  test(`endpoint normalization: ${baseURL}`, async (t) => {
    const fixture = runtime();
    fixture.state.profiles.selected.baseURL = baseURL;
    const fetch = captureFetch(t);
    assert.equal(fixture.provider.available(), true);
    await fixture.provider.search(query);
    assert.equal(requestAt(fetch).url, endpoint);
  });
}

for (const baseURL of ["not a URL", "file:///private/key", "ftp://api.example", "https://user:password@api.example/v1", ""]) {
  test(`invalid endpoint is unavailable and never sent: ${baseURL}`, async (t) => {
    const fixture = runtime();
    fixture.state.profiles.selected.baseURL = baseURL;
    const fetch = captureFetch(t);
    assert.equal(fixture.provider.available(), false);
    await assert.rejects(fixture.provider.search(query), { code: "WEB_PROVIDER_UNAVAILABLE" });
    assert.equal(fetch.mock.callCount(), 0);
  });
}

test("directory defaultBaseURL is used only when a profile has no explicit endpoint", async (t) => {
  const fixture = runtime();
  delete fixture.state.profiles.selected.baseURL;
  fixture.state.directory[0].defaultBaseURL = "https://metadata.example/v1";
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  assert.equal(requestAt(fetch).url, "https://metadata.example/v1/responses");
});

test("provider baseURLEnv metadata is read live and loses to an explicit baseURL", async (t) => {
  const fixture = runtime();
  const ref = "TEST_WEB_SEARCH_CUSTOM_BASE_URL";
  const previous = process.env[ref];
  process.env[ref] = "https://environment.example/api";
  t.after(() => { if (previous === undefined) delete process.env[ref]; else process.env[ref] = previous; });
  delete fixture.state.profiles.selected.baseURL;
  fixture.state.directory[0].baseURLEnv = [ref];
  fixture.state.directory[0].defaultBaseURL = "https://default.example/v1";
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  fixture.state.profiles.selected.baseURL = "https://explicit.example/v1";
  await fixture.provider.search(query);
  assert.equal(requestAt(fetch, 0).url, "https://environment.example/api/responses");
  assert.equal(requestAt(fetch, 1).url, "https://explicit.example/v1/responses");
});

test("a pre-aborted signal prevents all resolution and HTTP work", async (t) => {
  const fixture = runtime();
  const controller = new AbortController();
  const reason = new Error("cancel search");
  controller.abort(reason);
  const fetch = captureFetch(t);
  await assert.rejects(fixture.provider.search(query, controller.signal), (error) => error.code === "WEB_ABORTED" && error.cause === reason);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(fixture.resolve.mock.callCount(), 0);
  assert.equal(fixture.resolveCallConfig.mock.callCount(), 0);
});

test("abort is forwarded to fetch and translated to WEB_ABORTED", async (t) => {
  const fixture = runtime();
  const controller = new AbortController();
  const fetch = captureFetch(t, async (_url, options) => {
    assert.equal(options.signal, controller.signal);
    controller.abort("cancelled while fetching");
    throw new DOMException("fetch aborted", "AbortError");
  });
  await assert.rejects(fixture.provider.search(query, controller.signal), { code: "WEB_ABORTED" });
  assert.equal(fetch.mock.callCount(), 1);
});

test("abort while reading the response body is translated to WEB_ABORTED", async (t) => {
  const fixture = runtime();
  const controller = new AbortController();
  captureFetch(t, async () => ({ ok: true, json: async () => {
    controller.abort("cancelled while reading");
    throw new DOMException("body aborted", "AbortError");
  } }));
  await assert.rejects(fixture.provider.search(query, controller.signal), { code: "WEB_ABORTED" });
});

test("a fetch AbortError remains an abort even without an explicit signal", async (t) => {
  const fixture = runtime();
  captureFetch(t, async () => { throw new DOMException("upstream cancelled", "AbortError"); });
  await assert.rejects(fixture.provider.search(query), { code: "WEB_ABORTED" });
});

for (const status of [401, 429, 500]) {
  test(`HTTP ${status} cancels its body and reports a sanitized provider error`, async (t) => {
    const fixture = runtime();
    fixture.state.profiles.selected.baseURL = "https://api.example/v1?secret=query-secret";
    const cancel = t.mock.fn(async () => {});
    const json = t.mock.fn(async () => ({ error: { message: "do not expose upstream-secret" } }));
    captureFetch(t, async () => ({ ok: false, status, body: { cancel }, json }));
    await assert.rejects(fixture.provider.search(query), (error) => {
      assert.equal(error.code, "WEB_PROVIDER_ERROR");
      assert.match(error.message, new RegExp(`HTTP ${status}`));
      assert.match(error.message, /Settings/);
      assert.doesNotMatch(error.message, /query-secret|selected-secret|upstream-secret|api\.example/);
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(cancel.mock.callCount(), 1);
    assert.equal(json.mock.callCount(), 0);
  });
}

test("network errors do not expose upstream details, secrets or endpoint query strings", async (t) => {
  const fixture = runtime();
  fixture.state.profiles.selected.baseURL = "https://api.example/v1?token=query-secret";
  captureFetch(t, async () => { throw new Error("network upstream-secret selected-secret"); });
  await assert.rejects(fixture.provider.search(query), (error) => {
    assert.equal(error.code, "WEB_PROVIDER_ERROR");
    assert.doesNotMatch(error.message, /upstream-secret|selected-secret|query-secret|api\.example/);
    assert.equal(error.cause, undefined);
    return true;
  });
});

test("malformed JSON is reported as an unprocessable provider response", async (t) => {
  const fixture = runtime();
  captureFetch(t, async () => new Response("not-json upstream-secret", { status: 200 }));
  await assert.rejects(fixture.provider.search(query), (error) => {
    assert.equal(error.code, "WEB_PROVIDER_ERROR");
    assert.match(error.message, /unprocessable response/);
    assert.doesNotMatch(error.message, /upstream-secret/);
    return true;
  });
});

test("an empty successful response is still a provider error", async (t) => {
  const fixture = runtime();
  captureFetch(t, async () => Response.json({ output: [] }));
  await assert.rejects(fixture.provider.search(query), { code: "WEB_PROVIDER_ERROR" });
});
