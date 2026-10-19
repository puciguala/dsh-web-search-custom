import z from "@deepseek-ai/schemastery";

class WebError extends Error {
  constructor(message, code, options) {
    super(message, options);
    this.name = "WebError";
    this.code = code;
  }
}

const name = "dsh-web-search-custom";
const inject = ["web", "configEditor", "agentDefaultModel", "llm", "settings", "credentials"];
const PROVIDER_ID = "dsh-web-search-custom";
const SETTINGS_NS = "dsh-web-search-custom";
const DEFAULT_TOOL = "web_search";

// Only references are stored; connection details belong to Models settings.
const Config = z.object({
  enabled: z.union([z.const("off"), z.const("on")]).default("off").volatile(),
  provider: z.union([z.const("current"), z.const("custom")]).default("current").volatile(),
  modelProvider: z.string().default("").volatile(),
  model: z.string().default("").volatile(),
  reasoningEffort: z.string().default("").volatile(),
  // Migration-only: accepting these fields lets Settings unset 0.1.x overrides.
  // They are never used to construct a search request or rendered as inputs.
  endpoint: z.string().default("").volatile(),
  apiKeyEnv: z.string().role("credential-ref").default("").volatile(),
  searchTool: z.union([z.const("web_search"), z.const("web_search_preview")]).default(DEFAULT_TOOL).volatile()
});

function isEnabled(value) {
  return value === true || value === "on" || value === "true";
}

function readConfigValue(value) {
  return value !== undefined && typeof value.get === "function" ? value.get() : value;
}

const DEFAULT_SEARCH_PROVIDER = "deepseek-official";

function syncWebProvider(ctx, enabled) {
  const editor = ctx.get("configEditor");
  if (editor === undefined || typeof editor.configuration !== "function" || typeof editor.edit !== "function") return;
  try {
    const target = editor.configuration().find((item) => {
      const entry = item.entry;
      const id = entry?.options?.id ?? entry?.id ?? entry?.patchId;
      const name = entry?.options?.name ?? entry?.name;
      return id === "web" || id === "include:web" || name === "@deepseek-ai/dsh-web";
    });
    if (target === undefined) return;
    const inherited = target.inherited ?? {};
    const override = target.override ?? {};
    const effective = { ...inherited, ...override };
    const desired = enabled ? PROVIDER_ID : DEFAULT_SEARCH_PROVIDER;
    const fetchProvider = effective.fetchProvider ?? "http";
    const missingFetch = Object.hasOwn(override, "searchProvider") && !Object.hasOwn(override, "fetchProvider");
    if (effective.searchProvider === desired && !missingFetch) return;
    void editor.edit(target.entry, (current, base) => ({
      ...current,
      searchProvider: desired,
      fetchProvider: current.fetchProvider ?? base.fetchProvider ?? fetchProvider
    })).catch((error) => {
      console.warn("dsh-web-search-custom: failed to update web providers", error);
    });
  } catch {
    // Config editor is optional in headless compositions.
  }
}

function configValue(config, key) {
  return readConfigValue(config[key]);
}

function isCustom(value) {
  return value === "custom";
}

function positiveString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function endpointFor(value) {
  const raw = positiveString(value);
  if (raw === undefined || !URL.canParse(raw)) return undefined;
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined;
  let path = url.pathname.replace(/\/+$/u, "");
  // Both a provider API root and a full OpenAI endpoint are accepted.
  path = path.replace(/\/(?:responses|chat\/completions)$/u, "");
  url.pathname = `${path}/responses`;
  url.hash = "";
  return url.toString();
}

function currentModelSelection(ctx) {
  const session = ctx.get("agents")?.currentInitiator()?.session;
  const request = session?.requestContext?.();
  if (positiveString(request?.provider) && positiveString(request?.model)) {
    const call = session?.requestHeader?.()?.config;
    return call?.provider === request.provider && call?.model === request.model
      ? { ...request, reasoningEffort: call.reasoningEffort }
      : request;
  }
  return ctx.get("agentDefaultModel")?.currentSelection?.();
}

