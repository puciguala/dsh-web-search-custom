import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Execute the actual module factory without loading or rendering the UI. The
// only substitutes are the two React modules declared by that factory.
const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
let registration;
vm.runInNewContext(source, { window: { __ModuleLoader__: { load(value) { registration = value; } } } }, { filename: "lib/client.js" });
assert.equal(registration.id, "dsh-web-search-custom");
const requestedModules = [];
const moduleExports = registration.factory((name) => {
  requestedModules.push(name);
  if (name === "react") return {};
  if (name === "react/jsx-runtime") return {
    jsx() { throw new Error("UI rendering is outside the Controller tests"); },
    jsxs() { throw new Error("UI rendering is outside the Controller tests"); }, Fragment: Symbol("Fragment")
  };
  throw new Error(`Unexpected client dependency: ${name}`);
});
const { Controller, en, zh } = moduleExports;
const plain = (value) => JSON.parse(JSON.stringify(value));
const fields = ["enabled", "provider", "modelProvider", "model", "reasoningEffort"];

function scopeFixture(initial = {}) {
  let accepted = {
    status: "ready", writable: true, revision: 4,
    value: { enabled: "off", provider: "current", modelProvider: "", model: "", reasoningEffort: "", searchTool: "web_search_preview" },
    user: {}, ...initial
  };
  const listeners = new Set();
  const calls = [];
  let unsubscribed = 0;
  let mutation;
  const scope = {
    getSnapshot: () => accepted,
    subscribe(listener) { listeners.add(listener); return () => { unsubscribed++; listeners.delete(listener); }; },
    async mutate(ops, expectedRevision) {
      calls.push({ ops: plain(ops), expectedRevision });
      if (mutation) return mutation(ops, expectedRevision);
      if (expectedRevision !== accepted.revision) return false;
      const value = { ...accepted.value };
      const user = { ...accepted.user };
      for (const op of ops) {
        assert.equal(op.path.length, 1);
        if (op.op === "set") { value[op.path[0]] = op.value; user[op.path[0]] = op.value; }
        else if (op.op === "unset") { delete value[op.path[0]]; delete user[op.path[0]]; }
        else assert.fail(`Unexpected settings mutation: ${op.op}`);
      }
      update({ value, user, revision: accepted.revision + 1 });
      return true;
    }
  };
  function update(patch) { accepted = { ...accepted, ...patch }; for (const listener of listeners) listener(); }
  return { scope, calls, update, setMutation: (implementation) => { mutation = implementation; }, get unsubscribed() { return unsubscribed; }, get listenerCount() { return listeners.size; } };
}

test("client factory exports Controller and matching, nonempty English/Chinese keys using only React dependencies", () => {
  assert.deepEqual(requestedModules, ["react", "react/jsx-runtime"]);
  assert.equal(typeof Controller, "function");
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const key of ["enabled", "mode", "current", "custom", "provider", "model", "reasoning", "reuseHint", "protocolHint", "invalidSelection", "saveFailed", "save", "discard", "loading", "loadFailed", "partialFailure", "readOnly"]) {
    assert.equal(typeof en[key], "string", `Missing English key ${key}`);
    assert.equal(typeof zh[key], "string", `Missing Chinese key ${key}`);
  }
  for (const dictionary of [en, zh]) for (const [key, text] of Object.entries(dictionary)) {
    assert.equal(typeof text, "string", key);
    assert.ok(text.trim().length > 0, key);
  }
});

test("Controller normalizes absent settings without creating a draft", (t) => {
  const fixture = scopeFixture({ value: {} });
  const controller = new Controller(fixture.scope);
  t.after(() => controller.dispose());
  assert.deepEqual(plain(controller.getSnapshot().values), { enabled: "off", provider: "current", modelProvider: "", model: "", reasoningEffort: "" });
  assert.equal(controller.getSnapshot().dirty, false);
  assert.equal(controller.getSnapshot().saving, false);
  assert.equal(controller.getSnapshot().error, false);
});

test("save submits the selected fields with the captured revision and accepts the saved snapshot", async (t) => {
  const fixture = scopeFixture();
  const controller = new Controller(fixture.scope);
  t.after(() => controller.dispose());
  const draft = { enabled: "on", provider: "custom", modelProvider: "configured", model: "search-model", reasoningEffort: "high" };
  controller.edit(draft);
  assert.equal(controller.getSnapshot().dirty, true);
  await controller.save();
  assert.deepEqual(fixture.calls, [{ ops: fields.map((field) => ({ op: "set", path: [field], value: draft[field] })), expectedRevision: 4 }]);
  assert.equal(controller.getSnapshot().revision, 5);
  assert.deepEqual(plain(controller.getSnapshot().values), draft);
  assert.equal(controller.getSnapshot().dirty, false);
  assert.equal(controller.getSnapshot().saved, true);
  assert.equal(controller.getSnapshot().saving, false);
  assert.equal(controller.getSnapshot().error, false);
  assert.equal(fixture.scope.getSnapshot().value.searchTool, "web_search_preview", "saving the UI must preserve other Config fields");
});

