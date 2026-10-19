# dsh-web-search-custom

[English](README.md) | 简体中文

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供自定义网页搜索。复用 DSH 中已经配置好的模型提供商，通过 OpenAI Responses API 执行 `web_search`，无需再填写一份接口地址或 API Key。

## 功能

- **当前对话模型**：跟随发起搜索请求的对话模型；没有对话上下文的调用回退到 DSH 默认模型。
- **自定义模型**：选择已配置的提供商及其模型。首次选择优先使用当前活动对话的模型；没有活动对话时使用全局默认模型。
- **思考强度**：根据模型实际提供的能力展示选项，也可使用模型默认值；仅影响网页搜索。
- **复用配置**：每次搜索实时读取「设置 → 模型」中的接口地址、凭据引用和额外请求头。需要修改提供商或模型定义时，在模型页面统一修改。
- **中英文设置页**：入口为「设置 → web-search」；当前对话模式无需额外配置。
- **来源解析**：支持 Responses 消息、URL 引用及网页搜索来源列表。

本组合包注册的是搜索提供商。`web_fetch` 继续使用 DSH 配置的网页抓取提供商，本包没有实现独立的 fetch 后端。

## 使用要求与兼容性

- **DSH 运行基线：`0.2.1-rc.2`**。本次发布已核对该版本的服务接口；这不代表更早版本一定无法运行。
- 使用带有 Web 搜索、模型适配器（`dsh-llm-pi-ai`）、模型选择、设置和凭据服务的 Web/Desktop profile。
- 已配置的提供商及模型必须支持 **`POST /responses` 和内置的 `web_search` 工具**。仅支持 Chat Completions 或普通工具调用并不足够。
- 支持 API Key、提供商自定义请求头或无需鉴权的接口。本插件不复用提供商原生 OAuth／登录会话认证。

`engines.dsh` 声明为 `>=0.2.1-rc.2`，不设会随 DSH 升级而人为阻止安装的版本上限。这是安装策略，不是对所有未来版本的兼容保证。只要相关 API 保持兼容，DSH 常规升级就不需要发布插件新版；模型、设置或 Web 服务发生破坏性变更时仍可能需要适配。后续预发布版本还会受到 DSH 自身 semver 检查规则的影响。插件版本 **1.0.0** 与 DSH 的版本独立。

## 安装

发布到 npm 后，在 DSH 插件管理器中选择安装组合包／npm 包，输入：

```text
dsh-web-search-custom@1.0.0
```

本地开发安装：

```sh
git clone https://github.com/puciguala/dsh-web-search-custom.git
cd dsh-web-search-custom
npm ci --ignore-scripts
```

然后通过 DSH 插件管理器安装该仓库的绝对目录。单独执行 `npm install` 不会激活 DSH 组合包。如果替换的是已经加载的 Host 插件，请按插件管理器的提示重启，使新的 JavaScript 生效。本项目无需额外构建。

## 使用

1. 先在「设置 → 模型」中配置提供商和模型。
2. 打开「设置 → web-search」，启用自定义网页搜索。
3. 选择「当前对话模型」；或选择「自定义模型」，再选择提供商、模型和可选的思考强度。
4. 保存后，正常使用 DSH 的 `web_search` 工具。

自定义模式只列出已配置且具有可用模型的 pi-ai 提供商。切换提供商时联动更新模型选项；切换模型后，搜索的思考强度恢复为模型默认值。已保存的选择在页面重新打开后保留。如果提供商或模型被删除，需要重新选择，搜索不会悄悄改用另一提供商。未声明思考强度的模型没有可配置选项。

模型出现在目录中并不代表其远端接口支持 Responses 网页搜索。请使用基于 API Key 的、兼容 Responses 的网关或提供商。DeepSeek 账号登录和仅支持 Anthropic 协议的接口不会因安装本插件而自动获得这项能力。

启用插件会将核心 Web 服务的 `searchProvider` 设为 `dsh-web-search-custom`；关闭或卸载时恢复 `deepseek-official`，后者需要 DSH 官方搜索对应的凭据。已有 `fetchProvider` 会保留；若旧版搜索覆盖配置遗漏该字段，则恢复继承值，或使用 `http`。

## 配置说明

组合包默认配置：

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

| 字段 | 取值／含义 |
| --- | --- |
| `enabled` | `on` 或 `off` |
| `provider` | `current` 或 `custom`，表示模型来源模式 |
| `modelProvider` | 自定义模式中已配置的提供商 id |
| `model` | 该提供商下已配置的模型 id |
| `reasoningEffort` | 模型支持的思考强度 id；空字符串表示模型默认值 |
| `searchTool` | 默认 `web_search`；旧网关可按需设为 `web_search_preview` |

自定义模式示例，请将 id 换成 DSH 中已有的配置：

```yaml
config:
  enabled: "on"
  provider: custom
  modelProvider: my-responses-provider
  model: my-search-model
  reasoningEffort: high
  searchTool: web_search
```

提供商地址可以是 `https://gateway.example/v1` 这样的 API 根路径，也可以是 `https://gateway.example/v1/responses` 这样的完整接口。已有 `/chat/completions` 后缀会替换成 `/responses`；这不会给服务器增加原本不支持的协议。地址查询参数和提供商额外请求头会保留。

如果提供商显式设置了 `apiKeyEnv`，每次请求都会通过 DSH 凭据服务解析，未解析到时读取同名环境变量；缺失时不会回退到其他提供商的密钥。对于未显式指定引用的内置目录提供商，会尝试其声明的原生 API Key 环境变量引用。API Key 保留在 Host，不会在本设置页中编辑或显示。

