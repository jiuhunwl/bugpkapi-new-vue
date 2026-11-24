# @bugpk-api/vsh

BugPk-Api frontend workspace shell helper collection.

## Features

- Node.js based workspace helper scripts.
- Dependency checks for local frontend development.
- Circular dependency scanning.
- Package publishing preflight checks for internal tooling.

## Usage

Run the helper commands from the `vue-vben-admin` workspace.

```bash
pnpm vsh [command]
```

## Commands

- `vsh check-deps`: Check workspace dependencies.
- `vsh scan-circular`: Scan circular dependencies.
- `vsh publish-check`: Check package publishing configuration.
