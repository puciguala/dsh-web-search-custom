import assert from "node:assert/strict";
import { mock } from "node:test";
import { CustomSearchProvider } from "../../lib/index.js";

// These doubles model the public Host contracts, not the old standalone
// endpoint/apiKey settings: describe() is synchronous, resolve() returns a
// credential record, and resolveCallConfig() resolves the selected model.
export function runtime(overrides = {}) {
  const state = {
    config: {
      enabled: "on", provider: "custom", modelProvider: "selected", model: "search-model",
      reasoningEffort: "", searchTool: "web_search"
    },
    profiles: {
      selected: { baseURL: "https://selected.example/v1", apiKeyEnv: "TEST_SEARCH_SELECTED_KEY", headers: { "x-project": "configured-project" } },
      conversation: { baseURL: "https://conversation.example/v1", apiKeyEnv: "TEST_SEARCH_CONVERSATION_KEY" },
      fallback: { baseURL: "https://fallback.example/v1", apiKeyEnv: "TEST_SEARCH_FALLBACK_KEY" }
    },
    credentials: {
      TEST_SEARCH_SELECTED_KEY: "selected-secret",
      TEST_SEARCH_CONVERSATION_KEY: "conversation-secret",
      TEST_SEARCH_FALLBACK_KEY: "fallback-secret"
    },
    directory: ["selected", "conversation", "fallback"].map((provider) => ({
      provider, displayName: provider, settingsNs: "llm-pi-ai", settingsPath: ["providers", provider],
      nativeAuth: { env: [], oauth: false }
    })),
    request: { provider: "conversation", model: "conversation-model", reasoningEffort: "high" },
    defaultSelection: { provider: "fallback", model: "fallback-model", reasoningEffort: "low" },
    settingsNs: "llm-pi-ai",
    defaultEffort: undefined,
    ...overrides
  };
  const describe = mock.fn(() => [{ ns: state.settingsNs, value: { providers: state.profiles }, user: {}, revision: 1, applies: "live" }]);
  const listConfigurableProviders = mock.fn(() => state.directory);
  const resolveCallConfig = mock.fn(async (selection) => ({
    ...selection,
    ...(selection.reasoningEffort === undefined && state.defaultEffort !== undefined ? { reasoningEffort: state.defaultEffort } : {})
  }));
  const resolve = mock.fn(async (ref) => {
    assert.equal(typeof ref, "string");
    const value = state.credentials[ref];
    return value === undefined ? undefined : { value, source: "settings" };
  });
  const currentSelection = mock.fn(() => state.defaultSelection);
  const requestContext = mock.fn(() => state.request);
  const services = {
    agents: { currentInitiator: () => ({ session: { requestContext } }) },
    agentDefaultModel: { currentSelection }
  };
  const ctx = {
    settings: { describe },
    llm: { listConfigurableProviders, resolveCallConfig },
    credentials: { resolve },
    get: (key) => services[key]
  };
  const liveConfig = Object.fromEntries(Object.keys(state.config).map((field) => [field, { get: () => state.config[field] }]));
  const provider = new CustomSearchProvider(() => ({ ...liveConfig, ctx }));
  return { state, provider, ctx, services, describe, listConfigurableProviders, resolveCallConfig, resolve, currentSelection, requestContext };
}

export function captureFetch(t, implementation) {
  return t.mock.method(globalThis, "fetch", implementation ?? (async () => Response.json({ output_text: "Search result", sources: [{ url: "https://source.example/", title: "Source" }] })));
}

export function requestAt(fetch, index = 0) {
  const [url, options] = fetch.mock.calls[index].arguments;
  return { url: String(url), ...options, body: JSON.parse(options.body) };
}

export const query = { query: "test search query" };
