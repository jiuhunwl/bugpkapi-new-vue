# 贡献指南

感谢参与 BugPk-Api。本文件适用于前端仓库（Vue 3 + Vben workspace）；后端请同时阅读其仓库的 `CONTRIBUTING.md`。

## 开发环境

- Node.js `^22.18.0 || ^24.0.0`（仓库 `.node-version` 固定为 24）
- pnpm `>= 11`

## 本地启动

```bash
pnpm install
pnpm dev:play
```

开发服务器默认运行在 `http://127.0.0.1:5555`，并把 `/system-api`、`/api` 代理到 `http://127.0.0.1:8080`。连接其他后端时：

```bash
VITE_PROXY_TARGET=http://127.0.0.1:8080 pnpm dev:play
```

## i18n（强制）

1. 任何用户可见文案都必须在 `playground/src/locales/langs/zh-CN/*.json` 与 `en-US/*.json` 同步添加 key，两份结构必须完全对称。
2. 代码中通过 `$t('namespace.key')` 引用，禁止硬编码中文或英文。
3. 路由 `meta.title` 存 i18n key 字符串，禁止 `title: $t('...')` 预求值。
4. 模块级常量禁止调用 `$t()`，否则语言切换后不会更新。

提交前校验：

```bash
cd playground && node scripts/check-locales.mjs   # 期望 LOCALE_CHECK=PASS
```

`build` 与 `typecheck` 的前置脚本会自动执行该校验。

## 代码约定

- 组件与组合式函数优先使用 `<script setup lang="ts">`，类型显式声明。
- 请求统一走 `playground/src/api`，不要在组件里直接拼 URL。
- 新增页面需同时处理空态、加载态与错误态，并保证窄屏可用。
- 提交前执行：

```bash
pnpm build
pnpm test
```

端到端测试需要可用的后端与测试账号：

```bash
E2E_ADMIN_USERNAME=admin E2E_ADMIN_PASSWORD='<测试账号口令>' pnpm test:e2e
```

## 提交与 PR

- 提交信息使用 Conventional Commits，例如 `feat(console): 接口降级策略编辑`、`fix(i18n): 补齐英文菜单标题`。
- PR 描述中说明改动范围、验证命令与截图（涉及 UI 时）。
- 确认未提交 `.env`、证书、真实接口地址或用户数据。
- 安全问题不要开公开 Issue，按 `SECURITY.md` 私下报告。

## 许可证

提交即表示你同意以 [MIT](./LICENSE) 授权你的贡献；上游 Vue Vben Admin 的版权声明见 [NOTICE](./NOTICE)。
