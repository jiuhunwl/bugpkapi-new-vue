import { afterEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent } from 'vue';

import { usePublicSeo } from './use-public-seo';

describe('usePublicSeo', () => {
  afterEach(() => {
    document.head
      .querySelectorAll('meta[name="robots"], link[rel="canonical"]')
      .forEach((element) => element.remove());
  });

  it('restores absent head attributes instead of leaving empty metadata', () => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.append(robots, canonical);

    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(
      defineComponent({
        setup() {
          usePublicSeo({ canonicalPath: '/', noindex: true });
          return () => null;
        },
      }),
    );

    app.mount(host);
    expect(robots.getAttribute('content')).toBe('noindex, nofollow');
    expect(canonical.getAttribute('href')).toBeTruthy();

    app.unmount();
    expect(robots.hasAttribute('content')).toBe(false);
    expect(canonical.hasAttribute('href')).toBe(false);
    host.remove();
  });
});
