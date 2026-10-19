window.__ModuleLoader__.load({
  id: "dsh-web-search-custom",
  factory: (require) => {
    const React = require("react");
    const { jsx, jsxs, Fragment } = require("react/jsx-runtime");
    const NS = "settings.dshWebSearchCustom";
    const SETTINGS_NS = "dsh-web-search-custom";
    const fields = ["enabled", "provider", "modelProvider", "model", "reasoningEffort"];
    const en = {
      title: "web-search",
      description: "Search the web using a model provider already configured in DSH.",
      enabled: "Enable custom web search",
      enabledHint: "Use this plugin for web_search. Turning it off restores DSH's official search provider.",
      mode: "Model source", current: "Current conversation model", custom: "Custom model",
      currentHint: "Follows the model used by the conversation making the search request. No additional configuration is needed.",
      provider: "Provider", model: "Model", reasoning: "Reasoning effort",
      reuseHint: "Providers, models and credentials come from Settings → Models. Edit their configuration there.",
      protocolHint: "The selected provider must support the OpenAI Responses API and its built-in web_search tool.",
      reasoningHint: "Applies only to web search; the conversation's model settings stay unchanged.",
      noReasoning: "This model does not advertise configurable reasoning effort.",
      defaultEffort: "Model default", off: "Off", minimal: "Minimal", low: "Low", medium: "Medium", high: "High", xhigh: "Extra high", max: "Maximum",
      selectProvider: "Select a provider", selectModel: "Select a model", missing: "Unavailable selection",
      empty: "No configured providers with available models. Add a provider and model in Settings → Models.",
      loading: "Loading models…", loadFailed: "Could not load the model catalog. Retry after checking the model configuration.",
      partialFailure: "Some providers could not be loaded. Check their configuration in Settings → Models.",
      invalidSelection: "The saved selection is no longer available. Choose a configured provider, model and supported effort.",
      noCurrent: "The current conversation model is unavailable in this catalog. Select a provider and model below.",
      readOnly: "This deployment stores settings read-only.", unavailable: "The plugin is not currently available.",
      save: "Save", discard: "Discard", saving: "Saving…", saved: "Saved", retry: "Retry",
      saveFailed: "The settings could not be saved, or changed elsewhere. Your draft is preserved; reload the latest values with Discard before retrying."
    };
    const zh = {
      title: "web-search",
      description: "使用 DSH 已配置的模型提供商进行网页搜索。",
      enabled: "启用自定义网页搜索",
      enabledHint: "开启后，web_search 使用此插件；关闭后恢复 DSH 官方搜索提供商。",
      mode: "模型来源", current: "当前对话模型", custom: "自定义模型",
      currentHint: "跟随发起搜索请求的对话所使用的模型，无需额外配置。",
      provider: "提供商", model: "模型", reasoning: "思考强度",
      reuseHint: "提供商、模型及凭据均来自「设置 → 模型」，需要修改时请前往该页面。",
      protocolHint: "所选提供商需要支持 OpenAI Responses API 及其内置的 web_search 工具。",
      reasoningHint: "仅用于网页搜索，不会改变当前对话的模型设置。",
      noReasoning: "该模型未提供可配置的思考强度。",
      defaultEffort: "模型默认", off: "关闭", minimal: "最低", low: "低", medium: "中", high: "高", xhigh: "超高", max: "最高",
      selectProvider: "选择提供商", selectModel: "选择模型", missing: "已失效的选择",
      empty: "暂无已配置且有可用模型的提供商，请先在「设置 → 模型」中添加。",
      loading: "正在加载模型…", loadFailed: "无法加载模型目录，请检查模型配置后重试。",
      partialFailure: "部分提供商加载失败，请在「设置 → 模型」中检查配置。",
      invalidSelection: "已保存的选择不再可用，请重新选择已配置的提供商、模型及支持的思考强度。",
      noCurrent: "当前对话模型不在可选目录中，请在下方选择提供商和模型。",
      readOnly: "本部署的设置为只读。", unavailable: "插件当前不可用。",
      save: "保存", discard: "放弃更改", saving: "保存中…", saved: "已保存", retry: "重试",
      saveFailed: "保存失败或设置已在别处更改。草稿已保留，可先「放弃更改」以重新加载最新值后再试。"
    };

    const CSS = `
.dsh-wsc{max-width:720px;padding:8px 0 32px;color:var(--dsw-alias-label-primary);line-height:1.6;overflow-wrap:anywhere}
.dsh-wsc h2{font-size:20px;line-height:1.4;margin:0 0 8px;font-weight:600}
.dsh-wsc p{margin:6px 0;color:var(--dsw-alias-label-secondary);font-size:13px}
.dsh-wsc .dsh-wsc-intro{font-size:14px;margin-bottom:24px}
.dsh-wsc-field{display:grid;gap:6px;margin:20px 0;min-width:0}
.dsh-wsc-field>label{font-size:14px;font-weight:500}
.dsh-wsc select,.dsh-wsc button{font:inherit;font-size:14px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;min-height:38px;padding:8px 12px;max-width:100%}
.dsh-wsc select{width:100%;min-width:0;text-overflow:ellipsis}
.dsh-wsc button{cursor:pointer}
.dsh-wsc :is(button,select,input):focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}
.dsh-wsc :disabled{opacity:.55;cursor:default}
.dsh-wsc-toggle{display:flex;align-items:flex-start;gap:12px;padding:16px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dsh-wsc-toggle input{width:17px;height:17px;margin:4px 0 0;accent-color:var(--dsw-alias-brand-primary);flex-shrink:0}
.dsh-wsc-toggle strong{font-size:14px;font-weight:500}
.dsh-wsc-note{padding:12px 14px;border-radius:8px;background:var(--dsw-alias-bg-layer-2)}
.dsh-wsc-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:24px}
.dsh-wsc .dsh-wsc-save{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.dsh-wsc .dsh-wsc-error{color:var(--dsw-alias-state-error-primary)}
`;

    const emptyDirectory = { current: null, groups: [], status: "idle" };
    const noopSubscribe = () => () => {};
    const emptySnapshot = () => emptyDirectory;
    const normalize = (value = {}) => Object.fromEntries(fields.map((key) => [key, value[key] ?? (key === "enabled" ? "off" : key === "provider" ? "current" : "")]));

    // Local staged editor; writes use the settings service's revision fence.
    class Controller {
      constructor(scope) {
        this.scope = scope;
        this.listeners = new Set();
        this.draft = null;
        this.revision = undefined;
        this.saving = false;
        this.error = false;
        this.saved = false;
        this.disposed = false;
        this.publish();
        this.unsubscribe = scope.subscribe(() => this.publish());
      }
      subscribe = (listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
      getSnapshot = () => this.snapshot;
      publish() {
        if (this.disposed) return;
        const accepted = this.scope.getSnapshot();
        this.snapshot = { ...accepted, values: this.draft ?? normalize(accepted.value), dirty: this.draft !== null, saving: this.saving, error: this.error, saved: this.saved };
        for (const listener of this.listeners) listener();
      }
      edit(patch) {
        if (!this.snapshot.writable || this.saving) return;
        if (!this.draft) this.revision = this.snapshot.revision;
        this.draft = { ...this.snapshot.values, ...patch };
        this.error = false;
        this.saved = false;
        this.publish();
      }
      discard = () => { this.draft = null; this.error = false; this.saved = false; this.publish(); };
      save = async () => {
        if (!this.draft || this.saving || !this.snapshot.writable) return;
        this.saving = true;
        this.error = false;
        this.publish();
        try {
          const ops = fields.map((field) => ({ op: "set", path: [field], value: this.draft[field] }));
          // Migrate the old standalone endpoint/key settings on the next save.
          for (const field of ["endpoint", "apiKeyEnv"]) {
            if (Object.hasOwn(this.scope.getSnapshot().user ?? {}, field)) ops.push({ op: "unset", path: [field] });
          }
          const accepted = await this.scope.mutate(ops, this.revision);
          if (accepted) { this.draft = null; this.saved = true; }
          else this.error = true;
        } catch { this.error = true; }
        finally { this.saving = false; this.publish(); }
      };
      dispose() { this.disposed = true; this.unsubscribe(); this.listeners.clear(); }
    }

    function SelectField({ id, label, value, options, disabled, hint, onChange }) {
      return jsxs("div", { className: "dsh-wsc-field", children: [
        jsx("label", { htmlFor: id, children: label }),
        jsx("select", { id, value, disabled, "aria-describedby": hint ? `${id}-hint` : undefined, onChange: (event) => onChange(event.target.value), children: options.map((option) => jsx("option", { value: option.value, children: option.label }, option.value)) }),
        hint && jsx("p", { id: `${id}-hint`, children: hint })
      ] });
    }

    function Page(props) {
      const t = props.t;
      const controller = props.controller;
      const state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot);
      const mirror = props.forms.describe();
      const document = React.useSyncExternalStore((listener) => mirror.subscribe(listener), () => mirror.getSnapshot());
      const sessionId = props.useSessions((snapshot) => Object.values(snapshot.byId).find((row) => (row.retainedBy.mainView ?? 0) > 0)?.id);
      const directory = React.useMemo(() => {
        try { return sessionId ? props.models?.directoryFor(sessionId) : undefined; }
        catch { return undefined; }
      }, [sessionId, props.models]);
      const active = React.useSyncExternalStore(directory ? (listener) => directory.store.subscribe(listener) : noopSubscribe, directory ? () => directory.store.getSnapshot() : emptySnapshot);
      const [catalog, setCatalog] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [loadError, setLoadError] = React.useState(false);
      const [attempt, retry] = React.useReducer((value) => value + 1, 0);
      // Reload when the Models configuration changes; an old response cannot win.
      const piView = document.view?.namespaces.find((row) => row.ns === "llm-pi-ai" || row.ns === "include:llm-pi-ai");
      React.useEffect(() => {
        let live = true;
        setLoading(true);
        setLoadError(false);
        props.remote.session.modelCatalog().then((result) => {
          if (!live) return;
          if (!result.ok) throw new Error("catalog unavailable");
          setCatalog(result.value);
        }).catch(() => { if (live) setLoadError(true); }).finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
      }, [piView?.revision, attempt, props.remote]);
      React.useEffect(() => { directory?.load().catch(() => {}); }, [directory]);
      const configured = piView?.value?.providers ?? {};
      const groups = (catalog?.groups ?? []).filter((group) => Object.hasOwn(configured, group.id) && group.models.length > 0);
      const waitingCurrent = Boolean(directory && !active.current && ["idle", "loading"].includes(active.status));
      const current = active.current ?? (sessionId ? undefined : catalog?.default);
      const values = state.values;
      const custom = values.provider === "custom";
      const group = groups.find((item) => item.id === values.modelProvider);
      const model = group?.models.find((item) => item.id === values.model);
      const efforts = model?.reasoning?.efforts ?? [];
      const invalid = custom && (!model || (values.reasoningEffort && !efforts.some((item) => item.id === values.reasoningEffort)));
      const disabled = !state.writable || state.saving || state.status !== "ready";
      const defaultSelection = () => {
        const candidate = groups.find((item) => item.id === current?.provider);
        const selected = candidate?.models.find((item) => item.id === current?.model);
        return { modelProvider: selected ? candidate.id : "", model: selected?.id ?? "", reasoningEffort: selected?.reasoning?.efforts.some((item) => item.id === current?.reasoningEffort) ? current.reasoningEffort : "" };
      };
      const seeded = React.useRef(false);
      React.useEffect(() => {
        if (!seeded.current && custom && !values.modelProvider && !loading && !loadError && !state.dirty && current) {
          const initial = defaultSelection();
          if (initial.modelProvider) {
            seeded.current = true;
            controller.edit(initial);
          }
        }
      }, [custom, values.modelProvider, loading, loadError, state.dirty, current, groups]);
      const providerOptions = [{ value: "", label: t("selectProvider") }, ...groups.map((item) => ({ value: item.id, label: item.name }))];
      if (values.modelProvider && !group) providerOptions.push({ value: values.modelProvider, label: `${t("missing")}: ${values.modelProvider}` });
      const modelOptions = [{ value: "", label: t("selectModel") }, ...(group?.models ?? []).map((item) => ({ value: item.id, label: item.name }))];
      if (values.model && !model) modelOptions.push({ value: values.model, label: `${t("missing")}: ${values.model}` });
      const effortOptions = [{ value: "", label: t("defaultEffort") }, ...efforts.map((item) => ({ value: item.id, label: Object.hasOwn(en, item.id) ? t(item.id) : item.name }))];
      if (values.reasoningEffort && !efforts.some((item) => item.id === values.reasoningEffort)) effortOptions.push({ value: values.reasoningEffort, label: `${t("missing")}: ${values.reasoningEffort}` });
      return jsxs("div", { className: "dsh-wsc", children: [
        jsx("style", { children: CSS }),
        jsx("h2", { children: t("title") }),
        jsx("p", { className: "dsh-wsc-intro", children: t("description") }),
        state.status === "loading" && jsx("p", { role: "status", children: t("loading") }),
        state.status === "unavailable" && jsx("p", { role: "alert", children: t("unavailable") }),
        !state.writable && state.status === "ready" && jsx("p", { children: t("readOnly") }),
        jsx("form", { onSubmit: (event) => { event.preventDefault(); if (values.enabled === "off" || !invalid) controller.save(); }, children: jsxs(Fragment, { children: [
          jsxs("label", { className: "dsh-wsc-toggle", children: [
            jsx("input", { type: "checkbox", role: "switch", "aria-checked": values.enabled === "on", checked: values.enabled === "on", disabled, onChange: (event) => controller.edit({ enabled: event.target.checked ? "on" : "off" }) }),
            jsxs("span", { children: [jsx("strong", { children: t("enabled") }), jsx("p", { children: t("enabledHint") })] })
          ] }),
          jsx(SelectField, { id: "dsh-wsc-mode", label: t("mode"), value: values.provider, disabled: disabled || (!custom && (loading || waitingCurrent)), options: [{ value: "current", label: t("current") }, { value: "custom", label: t("custom") }], onChange: (value) => controller.edit({ provider: value, ...(value === "custom" && !values.modelProvider ? defaultSelection() : {}) }) }),
          !custom ? jsx("p", { className: "dsh-wsc-note", children: t("currentHint") }) : jsxs(Fragment, { children: [
            jsx("p", { className: "dsh-wsc-note", children: t("reuseHint") }),
            loading && jsx("p", { role: "status", children: t("loading") }),
            loadError && jsxs("div", { role: "alert", children: [jsx("p", { className: "dsh-wsc-error", children: t("loadFailed") }), jsx("button", { type: "button", onClick: retry, children: t("retry") })] }),
            !loading && !loadError && groups.length === 0 && jsx("p", { role: "status", children: t("empty") }),
            catalog?.failures?.length > 0 && jsx("p", { role: "status", children: t("partialFailure") }),
            !values.modelProvider && groups.length > 0 && jsx("p", { children: t("noCurrent") }),
            jsx(SelectField, { id: "dsh-wsc-provider", label: t("provider"), value: values.modelProvider, disabled: disabled || loading || loadError || groups.length === 0, options: providerOptions, onChange: (value) => {
              const next = groups.find((item) => item.id === value);
              const preferred = next?.models.find((item) => item.id === current?.model && value === current?.provider) ?? next?.models[0];
              controller.edit({ modelProvider: value, model: preferred?.id ?? "", reasoningEffort: "" });
            } }),
            jsx(SelectField, { id: "dsh-wsc-model", label: t("model"), value: values.model, disabled: disabled || loading || loadError || !group, options: modelOptions, onChange: (value) => controller.edit({ model: value, reasoningEffort: "" }) }),
            jsx(SelectField, { id: "dsh-wsc-effort", label: t("reasoning"), value: values.reasoningEffort, disabled: disabled || loading || !model || efforts.length === 0, options: effortOptions, hint: efforts.length ? t("reasoningHint") : t("noReasoning"), onChange: (value) => controller.edit({ reasoningEffort: value }) }),
            invalid && !loading && !loadError && jsx("p", { role: "alert", className: "dsh-wsc-error", children: t("invalidSelection") })
          ] }),
          jsx("p", { children: t("protocolHint") }),
          state.error && jsx("p", { role: "alert", className: "dsh-wsc-error", children: t("saveFailed") }),
          jsxs("div", { className: "dsh-wsc-actions", children: [
            jsx("button", { type: "submit", className: "dsh-wsc-save", disabled: disabled || !state.dirty || (values.enabled === "on" && invalid) || (values.enabled === "on" && custom && (loading || loadError)), children: t(state.saving ? "saving" : "save") }),
            state.dirty && jsx("button", { type: "button", disabled: state.saving, onClick: controller.discard, children: t("discard") }),
            state.saved && jsx("span", { role: "status", children: t("saved") })
          ] })
        ] }) })
      ] });
    }

    const inject = ["slots", "locale", "configForms", "remote", "remote.session", "modelDirectories"];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-web-search-custom: dictionaries");
      const controller = new Controller(ctx.configForms.get(SETTINGS_NS));
      ctx.effect(() => () => controller.dispose(), "dsh-web-search-custom: form");
      ctx.effect(() => ctx.configForms.whileServed([SETTINGS_NS], () => ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section", id: "web-search-custom", order: 35,
        label: () => ctx.locale.bind(NS)("title"), locale: NS,
        inject: () => ({ controller, forms: ctx.configForms, remote: ctx.remote, models: ctx.get("modelDirectories") })
      }, Page))), "dsh-web-search-custom: settings page");
    }
    return { NS, apply, inject, Controller, en, zh };
  }
});