搜索查询会发送到所选提供商，适用该提供商的计费和数据处理规则。

## 从 0.1.x 升级

1. 在「设置 → 模型」中确认搜索使用的提供商和模型已存在。
2. 旧版独立自定义模式需要在「web-search」中重新选择提供商和模型，然后保存。
3. 保存时会移除插件自身旧的接口地址、密钥引用覆盖项。原来的 `DSH_WEB_SEARCH_CUSTOM_API_KEY` 凭据不会被删除；如不再需要，请通过自己的凭据管理流程清理。

当前对话模式继续跟随调用方的模型。插件不再使用独立的 `endpoint` 或 `apiKeyEnv` 配置。

## 常见问题

| 现象 | 检查项 |
| --- | --- |
| 没有提供商／模型 | 在模型页面配置 pi-ai 提供商、模型和凭据，修复目录错误后重试。 |
| 提供商不可用 | 检查当前／已保存的模型选择和接口地址。对话调用使用发起方模型，包括委派的子对话。 |
| HTTP 400／404 | 确认接口支持 Responses 和内置网页搜索，并检查模型、思考强度及 `searchTool`。 |
| HTTP 401／403 | 检查模型页面中的提供商凭据引用或鉴权请求头。 |
| 无法保存设置 | 部署可能只读，或其他编辑器修改了配置版本。草稿会保留；放弃更改以加载最新值后重试。 |
| 搜索正常但抓取失败 | 单独检查 DSH 的 fetch 提供商配置。 |

## 开发与发布

本地检查使用 Node.js 22+；DSH 使用其自带运行时。

```sh
npm ci --ignore-scripts
npm run check
npm test
npm pack --dry-run
```

测试使用模拟的提供商响应和凭据，不发起付费搜索。`prepack` 会运行语法、资源检查和测试。GitHub CI 会在普通推送和 PR 中分别使用 Node.js 22、24 执行检查。

### 一次性配置 npm

1. 将仓库代码及 `.github/workflows/publish.yml` 推送到公开的 GitHub 仓库 `puciguala/dsh-web-search-custom`。
2. 如果 npm 上还没有这个包，先在本机发布首个版本，之后才有对应的包设置页：

   ```sh
   npm login --registry https://registry.npmjs.org
   npm publish --access public --registry https://registry.npmjs.org
   ```

3. 打开 npm 包的 **Settings → Trusted publishing**，新增 **GitHub Actions** 发布者，填写：

   | 字段 | 填写内容 |
   | --- | --- |
   | Organization or user | `puciguala` |
   | Repository | `dsh-web-search-custom` |
   | Workflow filename | `publish.yml`，只填文件名 |
   | Environment name | 留空，当前工作流没有设置 GitHub environment |
   | Allowed actions | 勾选允许直接执行 **npm publish** |

   新绑定默认可能只允许暂存发布，而当前工作流需要 `npm publish` 权限。无需在 GitHub 中配置 `NPM_TOKEN` Secret。npm 要求新建可信发布绑定后，在 **2 天内**完成首次成功发布；过期后需要等准备发布时删除并重新创建绑定。

### 后续自动发布

1. 更新版本号，同时更新包清单和锁文件。例如已经发布 1.0.0 后执行：

   ```sh
   npm version patch --no-git-tag-version
   ```

   版本会更新到 1.0.1，将这两个文件与源码修改一起提交并推送。
2. 在 GitHub 创建 Release，目标选择刚提交的版本，标签必须与包版本严格对应，例如 **v1.0.1**，然后点击 **Publish release**。
3. `Publish to npm` 工作流会核对标签、包版本、锁文件和仓库地址，安装锁定依赖，运行资源检查及测试，预览打包内容，再通过 npm OIDC 发布公开包并生成来源证明。

只有发布**正式 GitHub Release**才会触发 npm 发布。普通推送和 PR 只跑 CI；草稿及 GitHub prerelease 不发布；单独推送标签也不会发布。标签与包版本不一致时会拒绝发布。npm 不能覆盖已有版本，因此如果已经手动发布过 1.0.0，首次自动发布应使用新的版本号。

工作流使用 GitHub 托管 runner、Node.js 24 和 npm 11。可信发布至少需要 npm 11.5.1 和 Node.js 22.14.0；绑定要求见 [npm 官方文档](https://docs.npmjs.com/trusted-publishers/)。可在本机只检查发布版本，不执行发布：

```sh
RELEASE_TAG=v1.0.0 GITHUB_REPOSITORY=puciguala/dsh-web-search-custom node scripts/check-release.mjs
```

请将 `v1.0.0` 换成当前仓库版本。发布失败时查看 **GitHub → Actions → Publish to npm**，核对 npm 绑定中的用户名、仓库名、工作流文件名是否完全一致，以及是否允许 `npm publish`、绑定是否过期。`npm whoami` 不能用于验证 OIDC 发布权限。

npm 包包含运行文件、组合包 patch、多语言元数据、原创 SVG 图标、中英文 README 和许可证，不包含本机凭据、CI 脚本及开发依赖。问题反馈请使用 [GitHub Issues](https://github.com/puciguala/dsh-web-search-custom/issues)，附上 DSH／插件版本及脱敏后的诊断信息。

## 许可证

[Apache-2.0](LICENSE)。随包 SVG 图标为项目原创作品，采用相同许可证。
