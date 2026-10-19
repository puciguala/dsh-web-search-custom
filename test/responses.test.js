import assert from "node:assert/strict";
import test from "node:test";
import { parseResponsesSearch } from "../lib/index.js";

test("parses citations, action sources/results, item sources and root sources in encounter order", () => {
  const result = parseResponsesSearch({
    output: [
      { type: "message", content: [
        { type: "output_text", text: "First answer", annotations: [
          { type: "url_citation", url: "https://citation.example/", title: " Citation ", cited_text: " cited excerpt " },
          { type: "other", url: "https://ignored.example/" }
        ] },
        { type: "text", text: ["Second", { type: "text", text: "answer" }, { type: "image", text: "ignored" }] }
      ] },
      { type: "web_search_call", action: {
        sources: [{ url: "https://action.example/", title: "Action", snippet: "Snippet", published_at: "2026-10-01" }],
        results: [{ link: "https://result.example/", name: "Result", description: "Description", page_age: "2026-10-02" }]
      }, sources: [{ url: "https://item.example/", publishedAt: "2026-10-03" }] },
      { type: "other", sources: [{ url: "https://other.example/" }] }
    ],
    sources: [{ url: "https://root.example/", title: "Root" }]
  });
  assert.deepEqual(result, {
    content: "First answer\nSecond\nanswer",
    sources: [
      { url: "https://citation.example/", title: "Citation", snippet: "cited excerpt" },
      { url: "https://action.example/", title: "Action", snippet: "Snippet", publishedAt: "2026-10-01" },
      { url: "https://item.example/", publishedAt: "2026-10-03" },
      { url: "https://result.example/", title: "Result", snippet: "Description", publishedAt: "2026-10-02" },
      { url: "https://other.example/" },
      { url: "https://root.example/", title: "Root" }
    ],
    truncated: false
  });
});

test("source URLs are validated and deduplicated while keeping the first source metadata", () => {
  const result = parseResponsesSearch({
    output_text: " Answer ",
    sources: [null, "not an object", {}, { url: "invalid" }, { url: "/relative" },
      { url: " https://source.example/ ", title: " First " },
      { link: "https://source.example/", name: "Duplicate", snippet: "not merged" },
      { link: "https://second.example/", name: " Second ", description: " excerpt " }]
  });
  assert.deepEqual(result, { content: "Answer", sources: [
    { url: "https://source.example/", title: "First" },
    { url: "https://second.example/", title: "Second", snippet: "excerpt" }
  ], truncated: false });
});

test("top-level output_text wins over message text", () => {
  assert.deepEqual(parseResponsesSearch({ output_text: " Preferred ", output: [{ type: "message", content: [{ type: "output_text", text: "Other" }] }] }), {
    content: "Preferred", sources: [], truncated: false
  });
});

test("sources-only and content-only responses are accepted", () => {
  assert.deepEqual(parseResponsesSearch({ sources: [{ url: "https://source.example/" }] }), {
    sources: [{ url: "https://source.example/" }], truncated: false
  });
  assert.deepEqual(parseResponsesSearch({ output_text: "Search summary" }), {
    content: "Search summary", sources: [], truncated: false
  });
});

for (const response of [undefined, null, {}, { output: [] }, { output: [null, 3, "text", { type: "message", content: null }] }, { output_text: "   ", sources: [{ url: "bad" }] }]) {
  test(`rejects responses with neither usable text nor sources: ${JSON.stringify(response)}`, () => {
    assert.throws(() => parseResponsesSearch(response), { code: "WEB_PROVIDER_ERROR" });
  });
}
