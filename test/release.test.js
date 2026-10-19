import assert from "node:assert/strict";
import test from "node:test";
import { validateRelease } from "../scripts/check-release.mjs";

function release(version = "1.0.1") {
  return {
    pkg: {
      name: "dsh-web-search-custom", version,
      repository: { url: "git+https://github.com/puciguala/dsh-web-search-custom.git" }
    },
    lock: {
      name: "dsh-web-search-custom", version,
      packages: { "": { name: "dsh-web-search-custom", version } }
    },
    tag: `v${version}`,
    repository: "puciguala/dsh-web-search-custom"
  };
}

for (const version of ["1.0.0", "1.0.1", "2.3.4"]) {
  test(`release validation accepts matching stable ${version} metadata`, () => {
    assert.doesNotThrow(() => validateRelease(release(version)));
  });
}

test("release validation rejects a tag that names another package version", () => {
  const input = release();
  input.tag = "v1.0.0";
  assert.throws(() => validateRelease(input), /Release tag/u);
});

test("release validation requires an explicit v-prefixed release tag", () => {
  for (const tag of [undefined, "", "1.0.1", "latest"]) {
    assert.throws(() => validateRelease({ ...release(), tag }), /Release tag/u);
  }
});

test("automatic publishing rejects prereleases and non-semantic versions", () => {
  for (const version of ["1.0.1-beta.1", "01.0.1", "1.0", "v1.0.1"]) {
    assert.throws(() => validateRelease(release(version)), /stable versions/u);
  }
});

test("release validation rejects an outdated top-level lockfile version", () => {
  const input = release();
  input.lock.version = "1.0.0";
  assert.throws(() => validateRelease(input), /package-lock.json version/u);
});

test("release validation rejects an outdated lockfile root package version", () => {
  const input = release();
  input.lock.packages[""].version = "1.0.0";
  assert.throws(() => validateRelease(input), /Lockfile root version/u);
});

test("release validation rejects a lockfile from another package", () => {
  const input = release();
  input.lock.name = "another-package";
  assert.throws(() => validateRelease(input), /package name/u);
});

test("release validation rejects a repository inconsistent with provenance", () => {
  const input = release();
  input.repository = "another-owner/dsh-web-search-custom";
  assert.throws(() => validateRelease(input), /repository.url/u);
});
