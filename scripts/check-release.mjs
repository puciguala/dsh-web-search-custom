import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function validateRelease({ pkg, lock, tag, repository }) {
  assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u,
    "Automatic publishing accepts stable versions such as 1.0.1");
  assert.equal(tag, `v${pkg.version}`,
    "The GitHub Release tag must be v followed by package.json version");
  assert.equal(lock.name, pkg.name, "package-lock.json package name is out of sync");
  assert.equal(lock.version, pkg.version, "package-lock.json version is out of sync");
  assert.equal(lock.packages?.[""]?.name, pkg.name, "Lockfile root package name is out of sync");
  assert.equal(lock.packages?.[""]?.version, pkg.version, "Lockfile root version is out of sync");
  if (repository) {
    assert.equal(pkg.repository?.url, `git+https://github.com/${repository}.git`,
      "package.json repository.url must match the GitHub repository for npm provenance");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = new URL("../", import.meta.url);
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  const lock = JSON.parse(await readFile(new URL("package-lock.json", root), "utf8"));
  validateRelease({ pkg, lock, tag: process.env.RELEASE_TAG, repository: process.env.GITHUB_REPOSITORY });
  console.log(`Release ${process.env.RELEASE_TAG} matches ${pkg.name}@${pkg.version}`);
}
