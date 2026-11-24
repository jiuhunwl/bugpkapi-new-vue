import { createApp, h, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import LoadingPresetAnimation from './loading-preset-animation.vue';

/**
 * 回归护栏：启动 / 全局加载动画的每个预设都必须渲染「语义专属图标」，
 * 不得再出现 BP 渐变字母块（历史遗留的统一字母标）。
 *
 * 背景：用户明确要求彻底删除 BP 字母块，每个控件用自己的图标。
 * 一旦有人在某个预设里重新写死 "BP" 文本，这条测试会失败。
 */

const mountedHosts: HTMLDivElement[] = [];

async function render(props: Record<string, unknown>) {
  const host = document.createElement('div');
  document.body.append(host);
  mountedHosts.push(host);
  createApp({
    setup: () => () => h(LoadingPresetAnimation, props),
  }).mount(host);
  await nextTick();
  await nextTick();
  return host;
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const host of mountedHosts.splice(0)) host.remove();
});

/** 收集所有「纯文本为 BP」的叶子元素 */
function bpTextLeaves(host: HTMLElement) {
  return [...host.querySelectorAll('*')].filter(
    (el) =>
      el.children.length === 0 && /^BP$/.test((el.textContent || '').trim()),
  );
}

const SPLASH_PRESETS = ['forge', 'gateway', 'orbit', 'scan', 'rail', 'dots'];
const LOADING_PRESETS = [
  'bar',
  'ring',
  'skeleton',
  'packet',
  'logo',
  'dots',
];

describe('loading preset animation — 无字母块残留', () => {
  for (const preset of SPLASH_PRESETS) {
    it(`splash「${preset}」不渲染 BP 字母块`, async () => {
      const host = await render({ kind: 'splash', splashPreset: preset });
      expect(bpTextLeaves(host)).toHaveLength(0);
    });
  }

  for (const preset of LOADING_PRESETS) {
    it(`loading「${preset}」不渲染 BP 字母块`, async () => {
      const host = await render({ kind: 'loading', loadingPreset: preset });
      expect(bpTextLeaves(host)).toHaveLength(0);
    });
  }
});

describe('loading preset animation — 语义图标', () => {
  const cases: [string, string, string][] = [
    ['splash', 'forge', '.bp-sp__mark svg'],
    ['splash', 'scan', '.bp-sp__scan svg'],
    ['splash', 'rail', '.bp-sp__mini svg'],
    ['loading', 'logo', '.bp-ld__logo svg'],
  ];

  for (const [kind, preset, selector] of cases) {
    it(`${kind}「${preset}」渲染专属图标(${selector})`, async () => {
      const host = await render(
        kind === 'splash'
          ? { kind, splashPreset: preset }
          : { kind, loadingPreset: preset },
      );
      expect(host.querySelector(selector)).not.toBeNull();
    });
  }
});

describe('loading preset animation — 品牌名保留', () => {
  it('splash 仍展示站点名与状态文案', async () => {
    const host = await render({
      kind: 'splash',
      siteName: 'BugPk-Api',
      splashPreset: 'gateway',
    });
    expect(host.textContent).toContain('BugPk-Api');
  });
});
