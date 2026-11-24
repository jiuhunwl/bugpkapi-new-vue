import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const nodeSuites = [
  'scripts/release-policy.test.mjs',
  'playground/scripts/legal-content.test.mjs',
  'playground/scripts/release-version.test.mjs',
];

// release-version loads the real Vite configuration. Prepare only its local
// helper packages, in dependency order, before starting the Node test runner.
const steps = [
  {
    args: [
      fileURLToPath(
        new URL('../internal/node-utils/scripts/build.mjs', import.meta.url),
      ),
    ],
    cwd: repositoryRoot,
  },
  {
    args: [require.resolve('tsdown/run')],
    cwd: fileURLToPath(new URL('../internal/vite-config/', import.meta.url)),
  },
  {
    args: [
      '--test',
      ...nodeSuites.map((path) =>
        fileURLToPath(new URL(`../${path}`, import.meta.url)),
      ),
    ],
    cwd: repositoryRoot,
  },
];

for (const { args, cwd } of steps) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    shell: false,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
