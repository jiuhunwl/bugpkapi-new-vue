# BugPk-Api Web

[![CI](https://github.com/jiuhunwl/bugpkapi-new-vue/actions/workflows/ci.yml/badge.svg)](https://github.com/jiuhunwl/bugpkapi-new-vue/actions/workflows/ci.yml)

[![LINUX DO](https://img.shields.io/badge/LINUX%20DO-%E7%A4%BE%E5%8C%BA-1f6feb?logo=discourse&logoColor=white)](https://linux.do) 本项目在 [LINUX DO](https://linux.do) 社区分享。

开源的 API 开放平台前端，覆盖用户端与管理端，配套后端与文档见下表。

| 仓库 | 说明 |
| --- | --- |
| [bugpkapi-new-go](https://github.com/jiuhunwl/bugpkapi-new-go) | 后端服务（Go + MySQL），AGPL-3.0 |
| **bugpkapi-new-vue**（本仓库） | 前端（Vue 3 + Vben Admin），MIT |
| [bugpkapi-new-docs](https://github.com/jiuhunwl/bugpkapi-new-docs) | 文档、架构说明与部署指南 |

## 功能

- 用户端：注册登录、API Key 管理、套餐与点数、下单支付、调用日志、公告、工单、协议查看。
- 管理端：站点与品牌配置、接口与分组、计费与套餐、订单与对账、用户与权限、工单与公告、审计日志。
- 工程能力：简体中文 / English 双语、暗色主题、响应式布局、按角色渲染菜单。

## 技术栈

Vue 3、TypeScript、Vite、Ant Design Vue、Pinia、Vben Admin workspace、pnpm 11 + Turborepo。

## 目录结构

```text
.
├── playground/        # 主应用（用户端 + 管理端）
├── packages/          # 复用包与基础能力
├── internal/          # 工程化配置与工具
├── apps/              # 其他应用入口
└── scripts/           # 仓库级脚本
```

## 快速开始

环境要求：Node.js `^22.18.0 || ^24.0.0`，pnpm `>= 11`。

```bash
pnpm install
pnpm dev:play
```

开发服务器默认运行在 `http://127.0.0.1:5555`，并把 `/system-api` 与 `/api` 代理到后端 `http://127.0.0.1:8080`。连接其他后端时用环境变量覆盖，不要改动默认值：

```bash
VITE_PROXY_TARGET=http://127.0.0.1:8080 pnpm dev:play
```

后端初始化步骤（建库、导入初始化 SQL、通过环境变量创建首个管理员）见后端仓库 README。

### 关键环境变量

| 变量 | 作用 |
| --- | --- |
| `VITE_GLOB_API_URL` | 生产环境请求前缀，同域部署用 `/system-api`，分离部署填后端绝对地址 |
| `VITE_PROXY_TARGET` | 开发代理目标，仅本地使用 |
| `VITE_APP_SITE_URL` | 站点对外地址，用于 SEO 与分享卡片 |
| `VITE_APP_OG_IMAGE` | 分享卡片图片地址 |
| `VITE_APP_VERSION` | 构建版本，缺省读取仓库根目录 `VERSION` |

## 构建与预览

```bash
pnpm build          # 产物：playground/dist
pnpm preview
```

生产部署建议同域反向代理：Nginx 把 `/system-api` 与 `/api` 透传给后端，其余路径回退到 SPA 的 `index.html`。完整示例见文档仓。

## 多语言（强制）

新增任何用户可见文案时：

1. 在 `playground/src/locales/langs/zh-CN/*.json` 与 `en-US/*.json` 同步添加 key，两份结构必须对称。
2. 代码中用 `$t('namespace.key')` 引用，不要硬编码中文。
3. 路由 `meta.title` 存 i18n key 字符串，禁止预求值。

提交前可单独校验：

```bash
cd playground && node scripts/check-locales.mjs   # 期望输出 LOCALE_CHECK=PASS
```

`build` 与 `typecheck` 的前置脚本会自动执行该校验。

## 测试

```bash
pnpm test        # 单元测试 + Node 脚本测试
pnpm test:e2e    # Playwright 端到端测试
```

端到端测试需要可用的后端与测试账号，通过环境变量提供口令，不要在仓库里写死：

```bash
E2E_ADMIN_USERNAME=admin E2E_ADMIN_PASSWORD='<测试账号口令>' pnpm test:e2e
```

## 贡献

开发环境、i18n 规则与提交约定见 [CONTRIBUTING.md](./CONTRIBUTING.md)。安全问题请按 [SECURITY.md](./SECURITY.md) 私下报告。

## 许可证

本项目基于 [Vue Vben Admin](https://github.com/vbenjs/vue-vben-admin)（MIT）二次开发，采用 MIT 许可证，并保留上游版权声明，详见 [LICENSE](./LICENSE) 与 [NOTICE](./NOTICE)。