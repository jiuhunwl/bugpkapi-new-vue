import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { resolveReleaseVersion } from './release-version.mjs';

const playgroundRoot = fileURLToPath(new URL('../', import.meta.url));
const versionUrl = [
  new URL('../../VERSION', import.meta.url),
  new URL('../../../VERSION', import.meta.url),
].find((candidate) => existsSync(candidate));
const releaseVersion = readFileSync(versionUrl, 'utf8').trim();

// Load the real Vite config in a fresh process so dotenv/process.env mutations
// cannot leak between cases. No app build or backend is needed for this check.
function loadBuildConfig(version, command = 'build', mode = 'production') {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.VITE_APP_VERSION;
  if (version !== undefined) env.VITE_APP_VERSION = version;
  return spawnSync(
    process.execPath,
    [fileURLToPath(import.meta.url), '--inspect-config', command, mode],
    {
      cwd: playgroundRoot,
      env,
      encoding: 'utf8',
      killSignal: 'SIGKILL',
      windowsHide: true,
      timeout: 120_000,
    },
  );
}

function expectVersion(result, expected) {
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const line = result.stdout
    .split(/\r?\n/)
    .find((value) => value.startsWith('RELEASE_VERSION='));
  assert.ok(line, result.stdout);
  assert.deepEqual(JSON.parse(line.slice('RELEASE_VERSION='.length)), {
    about: expected,
    metadata: expected,
    env: expected,
  });
}

if (process.argv[2] === '--inspect-config') {
  const { resolveConfig } = await import('vite');
  const command = process.argv[3];
  const mode = process.argv[4];
  const config = await resolveConfig(
    {
      configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
      configLoader: 'runner',
      root: playgroundRoot,
    },
    command,
    mode,
  );
  await new Promise((resolve) =>
    process.stdout.write(
      'RELEASE_VERSION=' +
        JSON.stringify({
          about: JSON.parse(config.define['import.meta.env.VITE_APP_VERSION']),
          metadata: JSON.parse(config.define.__VBEN_ADMIN_METADATA__).version,
          env: config.env.VITE_APP_VERSION,
        }) +
        '\n',
      resolve,
    ),
  );
  // Development plugins can retain workers/timers after configuration loading.
  // This child only inspects configuration, so finish after flushing its result.
  process.exit(0);
} else {
  test('production build uses repository VERSION instead of stale dotenv version', () => {
    expectVersion(loadBuildConfig(), 'v' + releaseVersion.replace(/^v/, ''));
  });

  test('explicit packaging version cannot bypass VERSION and release notes', () => {
    assert.throws(
      () => resolveReleaseVersion({
        command: 'build',
        env: { VITE_APP_VERSION: 'v9.8.7-rc.2' },
      }),
      /must match VERSION/,
    );
  });

  test('build normalizes whitespace and a missing v prefix', () => {
    assert.equal(
      resolveReleaseVersion({
        command: 'build',
        env: { VITE_APP_VERSION: ' ' + releaseVersion + ' ' },
      }),
      'v' + releaseVersion,
    );
  });

  test('analyze builds use the same repository release version', () => {
    expectVersion(
      loadBuildConfig(undefined, 'build', 'analyze'),
      'v' + releaseVersion.replace(/^v/, ''),
    );
  });

  test('development keeps its dev version', () => {
    expectVersion(
      loadBuildConfig(undefined, 'serve', 'development'),
      'v0.0.0-dev',
    );
  });

  test('build rejects invalid release versions rather than packaging them', () => {
    assert.throws(
      () => resolveReleaseVersion({
        command: 'build',
        env: { VITE_APP_VERSION: '1..2' },
      }),
      /Invalid release version/,
    );
  });

  for (const task of ['build', 'build:analyze']) {
    test(`${task} does not reuse cached outputs with an external VERSION file`, () => {
      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(
            new URL('../../node_modules/turbo/bin/turbo', import.meta.url),
          ),
          'run',
          task,
          '--filter=@vben/playground',
          '--dry=json',
        ],
        {
          cwd: fileURLToPath(new URL('../../', import.meta.url)),
          encoding: 'utf8',
          windowsHide: true,
        },
      );
      assert.equal(result.status, 0, result.stderr);
      const run = JSON.parse(result.stdout);
      const appTask = run.tasks.find(
        (item) => item.taskId === `@vben/playground#${task}`,
      );
      assert.equal(appTask.resolvedTaskDefinition.cache, false);
    });
  }
}
