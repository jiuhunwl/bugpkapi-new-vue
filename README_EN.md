# BugPk-Api Web

[![CI](https://github.com/jiuhunwl/bugpkapi-new-vue/actions/workflows/ci.yml/badge.svg)](https://github.com/jiuhunwl/bugpkapi-new-vue/actions/workflows/ci.yml)

Open-source frontend for the BugPk-Api open API platform, covering both the customer-facing site and the admin console.

| Repository | Description |
| --- | --- |
| [bugpkapi-new-go](https://github.com/jiuhunwl/bugpkapi-new-go) | Backend service (Go + MySQL), AGPL-3.0 |
| **bugpkapi-new-vue** (this repo) | Frontend (Vue 3 + Vben Admin), MIT |
| [bugpkapi-new-docs](https://github.com/jiuhunwl/bugpkapi-new-docs) | Documentation, architecture and deployment guides |

## Features

- Customer site: sign-up/sign-in, API key management, plans and credits, checkout, call logs, announcements, tickets, agreements.
- Admin console: site and branding settings, APIs and groups, pricing and plans, orders and reconciliation, users and permissions, tickets, announcements, audit logs.
- Engineering: zh-CN / en-US locales, dark theme, responsive layout, role-based menus.

## Stack

Vue 3, TypeScript, Vite, Ant Design Vue, Pinia, Vben Admin workspace, pnpm 11 + Turborepo.

## Layout

```text
.
├── playground/        # main application (customer site + admin console)
├── packages/          # shared packages
├── internal/          # engineering configuration and tooling
├── apps/              # additional app entry points
└── scripts/           # repository-level scripts
```

## Getting started

Requirements: Node.js `^22.18.0 || ^24.0.0`, pnpm `>= 11`.

```bash
pnpm install
pnpm dev:play
```

The dev server runs on `http://127.0.0.1:5555` and proxies `/system-api` and `/api` to the backend at `http://127.0.0.1:8080`. Point it at another backend with an environment variable instead of editing defaults:

```bash
VITE_PROXY_TARGET=http://127.0.0.1:8080 pnpm dev:play
```

Backend bootstrap (create the database, import the init SQL, create the first administrator through environment variables) is described in the backend repository README.

### Key environment variables

| Variable | Purpose |
| --- | --- |
| `VITE_GLOB_API_URL` | Production request prefix; `/system-api` for same-origin deployments, absolute backend URL otherwise |
| `VITE_PROXY_TARGET` | Dev proxy target, local only |
| `VITE_APP_SITE_URL` | Public site URL used for SEO and share cards |
| `VITE_APP_OG_IMAGE` | Share card image URL |
| `VITE_APP_VERSION` | Build version; defaults to the repository `VERSION` file |

## Build and preview

```bash
pnpm build          # output: playground/dist
pnpm preview
```

For production prefer a same-origin reverse proxy: forward `/system-api` and `/api` to the backend, and fall back to the SPA `index.html` for everything else. Full examples live in the docs repository.

## Internationalization (required)

Whenever you add user-visible copy:

1. Add the key to both `playground/src/locales/langs/zh-CN/*.json` and `en-US/*.json`; both files must stay structurally symmetric.
2. Reference it with `$t('namespace.key')` — never hardcode Chinese text.
3. Route `meta.title` must hold the i18n key string, never a pre-evaluated `$t(...)` result.

Validate before committing:

```bash
cd playground && node scripts/check-locales.mjs   # expected: LOCALE_CHECK=PASS
```

`build` and `typecheck` run this check automatically.

## Tests

```bash
pnpm test        # unit tests + node script tests
pnpm test:e2e    # Playwright end-to-end tests
```

End-to-end tests need a running backend and a test account. Provide the password through an environment variable instead of hardcoding it:

```bash
E2E_ADMIN_USERNAME=admin E2E_ADMIN_PASSWORD='<test account password>' pnpm test:e2e
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development environment, i18n rules, and commit conventions. Report security issues privately as described in [SECURITY.md](./SECURITY.md).

## License

Built on top of [Vue Vben Admin](https://github.com/vbenjs/vue-vben-admin) (MIT) and distributed under the MIT license with upstream copyright notices preserved. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).