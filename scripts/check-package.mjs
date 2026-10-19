import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
await import(new URL("lib/index.js", root));
const required = ["lib/index.js", "lib/client.js", "cordis.patch.yml", "locale/en.json", "locale/zh.json", "icon.svg", "README.md", "README.zh-CN.md", "LICENSE"];
for (const path of required) {
  assert((await stat(new URL(path, root))).isFile(), `Missing distribution file: ${path}`);
}
for (const target of Object.values(pkg.exports)) {
  const path = typeof target === "string" ? target : target.default;
  if (!path.includes("*")) assert((await stat(new URL(path, root))).isFile(), `Broken export: ${path}`);
}
assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u,
  "Package version must use a semantic version such as 1.0.1");
assert.equal(pkg.license, "Apache-2.0");
const license = await readFile(new URL("LICENSE", root), "utf8");
assert.match(license, /Apache License\s+Version 2\.0/u);
for (const language of ["en", "zh"]) {
  const locale = JSON.parse(await readFile(new URL(`locale/${language}.json`, root), "utf8"));
  assert(locale.meta.title && locale.meta.description, `Missing ${language} metadata`);
}
const icon = await readFile(new URL("icon.svg", root), "utf8");
assert.match(icon, /<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/u);
assert(Buffer.byteLength(icon) <= 256 * 1024);
const client = await readFile(new URL("lib/client.js", root), "utf8");
assert(!/require\(["']@deepseek-ai\//u.test(client), "Client must not import Harness implementation modules");
console.log(`Distribution metadata and exports verified in ${fileURLToPath(root)}`);
