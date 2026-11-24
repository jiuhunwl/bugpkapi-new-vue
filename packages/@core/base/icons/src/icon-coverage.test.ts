import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveFallbackName } from './icon-fallback-resolver';
import { resolveLocalIcon } from './iconify-icon';
import { hasOfflineIcon } from './offline-icon-registry';

/**
 * 回归护栏：扫描 playground 真实使用到的图标名，断言全部能解析出图标，
 * 不会出现空白图标。新增页面写了没注册的图标名时，这条测试会失败。
 */

const PLAYGROUND_SRC = join(
  import.meta.dirname,
  '../../../../../playground/src',
);

const ICON_PREFIXES =
  /^(?:ant-design|bx|carbon|ep|fluent-mdl2|ic|ion|logos|lucide|material-symbols|mdi|ri|simple-icons|solar|tabler):/;

/** 图标名字面量：'lucide:user' / "mdi:account-cog-outline" */
const ICON_LITERAL =
  /["'`]([a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*)["'`]/g;

function collectSourceFiles(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/coverage|dist|node_modules/.test(entry.name)) {
        collectSourceFiles(full, out);
      }
    } else if (
      /\.(?:ts|vue)$/.test(entry.name) &&
      !/\.(?:spec|test)\.ts$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

/** 与 IconifyIcon 运行时完全一致的解析链 */
function isRenderable(icon: string) {
  if (resolveLocalIcon(icon) || hasOfflineIcon(icon)) {
    return true;
  }
  const inferred = resolveFallbackName(
    icon,
    (candidate) => Boolean(resolveLocalIcon(candidate)) || hasOfflineIcon(candidate),
  );
  return Boolean(inferred);
}

describe('playground 图标覆盖率', () => {
  const files = collectSourceFiles(PLAYGROUND_SRC);
  const used = new Map<string, Set<string>>();

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(ICON_LITERAL)) {
      const icon = match[1]!;
      if (!ICON_PREFIXES.test(icon)) continue;
      if (!used.has(icon)) used.set(icon, new Set());
      used.get(icon)!.add(relative(PLAYGROUND_SRC, file).replaceAll('\\', '/'));
    }
  }

  it('扫描到足够多的图标名（确保扫描逻辑有效）', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(used.size).toBeGreaterThan(80);
  });

  it('所有使用到的图标名都能渲染出真实图标', () => {
    const unresolved = [...used.entries()]
      .filter(([icon]) => !isRenderable(icon))
      .map(([icon, where]) => `${icon}  ←  ${[...where].slice(0, 3).join(', ')}`);

    expect(
      unresolved,
      `以下图标名无法渲染（会显示为空白），请在 iconify-icon.ts 注册或在 icon-fallback-resolver.ts 补映射：\n${unresolved.join('\n')}`,
    ).toEqual([]);
  });
});