function providerProfiles(ctx) {
  // Read resolved Config values, including inherited layers and !!js values.
  const sections = ctx.settings.describe();
  const section = sections.find((item) => item.ns === "llm-pi-ai" || item.ns === "include:llm-pi-ai");
  return section?.value?.providers ?? {};
}

function providerDirectory(ctx, provider) {
  return ctx.llm.listConfigurableProviders().find((item) => item.provider === provider && item.settingsNs === "llm-pi-ai");
}

function selectedRoute(ctx, config) {
  if (!isEnabled(configValue(config, "enabled"))) return undefined;
  const custom = isCustom(configValue(config, "provider"));
  const selection = custom
    ? { provider: configValue(config, "modelProvider"), model: configValue(config, "model"), reasoningEffort: configValue(config, "reasoningEffort") }
    : currentModelSelection(ctx);
  const provider = positiveString(selection?.provider);
  const model = positiveString(selection?.model);
  if (!provider || !model) return undefined;
  const profile = providerProfiles(ctx)[provider];
  if (!profile) return undefined;
  const directory = providerDirectory(ctx, provider);
  const ambientBase = directory?.baseURLEnv?.map((ref) => process.env[ref]).find(positiveString);
  const endpoint = endpointFor(profile.baseURL ?? ambientBase ?? directory?.defaultBaseURL);
  return { provider, model, profile, directory, endpoint, reasoningEffort: positiveString(selection?.reasoningEffort) };
}

async function resolveCredential(ctx, ref) {
  if (!positiveString(ref)) return undefined;
  const resolved = await ctx.credentials.resolve(ref);
  return positiveString(resolved?.value) ?? positiveString(process.env[ref]);
}

async function resolveOptions(ctx, config) {
  const route = selectedRoute(ctx, config);
  if (!route) return undefined;
  const { profile, directory, provider, model } = route;
  let apiKey;
  if (profile.apiKeyEnv) {
    // An explicit missing reference must never fall through to another key.
    apiKey = await resolveCredential(ctx, profile.apiKeyEnv);
  } else {
    for (const ref of directory?.nativeAuth?.env ?? []) {
      apiKey = await resolveCredential(ctx, ref);
      if (apiKey) break;
    }
  }
  const resolved = await ctx.llm.resolveCallConfig({ provider, model, ...(route.reasoningEffort ? { reasoningEffort: route.reasoningEffort } : {}) });
  const effort = resolved.reasoningEffort;
  const modelConfig = profile.models?.find((item) => item.id === model) ?? profile.modelOverrides?.[model];
  const mapping = modelConfig?.reasoningEfforts;
  const wireEffort = effort && mapping && typeof mapping === "object" && Object.hasOwn(mapping, effort)
    ? mapping[effort]
    : effort === "off" ? "none" : effort;
  return {
    ...route,
    apiKey,
    headers: profile.headers ?? {},
    tool: positiveString(configValue(config, "searchTool")) ?? DEFAULT_TOOL,
    wireEffort: positiveString(wireEffort),
    keyRef: profile.apiKeyEnv
  };
}

function collectText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (part?.type === "output_text" || part?.type === "text") return typeof part.text === "string" ? part.text : "";
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function addSource(sources, source) {
  if (!source || typeof source !== "object") return;
  const url = positiveString(source.url ?? source.link);
  if (url === undefined || !URL.canParse(url) || sources.some((item) => item.url === url)) return;
  const title = positiveString(source.title ?? source.name);
  const snippet = positiveString(source.snippet ?? source.description ?? source.cited_text);
  const publishedAt = positiveString(source.publishedAt ?? source.published_at ?? source.page_age);
  sources.push({
    url,
    ...(title ? { title } : {}),
    ...(snippet ? { snippet } : {}),
    ...(publishedAt ? { publishedAt } : {})
  });
}

