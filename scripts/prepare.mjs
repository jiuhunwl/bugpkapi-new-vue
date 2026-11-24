import { spawnSync } from 'node:child_process';

const gitCheck = spawnSync(
  'git',
  ['rev-parse', '--is-inside-work-tree'],
  { encoding: 'utf8', shell: false },
);

if (gitCheck.status !== 0 || gitCheck.stdout.trim() !== 'true') {
  console.log('[prepare] Git metadata is unavailable; skipping Lefthook install.');
  process.exit(0);
}

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const hookInstall = spawnSync(
  pnpmCommand,
  ['exec', 'lefthook', 'install'],
  { shell: false, stdio: 'inherit' },
);

process.exit(hookInstall.status ?? 1);
