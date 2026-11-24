import { describe, expect, it } from 'vitest';

import { resolveFallbackName, toStem } from './icon-fallback-resolver';
import { resolveLocalIcon } from './iconify-icon';
import { hasOfflineIcon } from './offline-icon-registry';

/** 与运行时一致的「是否已注册」判定 */
const isRegistered = (candidate: string) =>
  Boolean(resolveLocalIcon(candidate)) || hasOfflineIcon(candidate);

describe('toStem', () => {
  it('剥离风格后缀', () => {
    expect(toStem('home-outline')).toBe('home');
    expect(toStem('account-cog-outline')).toBe('account-cog');
    expect(toStem('package-variant')).toBe('package');
    expect(toStem('shield-key-outline')).toBe('shield-key');
  });

  it('叠加后缀也能剥净', () => {
    expect(toStem('account-circle-outline-filled')).toBe('account-circle');
  });

  it('不会把有意义的名字剥空', () => {
    expect(toStem('user')).toBe('user');
    expect(toStem('database')).toBe('database');
  });
});

describe('resolveFallbackName', () => {
  it('跨图标集同名直取', () => {
    expect(resolveFallbackName('mdi:database', isRegistered)).toBe(
      'lucide:database',
    );
    expect(resolveFallbackName('carbon:search', isRegistered)).toBe(
      'lucide:search',
    );
  });

  it('剥离风格后缀后命中', () => {
    expect(resolveFallbackName('ion:person-outline', isRegistered)).toBe(
      'lucide:user',
    );
    expect(resolveFallbackName('mdi:menu-outline', isRegistered)).toBe(
      'lucide:menu',
    );
  });

  it('语义映射命中（不同图标集的习惯叫法）', () => {
    expect(resolveFallbackName('mdi:home', isRegistered)).toBe('lucide:house');
    expect(resolveFallbackName('mdi:cog', isRegistered)).toBe('lucide:settings');
    expect(resolveFallbackName('mdi:dashboard', isRegistered)).toBe(
      'lucide:layout-dashboard',
    );
    expect(resolveFallbackName('carbon:security', isRegistered)).toBe(
      'lucide:shield-check',
    );
  });

  it('修复扫描发现的真实回退项', () => {
    // 这些名字曾在仓库中使用但未注册，之前会渲染成空白
    const previouslyMissing = [
      'lucide:book-open-text',
      'mdi:keyboard-esc',
      'mdi:button-cursor',
      'mdi:cloud-key-outline',
      'mdi:page-previous-outline',
      'mdi:dashboard',
      'carbon:settings',
      'carbon:menu',
      'carbon:container-services',
      'carbon:data-center',
      'carbon:book',
      'carbon:hexagon-vertical-solid',
    ];
    for (const icon of previouslyMissing) {
      const resolved = resolveFallbackName(icon, isRegistered);
      expect(resolved, `${icon} 应能推断出已注册图标`).toBeTruthy();
      expect(isRegistered(resolved!), `${resolved} 必须已注册`).toBe(true);
    }
  });

  it('关键词兜底覆盖任意业务命名', () => {
    // 数据库里可能出现的自定义名字，语义映射表不可能穷举
    const cases: [string, string][] = [
      ['mdi:user-analytics-report', 'lucide:user'],
      ['mdi:payment-invoice-detail', 'lucide:circle-dollar-sign'],
      ['tabler:api-gateway-proxy', 'lucide:braces'],
      ['ri:ticket-support-center', 'lucide:headset'],
    ];
    for (const [icon, expected] of cases) {
      expect(resolveFallbackName(icon, isRegistered)).toBe(expected);
    }
  });

  it('无从推断时返回 undefined，不渲染图标', () => {
    expect(resolveFallbackName('mdi:zzzz-qqqq-xxxx', isRegistered)).toBeUndefined();
    expect(resolveFallbackName('', isRegistered)).toBeUndefined();
    expect(resolveFallbackName('noprefix', isRegistered)).toBeUndefined();
  });

  it('推断结果必定是已注册图标（不会二次回退）', () => {
    const samples = [
      'mdi:account-cog-outline',
      'ion:settings-sharp',
      'carbon:data-center',
      'mdi:web-sync',
      'mdi:cash-plus',
    ];
    for (const icon of samples) {
      const resolved = resolveFallbackName(icon, isRegistered);
      if (resolved) {
        expect(isRegistered(resolved)).toBe(true);
      }
    }
  });
});
