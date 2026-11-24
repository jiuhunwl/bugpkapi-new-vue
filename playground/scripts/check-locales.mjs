import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const playgroundRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = dirname(playgroundRoot);
const sourceRoot = join(playgroundRoot, 'src');
const localeRoots = [
  join(workspaceRoot, 'packages', 'locales', 'src', 'langs'),
  join(sourceRoot, 'locales', 'langs'),
];
const locales = ['en-US', 'zh-CN'];
const sourceExtensions = new Set(['.ts', '.tsx', '.vue']);
const ignoredSourceSegments = [
  '/router/routes/modules/demos.ts',
  '/views/demos/',
  '/views/examples/',
];
const staticTranslationPattern = /\$t\(\s*(['"])([^'"\r\n]+)\1/g;

async function listFiles(root, predicate) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listFiles(path, predicate)));
    } else if (predicate(path)) {
      result.push(path);
    }
  }
  return result;
}

async function loadMessages(locale) {
  const messages = {};
  for (const root of localeRoots) {
    const localeRoot = join(root, locale);
    for (const path of await listFiles(localeRoot, (file) => extname(file) === '.json')) {
      const namespace = relative(localeRoot, path)
        .replaceAll('\\', '/')
        .replace(/\.json$/, '');
      messages[namespace] = JSON.parse(await readFile(path, 'utf8'));
    }
  }
  return messages;
}

function hasKey(messages, key) {
  const [namespace, ...segments] = key.split('.');
  let current = messages[namespace];
  if (current === undefined) return false;
  for (const segment of segments) {
    if (
      current === null ||
      typeof current !== 'object' ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return false;
    }
    current = current[segment];
  }
  return true;
}

const messagesByLocale = Object.fromEntries(
  await Promise.all(
    locales.map(async (locale) => [locale, await loadMessages(locale)]),
  ),
);
const sourceFiles = await listFiles(
  sourceRoot,
  (path) =>
    sourceExtensions.has(extname(path)) &&
    !ignoredSourceSegments.some((segment) =>
      path.replaceAll('\\', '/').includes(segment),
    ),
);
const failures = [];

for (const path of sourceFiles) {
  const source = await readFile(path, 'utf8');
  for (const match of source.matchAll(staticTranslationPattern)) {
    const key = match[2];
    if (!key || key.includes('${')) continue;
    for (const locale of locales) {
      if (!hasKey(messagesByLocale[locale], key)) {
        const line = source.slice(0, match.index).split(/\r?\n/).length;
        failures.push(
          relative(playgroundRoot, path) +
            ':' +
            line +
            ' [' +
            locale +
            '] ' +
            key,
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error('LOCALE_CHECK=FAIL');
  for (const failure of failures) console.error('- ' + failure);
  process.exitCode = 1;
} else {
  console.log(
    'LOCALE_CHECK=PASS files=' +
      sourceFiles.length +
      ' locales=' +
      locales.length,
  );
}
