import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageDirectory = fileURLToPath(new URL('..', import.meta.url));

const steps = [
  [require.resolve('tsdown/run'), ['--no-dts']],
  [
    require.resolve('typescript/bin/tsc'),
    [
      '-p',
      'tsconfig.build.json',
      '--emitDeclarationOnly',
      '--declaration',
      '--outDir',
      'dist',
    ],
  ],
];

for (const [entrypoint, args] of steps) {
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd: packageDirectory,
    shell: false,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
