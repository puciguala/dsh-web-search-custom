# dsh-web-search-custom

English | [简体中文](README.zh-CN.md)

A custom web search provider for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Use a model provider you already configured in DSH to run `web_search` through the OpenAI Responses API, without configuring another endpoint or API key.

## Features

- **Current conversation model**: follows the conversation making the search request, with the DSH default model as a fallback for calls without a conversation context.
- **Custom model**: selects an existing provider and one of its models. The initial selection follows the active conversation when available, otherwise the global default.
- **Reasoning effort**: offers the selected model's advertised levels, with a model-default option. This choice affects web search only.
- **Shared configuration**: reads provider URLs, credential references and extra headers from **Settings → Models** for each search. Provider and model definitions are edited on that page.
- **Localized settings**: English and Simplified Chinese under **Settings → web-search**. Current-conversation mode requires no additional fields.
- **Source extraction**: handles Responses messages, URL citations and web-search source lists.

This bundle registers a search provider. `web_fetch` continues to use the fetch provider configured in DSH; this package does not implement a separate fetch backend.

## Requirements and compatibility

- **DSH baseline: `0.2.1-rc.2`**. That is the runtime whose service contracts were checked for this release; it is not a claim that older versions cannot work.
- A Web/Desktop profile with Web search, the model adapter (`dsh-llm-pi-ai`), model selection, settings and credential services.
- A configured provider whose endpoint and selected model support **`POST /responses` with the built-in `web_search` tool**. Supporting Chat Completions or ordinary tool calling alone is insufficient.
- API-key authentication, provider headers, or an endpoint that accepts unauthenticated requests. Native OAuth/session-based provider sign-ins are not reused by this plugin.

`engines.dsh` is `>=0.2.1-rc.2`, with no artificial upper limit that blocks installation after a DSH upgrade. This is an installation policy, not a guarantee about all future versions. Ordinary DSH upgrades do not require a plugin release if the APIs remain compatible. Breaking changes to model/settings/Web services may require an update; later prerelease versions are also subject to DSH's semver checks. Version **1.0.0** describes this plugin's release, independently of DSH's version.

## Installation

Once the package is published to npm, open DSH's plugin manager, choose bundle/package installation, and enter:

```text
dsh-web-search-custom@1.0.0
```

For local development:

```sh
git clone https://github.com/puciguala/dsh-web-search-custom.git
cd dsh-web-search-custom
npm ci --ignore-scripts
```

Install the checkout's absolute directory through the DSH plugin manager. Installing with `npm install` alone does not activate the DSH bundle. If replacing an already loaded Host plugin, follow the manager's restart instructions so the new JavaScript is loaded. No separate build step is needed.

## Usage

1. Configure the provider and models in **Settings → Models** first.
2. Open **Settings → web-search** and enable custom web search.
3. Choose **Current conversation model**, or **Custom model** to select a provider, model and optional reasoning effort.
4. Save the settings and use DSH's normal `web_search` tool.

Custom mode lists configured pi-ai providers with available models. Changing the provider updates the model choices; changing the model resets the search effort to its model default. Saved choices are retained across page reloads. If a selected provider/model disappears, choose a valid replacement; searches do not silently switch to another provider. Models without advertised reasoning levels have no configurable effort.

Model catalog membership does not prove that a remote endpoint supports Responses web search. Configure an API-key-based Responses-compatible gateway/provider for this purpose. DeepSeek account login and Anthropic-only endpoints do not automatically gain web-search support from this plugin.

Enabling the plugin selects `dsh-web-search-custom` as the core Web service's `searchProvider`. Disabling or unloading it restores `deepseek-official`, which requires DSH's official search credentials. The configured fetch provider is preserved; if an old search override omitted `fetchProvider`, the inherited value (or `http`) is restored.

## Configuration

The bundle installs these defaults:

```yaml
- name: dsh-web-search-custom
  config:
    enabled: "on"
    provider: current
    modelProvider: ""
    model: ""
    reasoningEffort: ""
    searchTool: web_search
```

| Field | Values / meaning |
| --- | --- |
| `enabled` | `on` or `off` |
| `provider` | `current` or `custom` — selects the mode |
| `modelProvider` | Existing provider id in custom mode |
| `model` | Existing model id within that provider |
| `reasoningEffort` | An advertised effort id; empty means model default |
| `searchTool` | `web_search` (default) or `web_search_preview`, for gateways requiring the older tool name |

Custom-mode example; replace the ids with values already configured in DSH:

```yaml
config:
  enabled: "on"
  provider: custom
  modelProvider: my-responses-provider
  model: my-search-model
  reasoningEffort: high
  searchTool: web_search
```

Provider API roots such as `https://gateway.example/v1` and complete endpoints such as `https://gateway.example/v1/responses` are accepted. A configured `/chat/completions` suffix is replaced by `/responses`; this does not add protocol support to the server. Query parameters and extra provider headers are preserved.

