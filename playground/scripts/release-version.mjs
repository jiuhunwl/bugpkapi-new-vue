import { existsSync, readFileSync } from 'node:fs';

import { validateNotes } from '../../scripts/release-policy.mjs';

const versionUrl = [
  new URL('../../VERSION', import.meta.url),
  new URL('../../../VERSION', import.meta.url),
].find((candidate) => existsSync(candidate));

if (!versionUrl) {
  throw new Error('VERSION not found in any known layout');
}

const notesUrl = new URL('../src/data/releases.json', import.meta.url);

function repositoryVersion() {
  return readFileSync(versionUrl, 'utf8').trim();
}

function releaseNotes() {
  return JSON.parse(readFileSync(notesUrl, 'utf8'));
}

/**
 * Resolve the version used by the app and enforce the repository release rules.
 *
 * Build callers pass process.env so .env's development value cannot override
 * VERSION. Non-build callers pass Vite's loaded environment, which preserves
 * the normal development version from .env.
 */
export function resolveReleaseVersion({ command, env = process.env } = {}) {
  if (command !== 'build') {
    return String(env.VITE_APP_VERSION || 'v0.0.0-dev').trim();
  }

  const version = String(env.VITE_APP_VERSION || repositoryVersion())
    .trim()
    .replace(/^v/, '');

  if (
    !/^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/.test(version) ||
    version.includes('..')
  ) {
    throw new Error(`Invalid release version: ${version}`);
  }

  const expected = repositoryVersion().replace(/^v/, '');
  if (version !== expected) {
    throw new Error('Build version must match VERSION');
  }

  validateNotes(version, releaseNotes());
  return `v${version}`;
}