test("save migrates only obsolete user endpoint/key overrides with unset operations", async (t) => {
  const fixture = scopeFixture({ user: { endpoint: "https://legacy.example/", apiKeyEnv: "LEGACY_KEY", searchTool: "web_search_preview" } });
  const controller = new Controller(fixture.scope);
  t.after(() => controller.dispose());
  controller.edit({ enabled: "on" });
  await controller.save();
  assert.deepEqual(fixture.calls[0].ops.slice(-2), [{ op: "unset", path: ["endpoint"] }, { op: "unset", path: ["apiKeyEnv"] }]);
  assert.equal(Object.hasOwn(fixture.scope.getSnapshot().user, "endpoint"), false);
  assert.equal(Object.hasOwn(fixture.scope.getSnapshot().user, "apiKeyEnv"), false);
  assert.equal(fixture.scope.getSnapshot().user.searchTool, "web_search_preview");
});

test("a revision conflict preserves the draft and its original revision until discard", async (t) => {
  const fixture = scopeFixture();
  const controller = new Controller(fixture.scope);
  t.after(() => controller.dispose());
  controller.edit({ enabled: "on", provider: "custom", modelProvider: "chosen", model: "draft-model" });
  const draft = plain(controller.getSnapshot().values);
  fixture.update({ revision: 5, value: { enabled: "off", provider: "current", model: "external-model" } });
  await controller.save();
  assert.equal(fixture.calls[0].expectedRevision, 4);
  assert.deepEqual(plain(controller.getSnapshot().values), draft);
  assert.equal(controller.getSnapshot().dirty, true);
  assert.equal(controller.getSnapshot().error, true);
  assert.equal(controller.getSnapshot().saving, false);
  assert.equal(controller.getSnapshot().saved, false);
  controller.edit({ reasoningEffort: "high" });
  await controller.save();
  assert.equal(fixture.calls[1].expectedRevision, 4, "editing a conflicting draft must not silently rebase it");
  controller.discard();
  assert.equal(controller.getSnapshot().dirty, false);
  assert.equal(controller.getSnapshot().error, false);
  assert.equal(controller.getSnapshot().values.model, "external-model");
  controller.edit({ enabled: "on" });
  await controller.save();
  assert.equal(fixture.calls[2].expectedRevision, 5);
  assert.equal(controller.getSnapshot().saved, true);
});

test("a thrown save resets saving, preserves the draft and can recover on retry", async (t) => {
  const fixture = scopeFixture();
  fixture.setMutation(async () => { throw new Error("settings transport unavailable"); });
  const controller = new Controller(fixture.scope);
  t.after(() => controller.dispose());
  controller.edit({ enabled: "on" });
  const draft = plain(controller.getSnapshot().values);
  await assert.doesNotReject(controller.save());
  assert.equal(controller.getSnapshot().saving, false);
  assert.equal(controller.getSnapshot().dirty, true);
  assert.equal(controller.getSnapshot().error, true);
  assert.deepEqual(plain(controller.getSnapshot().values), draft);
  fixture.setMutation(undefined);
  await controller.save();
  assert.equal(controller.getSnapshot().saved, true);
  assert.equal(controller.getSnapshot().dirty, false);
  assert.equal(controller.getSnapshot().error, false);
});

test("an in-flight save rejects duplicate saves and edits until it settles", async (t) => {
  const fixture = scopeFixture();
  let settle;
  fixture.setMutation(() => new Promise((resolve) => { settle = resolve; }));
  const controller = new Controller(fixture.scope);
  t.after(() => controller.dispose());
  controller.edit({ enabled: "on", model: "original-draft" });
  const saving = controller.save();
  assert.equal(controller.getSnapshot().saving, true);
  controller.edit({ model: "must-not-replace" });
  await controller.save();
  assert.equal(fixture.calls.length, 1);
  assert.equal(controller.getSnapshot().values.model, "original-draft");
  settle(false);
  await saving;
  assert.equal(controller.getSnapshot().saving, false);
  assert.equal(controller.getSnapshot().values.model, "original-draft");
});

test("read-only settings and an unchanged Controller never call mutate", async (t) => {
  const fixture = scopeFixture();
  const controller = new Controller(fixture.scope);
  t.after(() => controller.dispose());
  await controller.save();
  fixture.update({ writable: false });
  controller.edit({ enabled: "on" });
  await controller.save();
  assert.equal(controller.getSnapshot().dirty, false);
  assert.equal(controller.getSnapshot().values.enabled, "off");
  assert.equal(fixture.calls.length, 0);
});

test("dispose unsubscribes from the scope and stops notifications and snapshot updates", () => {
  const fixture = scopeFixture();
  const controller = new Controller(fixture.scope);
  let notifications = 0;
  const unsubscribe = controller.subscribe(() => { notifications++; });
  controller.edit({ enabled: "on" });
  assert.equal(notifications, 1);
  unsubscribe();
  controller.edit({ model: "before-dispose" });
  assert.equal(notifications, 1);
  controller.subscribe(() => { notifications++; });
  const snapshot = controller.getSnapshot();
  controller.dispose();
  assert.equal(fixture.unsubscribed, 1);
  assert.equal(fixture.listenerCount, 0);
  fixture.update({ revision: 10, value: { enabled: "off" } });
  assert.equal(controller.getSnapshot(), snapshot);
  assert.equal(notifications, 1);
});

test("disposing during save prevents late resolution from notifying subscribers", async () => {
  const fixture = scopeFixture();
  let settle;
  fixture.setMutation(() => new Promise((resolve) => { settle = resolve; }));
  const controller = new Controller(fixture.scope);
  let notifications = 0;
  controller.subscribe(() => { notifications++; });
  controller.edit({ enabled: "on" });
  const saving = controller.save();
  const before = notifications;
  controller.dispose();
  settle(false);
  await saving;
  assert.equal(notifications, before);
  assert.equal(fixture.listenerCount, 0);
});