function parseResponsesSearch(response) {
  const sources = [];
  const texts = [];
  const output = Array.isArray(response?.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    if (item.type === "message") {
      const content = Array.isArray(item.content) ? item.content : [];
      for (const part of content) {
        if (part?.type === "output_text" || part?.type === "text") {
          const text = collectText(part.text);
          if (text) texts.push(text);
          for (const annotation of part.annotations ?? []) {
            if (annotation?.type === "url_citation") addSource(sources, annotation);
          }
        }
      }
    }
    if (item.type === "web_search_call") {
      const action = item.action;
      for (const source of action?.sources ?? []) addSource(sources, source);
      for (const source of item.sources ?? []) addSource(sources, source);
      for (const result of action?.results ?? []) addSource(sources, result);
    }
    for (const source of item.sources ?? []) addSource(sources, source);
  }
  for (const source of response?.sources ?? []) addSource(sources, source);
  const content = positiveString(response?.output_text) ?? positiveString(texts.join("\n"));
  if (sources.length === 0 && !content) {
    throw new WebError("OpenAI Responses returned no web search sources", "WEB_PROVIDER_ERROR");
  }
  return { ...(content ? { content } : {}), sources, truncated: false };
}

function providerError(endpoint, message, cause) {
  // Do not echo endpoint query strings or upstream messages, which may contain secrets.
  return new WebError(`${message} Check the selected provider and model under Settings > web-search, and connection settings under Settings > Models.`, "WEB_PROVIDER_ERROR");
}

function abortError(signal, cause) {
  return new WebError("Custom web search aborted", "WEB_ABORTED", { cause: signal?.reason });
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError(signal);
}

class CustomSearchProvider {
  id = PROVIDER_ID;
  constructor(resolve) {
    this.resolve = resolve;
  }
  available() {
    // Availability is intentionally synchronous. The async credential is
    // checked again in search(), so key rotation reaches the next call.
    const config = this.resolve();
    const route = selectedRoute(config.ctx, config);
    return route?.endpoint !== undefined;
  }
  async search(request, signal) {
    throwIfAborted(signal);
    const config = this.resolve();
    const options = await resolveOptions(config.ctx, config);
    if (options === undefined || options.endpoint === undefined || options.model === undefined) {
      throw new WebError("Custom web search is enabled but its endpoint or model is not configured", "WEB_PROVIDER_UNAVAILABLE");
    }
    const apiKey = options.apiKey;
    const headers = new Headers(options.headers);
    if (apiKey) headers.set("authorization", `Bearer ${apiKey}`);
    if (!headers.has("authorization") && options.keyRef) {
      throw new WebError(`No API key is configured for provider ${options.provider}; check its credential in Settings > Models.`, "WEB_PROVIDER_CREDENTIAL_MISSING");
    }
    headers.set("content-type", "application/json");
    headers.set("accept", "application/json");
    const body = {
      model: options.model,
      tools: [{ type: options.tool }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      input: `Perform a web search for the query: ${request.query}`,
      ...(options.wireEffort ? { reasoning: { effort: options.wireEffort } } : {})
    };
    let response;
    try {
      response = await fetch(options.endpoint, {
        method: "POST",
        redirect: "error",
        headers,
        body: JSON.stringify(body),
        ...(signal ? { signal } : {})
      });
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw abortError(signal, error);
      throw providerError(options.endpoint, "OpenAI Responses request failed.");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw providerError(options.endpoint, `OpenAI Responses API error (HTTP ${response.status}).`);
    }
    try {
      return parseResponsesSearch(await response.json());
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw abortError(signal, error);
      if (error instanceof WebError) throw error;
      throw providerError(options.endpoint, "OpenAI Responses returned an unprocessable response.");
    }
  }
}

function apply(ctx, config) {
  ctx.effect(() => {
    const sync = () => syncWebProvider(ctx, isEnabled(readConfigValue(config.enabled)));
    const timer = setTimeout(sync, 500);
    const dispose = ctx.on("settings/document-updated", (namespace) => {
      if (namespace === SETTINGS_NS) sync();
    });
    return () => {
      clearTimeout(timer);
      dispose?.();
      syncWebProvider(ctx, false);
    };
  }, "dsh-web-search-custom: provider selection");
  ctx.inject(["settings"], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
  ctx.web.registerSearchProvider(new CustomSearchProvider(() => ({ ...config, ctx })));
}

export {
  Config,
  CustomSearchProvider,
  endpointFor,
  PROVIDER_ID,
  SETTINGS_NS,
  apply,
  inject,
  name,
  parseResponsesSearch
};
