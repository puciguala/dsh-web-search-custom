import assert from "node:assert/strict";
import test from "node:test";
import { runtime, captureFetch, requestAt, query } from "./helpers/runtime.js";

test("current uses the initiating request's provider, model and effort before the default", async (t) => {
  const fixture = runtime();
  fixture.state.config.provider = "current";
  const fetch = captureFetch(t);
  assert.equal(fixture.provider.available(), true);
  await fixture.provider.search(query);
  const sent = requestAt(fetch);
  assert.equal(sent.url, "https://conversation.example/v1/responses");
  assert.equal(sent.body.model, "conversation-model");
  assert.deepEqual(sent.body.reasoning, { effort: "high" });
  assert.equal(sent.headers.get("authorization"), "Bearer conversation-secret");
  assert.equal(fixture.currentSelection.mock.callCount(), 0);
  assert.deepEqual(fixture.resolveCallConfig.mock.calls[0].arguments[0], fixture.state.request);
});

test("current falls back to agentDefaultModel only when requestContext has no complete selection", async (t) => {
  const fixture = runtime({ request: { provider: "conversation" } });
  fixture.state.config.provider = "current";
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  assert.equal(requestAt(fetch).body.model, "fallback-model");
  assert.equal(requestAt(fetch).url, "https://fallback.example/v1/responses");
  assert.equal(fixture.currentSelection.mock.callCount(), 1);
});

test("current also works outside an initiating agent session", async (t) => {
  const fixture = runtime();
  fixture.state.config.provider = "current";
  delete fixture.services.agents;
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  assert.equal(requestAt(fetch).body.model, "fallback-model");
});

test("custom keeps the fixed selection and reuses its baseURL, credential reference and headers", async (t) => {
  const fixture = runtime();
  fixture.state.config.reasoningEffort = "medium";
  fixture.state.config.searchTool = "web_search_preview";
  const fetch = captureFetch(t);
  const result = await fixture.provider.search(query);
  const sent = requestAt(fetch);
  assert.equal(sent.url, "https://selected.example/v1/responses");
  assert.equal(sent.method, "POST");
  assert.equal(sent.redirect, "error");
  assert.equal(sent.headers.get("authorization"), "Bearer selected-secret");
  assert.equal(sent.headers.get("x-project"), "configured-project");
  assert.equal(sent.headers.get("content-type"), "application/json");
  assert.equal(sent.headers.get("accept"), "application/json");
  assert.deepEqual(sent.body, {
    model: "search-model", tools: [{ type: "web_search_preview" }], tool_choice: "required",
    include: ["web_search_call.action.sources"], input: "Perform a web search for the query: test search query",
    reasoning: { effort: "medium" }
  });
  assert.deepEqual(result, { content: "Search result", sources: [{ url: "https://source.example/", title: "Source" }], truncated: false });
  assert.equal(fixture.requestContext.mock.callCount(), 0);
  assert.equal(fixture.currentSelection.mock.callCount(), 0);
  assert.deepEqual(fixture.resolve.mock.calls.map((call) => call.arguments), [["TEST_SEARCH_SELECTED_KEY"]]);
  assert.ok(fixture.describe.mock.callCount() > 0);
  assert.ok(fixture.listConfigurableProviders.mock.callCount() > 0);
});

test("credentials are resolved again for every search so rotation reaches the next request", async (t) => {
  const fixture = runtime();
  const fetch = captureFetch(t);
  assert.equal(fixture.provider.available(), true);
  assert.equal(fixture.resolve.mock.callCount(), 0, "synchronous availability must not start credential I/O");
  await fixture.provider.search(query);
  fixture.state.credentials.TEST_SEARCH_SELECTED_KEY = "rotated-secret";
  await fixture.provider.search(query);
  assert.equal(requestAt(fetch, 0).headers.get("authorization"), "Bearer selected-secret");
  assert.equal(requestAt(fetch, 1).headers.get("authorization"), "Bearer rotated-secret");
  assert.equal(fixture.resolve.mock.callCount(), 2);
});

test("changed plugin fields and Models connection settings apply to the next request", async (t) => {
  const fixture = runtime();
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  Object.assign(fixture.state.config, { modelProvider: "conversation", model: "replacement-model", reasoningEffort: "low", searchTool: "web_search_preview" });
  fixture.state.profiles.conversation = {
    baseURL: "https://updated.example/api/", apiKeyEnv: "TEST_SEARCH_NEW_KEY", headers: { "x-version": "2" }
  };
  fixture.state.credentials.TEST_SEARCH_NEW_KEY = "new-secret";
  await fixture.provider.search(query);
  const sent = requestAt(fetch, 1);
  assert.equal(sent.url, "https://updated.example/api/responses");
  assert.equal(sent.body.model, "replacement-model");
  assert.deepEqual(sent.body.reasoning, { effort: "low" });
  assert.deepEqual(sent.body.tools, [{ type: "web_search_preview" }]);
  assert.equal(sent.headers.get("x-version"), "2");
  assert.equal(sent.headers.get("authorization"), "Bearer new-secret");
});

test("resolved settings values are used for both namespace spellings, rather than user-only overrides", async (t) => {
  const fixture = runtime({ settingsNs: "include:llm-pi-ai" });
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  assert.equal(requestAt(fetch).url, "https://selected.example/v1/responses");
});

test("model reasoning mapping converts the effort returned by resolveCallConfig", async (t) => {
  const fixture = runtime({ defaultEffort: "high" });
  fixture.state.profiles.selected.models = [{ id: "other-model", reasoningEfforts: { high: "wrong" } }, { id: "search-model", reasoningEfforts: { high: "max" } }];
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  assert.deepEqual(fixture.resolveCallConfig.mock.calls[0].arguments[0], { provider: "selected", model: "search-model" });
  assert.deepEqual(requestAt(fetch).body.reasoning, { effort: "max" });
});