An explicit `apiKeyEnv` reference is resolved through DSH credentials on every request, with the same named environment variable as a fallback. If it is missing, it does not fall back to a different provider's key. For catalog providers without an explicit reference, declared native API-key environment references are checked. API keys are kept on the Host and never edited or displayed by this settings page.

Search queries are sent to the selected provider. Normal provider billing and data handling apply.

## Upgrading from 0.1.x

1. Make sure the search provider and model exist in **Settings → Models**.
2. For the old standalone custom mode, reselect a provider and model in **web-search**, then save.
3. Endpoint and key-reference overrides from the old plugin are removed from its settings on save. The former `DSH_WEB_SEARCH_CUSTOM_API_KEY` credential is not deleted; remove it through your credential management workflow if no longer needed.

Current-conversation mode continues to follow the caller's model. The plugin no longer uses its own standalone `endpoint` or `apiKeyEnv` settings.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No providers/models | Configure a pi-ai provider, its models and credentials in Models; repair catalog errors and retry. |
| Provider unavailable | Check the current/saved selection and its configured API URL. Calls from a conversation use that caller's model, including delegated conversations. |
| HTTP 400/404 | Verify Responses and built-in web search support; check model, reasoning level and `searchTool`. |
| HTTP 401/403 | Check the selected provider's credential reference or authentication headers in Models. |
| Settings cannot save | The deployment may be read-only, or another editor changed its revision. The draft is preserved; discard to reload the accepted values and retry. |
| Search works but fetch fails | Check DSH's fetch-provider configuration separately. |

## Development and release

Node.js 22+ is used for local checks; DSH supplies its own runtime.

```sh
npm ci --ignore-scripts
npm run check
npm test
npm pack --dry-run
```

The tests use mocked provider responses and credentials; they make no paid search calls. `prepack` runs syntax/resource checks and tests. GitHub CI runs the same checks on Node.js 22 and 24 for pushes and pull requests.

### One-time npm setup

1. Push this repository, including `.github/workflows/publish.yml`, to the public GitHub repository `puciguala/dsh-web-search-custom`.
2. If this package has never been published, publish its first version locally so npm creates the package settings page:

   ```sh
   npm login --registry https://registry.npmjs.org
   npm publish --access public --registry https://registry.npmjs.org
   ```

3. Open the package's **Settings → Trusted publishing** on npmjs.com, add a **GitHub Actions** publisher, and enter:

   | Field | Value |
   | --- | --- |
   | Organization or user | `puciguala` |
   | Repository | `dsh-web-search-custom` |
   | Workflow filename | `publish.yml` — filename only |
   | Environment name | Leave empty; this workflow does not use a GitHub environment |
   | Allowed actions | Enable direct publishing with **npm publish** |

   The default permission for a new binding may allow only staged publishing; this workflow requires permission for `npm publish`. No `NPM_TOKEN` repository secret is needed. npm requires the first successful publish through a new trusted publisher within **2 days**; if the binding expires, delete it and create it again when ready to release.

### Automatic releases

1. For the next version, update both the manifest and lockfile. For example, after publishing 1.0.0:

   ```sh
   npm version patch --no-git-tag-version
   ```

   This changes the version to 1.0.1. Commit and push the updated files together with any source changes.
2. On GitHub, create a Release from that commit, using a tag that exactly matches the package version with a `v` prefix, such as **v1.0.1**, then click **Publish release**.
3. The `Publish to npm` workflow checks the tag, manifest, lockfile and repository identity; installs locked dependencies; runs the package checks and tests; previews the package contents; then publishes publicly with npm OIDC and provenance.

Only a published **stable GitHub Release** triggers npm publishing. Ordinary pushes and pull requests run CI only; drafts and GitHub prereleases do not publish. A tag alone does not publish. The workflow deliberately rejects a tag/version mismatch. npm cannot overwrite an existing version, so a manually published 1.0.0 must be followed by a new version for the first automated release.

The workflow uses a GitHub-hosted runner with Node.js 24 and npm 11. Trusted publishing requires npm 11.5.1+ and Node.js 22.14.0+. See the [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/) for current binding requirements. You can validate the release guard locally without publishing:

```sh
RELEASE_TAG=v1.0.0 GITHUB_REPOSITORY=puciguala/dsh-web-search-custom node scripts/check-release.mjs
```

Replace `v1.0.0` with the version in your checkout. If publishing fails, inspect **GitHub → Actions → Publish to npm**. Check that the npm binding has the exact owner, repository and workflow filename, permits `npm publish`, and has not expired. `npm whoami` does not validate OIDC publishing permissions.

The npm package includes runtime files, the patch, metadata, original SVG icon, both READMEs and the license; it excludes local credentials, CI scripts and development dependencies. Report bugs at [GitHub Issues](https://github.com/puciguala/dsh-web-search-custom/issues), with DSH/plugin versions and redacted diagnostics.

## License

[Apache-2.0](LICENSE). The bundled SVG icon is original project artwork distributed under the same license.
