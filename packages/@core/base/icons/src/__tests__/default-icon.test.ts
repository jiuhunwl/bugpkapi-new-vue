import type { App } from 'vue';

import { createApp, h, nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import VbenIcon from '../../../../ui-kit/shadcn-ui/src/components/icon/icon.vue';

const mounted: Array<{ app: App; host: HTMLDivElement }> = [];

async function renderIcon(props: { fallback?: boolean; icon?: string }) {
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({
    render: () => h(VbenIcon, { ...props, class: 'menu-icon', 'data-testid': 'icon' }),
  });
  app.mount(host);
  mounted.push({ app, host });
  await nextTick();
  return host;
}

afterEach(() => {
  for (const { app, host } of mounted.splice(0)) {
    app.unmount();
    host.remove();
  }
});

describe('Vben default functional icon', () => {
  it('renders a theme-inheriting line icon when a menu has no configured icon', async () => {
    const host = await renderIcon({ fallback: true });
    const svg = host.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('fill')).toBe('none');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    expect(svg?.classList.contains('menu-icon')).toBe(true);
    expect(svg?.getAttribute('data-testid')).toBe('icon');
    expect(host.querySelector('linearGradient, radialGradient')).toBeNull();
    expect(host.querySelector('[fill^="url("], [fill^="#"]')).toBeNull();
  });

  it('preserves the configured semantic icon instead of using the fallback', async () => {
    const host = await renderIcon({ fallback: true, icon: 'lucide:settings' });
    expect(host.querySelector('svg.lucide-settings')).not.toBeNull();
    expect(host.querySelector('svg.lucide-menu')).toBeNull();
  });

  it('does not add a default icon when the caller disables fallback', async () => {
    const host = await renderIcon({ fallback: false });
    expect(host.querySelector('svg')).toBeNull();
  });
});