test("a null reasoning mapping omits the entire reasoning field", async (t) => {
  const fixture = runtime();
  fixture.state.config.reasoningEffort = "off";
  fixture.state.profiles.selected.models = [{ id: "search-model", reasoningEfforts: { off: null } }];
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  assert.equal(Object.hasOwn(requestAt(fetch).body, "reasoning"), false);
});

test("an absent resolved reasoning effort is omitted from the request", async (t) => {
  const fixture = runtime();
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  assert.equal(Object.hasOwn(requestAt(fetch).body, "reasoning"), false);
});

test("invalid explicit reasoning is rejected by resolveCallConfig before HTTP", async (t) => {
  const fixture = runtime();
  fixture.state.config.reasoningEffort = "unsupported";
  const failure = Object.assign(new Error("Unsupported explicit effort"), { code: "INVALID_REASONING_EFFORT" });
  t.mock.method(fixture.ctx.llm, "resolveCallConfig", async () => { throw failure; });
  const fetch = captureFetch(t);
  await assert.rejects(fixture.provider.search(query), (error) => error === failure);
  assert.equal(fetch.mock.callCount(), 0);
});

for (const mode of ["current", "custom"]) {
  test(`${mode}: missing selected provider never silently falls back to the default`, async (t) => {
    const fixture = runtime();
    fixture.state.config.provider = mode;
    delete fixture.state.profiles[mode === "current" ? "conversation" : "selected"];
    const fetch = captureFetch(t);
    assert.equal(fixture.provider.available(), false);
    await assert.rejects(fixture.provider.search(query), { code: "WEB_PROVIDER_UNAVAILABLE" });
    assert.equal(fetch.mock.callCount(), 0);
    assert.equal(fixture.currentSelection.mock.callCount(), 0);
  });
}

test("disabled provider performs no metadata, credential or HTTP request", async (t) => {
  const fixture = runtime();
  fixture.state.config.enabled = "off";
  const fetch = captureFetch(t);
  assert.equal(fixture.provider.available(), false);
  await assert.rejects(fixture.provider.search(query), { code: "WEB_PROVIDER_UNAVAILABLE" });
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(fixture.describe.mock.callCount(), 0);
  assert.equal(fixture.resolve.mock.callCount(), 0);
  assert.equal(fixture.resolveCallConfig.mock.callCount(), 0);
});

test("an explicit missing credential never falls through to a different provider or native credential", async (t) => {
  const fixture = runtime();
  delete fixture.state.credentials.TEST_SEARCH_SELECTED_KEY;
  fixture.state.directory[0].nativeAuth.env = ["TEST_SEARCH_NATIVE_KEY"];
  fixture.state.credentials.TEST_SEARCH_NATIVE_KEY = "must-not-use";
  const fetch = captureFetch(t);
  await assert.rejects(fixture.provider.search(query), { code: "WEB_PROVIDER_CREDENTIAL_MISSING" });
  assert.deepEqual(fixture.resolve.mock.calls.map((call) => call.arguments[0]), ["TEST_SEARCH_SELECTED_KEY"]);
  assert.equal(fetch.mock.callCount(), 0);
});

test("native provider metadata supplies credential references when a profile has none", async (t) => {
  const fixture = runtime();
  delete fixture.state.profiles.selected.apiKeyEnv;
  fixture.state.directory[0].nativeAuth.env = ["TEST_SEARCH_ABSENT_NATIVE_KEY", "TEST_SEARCH_NATIVE_KEY"];
  fixture.state.credentials.TEST_SEARCH_NATIVE_KEY = "native-secret";
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  assert.equal(requestAt(fetch).headers.get("authorization"), "Bearer native-secret");
  assert.deepEqual(fixture.resolve.mock.calls.map((call) => call.arguments[0]), ["TEST_SEARCH_ABSENT_NATIVE_KEY", "TEST_SEARCH_NATIVE_KEY"]);
});

test("unmapped off effort uses the Responses none spelling", async (t) => {
  const fixture = runtime();
  fixture.state.config.reasoningEffort = "off";
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  assert.deepEqual(requestAt(fetch).body.reasoning, { effort: "none" });
});

test("current follows the matching request header's reasoning effort", async (t) => {
  const fixture = runtime();
  fixture.state.config.provider = "current";
  fixture.services.agents.currentInitiator = () => ({ session: {
    requestContext: fixture.requestContext,
    requestHeader: () => ({ config: { provider: "conversation", model: "conversation-model", reasoningEffort: "low" } })
  } });
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  assert.deepEqual(requestAt(fetch).body.reasoning, { effort: "low" });
});

test("a request header for a different model cannot replace the caller's reasoning", async (t) => {
  const fixture = runtime();
  fixture.state.config.provider = "current";
  fixture.services.agents.currentInitiator = () => ({ session: {
    requestContext: fixture.requestContext,
    requestHeader: () => ({ config: { provider: "fallback", model: "fallback-model", reasoningEffort: "low" } })
  } });
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  assert.deepEqual(requestAt(fetch).body.reasoning, { effort: "high" });
});

test("provider authorization headers support connections without a bearer key", async (t) => {
  const fixture = runtime();
  delete fixture.state.profiles.selected.apiKeyEnv;
  fixture.state.profiles.selected.headers.authorization = "Custom header-secret";
  const fetch = captureFetch(t);
  await fixture.provider.search(query);
  assert.equal(requestAt(fetch).headers.get("authorization"), "Custom header-secret");
});
