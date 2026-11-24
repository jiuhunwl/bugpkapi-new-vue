import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LinksPage from './index.vue';

const DEFAULT_LOGO_URL = vi.hoisted(() => '/brand-options/bugpk-icon.png');

const friendLinkApi = vi.hoisted(() => ({
  applyFriendLink: vi.fn(),
  getFriendLinkApplyStatus: vi.fn(),
  getPublicFriendLinkMeta: vi.fn(),
  getPublicFriendLinks: vi.fn(),
}));

const authApi = vi.hoisted(() => ({
  getCaptchaApi: vi.fn(),
  isCaptchaEnabled: vi.fn(),
  verifyCaptchaApi: vi.fn(),
}));

const accessState = vi.hoisted(() => ({ accessToken: 'test-token' }));

const brand = vi.hoisted(() => ({
  logoUrl: 'https://assets.example/validated-brand.svg',
}));

vi.mock('#/api/friend-link', () => friendLinkApi);
vi.mock('#/api/core/auth', () => authApi);
vi.mock('#/site-brand', () => ({
  DEFAULT_LOGO_URL,
  DEFAULT_SITE_NAME: 'BugPk-Api',
  useSiteBrand: () => brand,
}));
vi.mock('#/locales', () => ({
  $t: (key: string, values?: unknown[]) =>
    key === 'page.public.links.count' ? String(values?.[0]) : key,
}));
vi.mock('#/composables/use-public-site-theme', () => ({
  usePublicSiteTheme: () => ({ siteThemeVars: {} }),
}));
vi.mock('@vben/constants', () => ({ LOGIN_PATH: '/auth/login' }));
vi.mock('@vben/preferences', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vben/preferences')>();
  return {
    ...actual,
    preferences: { app: { locale: 'zh-CN' } },
  };
});
vi.mock('@vben/stores', () => ({
  useAccessStore: () => accessState,
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({ fullPath: '/links' }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@vben/icons', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    IconifyIcon: defineComponent({
      name: 'IconifyIcon',
      setup() {
        return () => h('i');
      },
    }),
  };
});
vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    message: {
      success: vi.fn(),
      warning: vi.fn(),
    },
    Modal: defineComponent({
      inheritAttrs: false,
      name: 'Modal',
      setup(_props, { slots }) {
        return () => h('div', { 'data-testid': 'modal' }, slots.default?.());
      },
    }),
  };
});

vi.mock('#/components/captcha-widget/CaptchaWidget.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      props: ['challenge', 'disabled'],
      emits: ['success'],
      setup(props, { emit }) {
        return () =>
          h(
            'button',
            {
              'data-testid': 'solve-captcha',
              disabled: props.disabled,
              onClick: () => emit('success', { time: '1' }),
            },
            'Solve captcha',
          );
      },
    }),
  };
});
vi.mock('#/components/public-site-footer.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      setup() {
        return () => h('div');
      },
    }),
  };
});
vi.mock('#/components/public-site-header.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      setup() {
        return () => h('div');
      },
    }),
  };
});

const mountedApps: Array<{ app: App; container: HTMLDivElement }> = [];

function pageMeta(logoUrl: string) {
  return {
    config: {
      applyEnabled: 1,
      applyNotice: '',
    },
    siteInfo: {
      description: 'Site description',
      logoUrl,
      siteName: 'Configured Site',
      siteUrl: 'https://site.example',
    },
  };
}

function mountPage() {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(LinksPage);
  app.mount(container);
  mountedApps.push({ app, container });
  return container;
}

async function flushUpdates() {
  for (let index = 0; index < 4; index += 1) {
    await Promise.resolve();
    await nextTick();
  }
}

function exchangeLogo(_container: HTMLElement) {
  return document.body.querySelector<HTMLImageElement>(
    '[data-apply-mode] .exchange-card-identity > img',
  );
}

async function openApplyPanel(container: HTMLElement) {
  container
    .querySelector<HTMLButtonElement>('[data-testid="friend-link-apply"]')
    ?.click();
  await flushUpdates();
}

describe('friend link page', () => {
  beforeEach(() => {
    accessState.accessToken = 'test-token';
    brand.logoUrl = 'https://assets.example/validated-brand.svg';
    friendLinkApi.getPublicFriendLinks.mockResolvedValue([]);
    friendLinkApi.getFriendLinkApplyStatus.mockResolvedValue({
      submitted: false,
    });
    friendLinkApi.getPublicFriendLinkMeta.mockResolvedValue(
      pageMeta('https://assets.example/raw-meta-logo.svg'),
    );
    authApi.getCaptchaApi.mockResolvedValue({
      captchaId: 'test-captcha',
      challenge: 'test-challenge',
      difficulty: 0,
      enabled: false,
      provider: 'pow',
      scene: 'friend_link_apply',
    });
    authApi.isCaptchaEnabled.mockReturnValue(false);
  });

  afterEach(() => {
    for (const { app, container } of mountedApps.splice(0)) {
      app.unmount();
      container.remove();
    }
    vi.resetAllMocks();
  });

  it('prefers the validated site brand over raw friend-link metadata', async () => {
    const container = mountPage();
    await flushUpdates();
    await openApplyPanel(container);

    expect(exchangeLogo(container)?.getAttribute('src')).toBe(
      'https://assets.example/validated-brand.svg',
    );
  });

  it('renders the brand mark when the unified brand is empty', async () => {
    brand.logoUrl = '';
    friendLinkApi.getPublicFriendLinkMeta.mockResolvedValue(pageMeta(''));

    const container = mountPage();
    await flushUpdates();
    await openApplyPanel(container);

    expect(exchangeLogo(container)?.getAttribute('src')).toBe(DEFAULT_LOGO_URL);
  });

  it('switches to the brand mark when the rendered brand fails', async () => {
    friendLinkApi.getPublicFriendLinkMeta.mockResolvedValue(
      pageMeta(brand.logoUrl),
    );
    const container = mountPage();
    await flushUpdates();
    await openApplyPanel(container);
    const logo = exchangeLogo(container);

    expect(logo).not.toBeNull();
    logo?.dispatchEvent(new Event('error'));
    await nextTick();

    expect(logo?.getAttribute('src')).toBe(DEFAULT_LOGO_URL);
  });
  it('shows an unknown count and disables applying while public data is loading', async () => {
    friendLinkApi.getPublicFriendLinks.mockReturnValueOnce(
      new Promise(() => {}),
    );
    const container = mountPage();
    await flushUpdates();

    expect(container.querySelector('.count-badge')?.textContent?.trim()).toBe(
      '—',
    );
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'page.public.links.loading',
    );
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-testid="friend-link-apply"]',
      )?.disabled,
    ).toBe(true);
  });

  it('shows a retryable error instead of a fabricated zero and recovers the directory', async () => {
    friendLinkApi.getPublicFriendLinks.mockRejectedValueOnce(
      new Error('offline'),
    );
    const container = mountPage();
    await flushUpdates();

    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'page.public.links.errorTitle',
    );
    expect(container.querySelector('.count-badge')?.textContent?.trim()).toBe(
      '—',
    );
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-testid="friend-link-apply"]',
      )?.disabled,
    ).toBe(true);

    friendLinkApi.getPublicFriendLinks.mockResolvedValueOnce([
      {
        id: '1',
        siteName: 'Recovered Partner',
        siteUrl: 'https://partner.example',
        status: 1,
      },
    ]);
    container.querySelector<HTMLButtonElement>('.directory-action')?.click();
    await flushUpdates();

    expect(
      container.querySelector('[data-friend-link]')?.textContent,
    ).toContain('Recovered Partner');
    expect(container.querySelector('.count-badge')?.textContent?.trim()).toBe(
      '1',
    );
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-testid="friend-link-apply"]',
      )?.disabled,
    ).toBe(false);
  });

  it('keeps public links available when the optional application-status request fails', async () => {
    friendLinkApi.getPublicFriendLinks.mockResolvedValueOnce([
      {
        id: '1',
        siteName: 'Available Partner',
        siteUrl: 'https://partner.example',
        status: 1,
      },
    ]);
    friendLinkApi.getFriendLinkApplyStatus.mockRejectedValueOnce(
      new Error('status unavailable'),
    );
    const container = mountPage();
    await flushUpdates();

    expect(
      container.querySelector('[data-friend-link]')?.textContent,
    ).toContain('Available Partner');
    expect(container.querySelector('.count-badge')?.textContent?.trim()).toBe(
      '1',
    );
  });

  it('shows a genuine zero only after the API confirms an empty directory', async () => {
    const container = mountPage();
    await flushUpdates();

    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'page.public.links.empty',
    );
    expect(container.querySelector('.count-badge')?.textContent?.trim()).toBe(
      '0',
    );
  });

  for (const outcome of ['success', 'failure'] as const) {
    it(
      'ignores an old captcha verification ' +
        outcome +
        ' after the application panel is reopened',
      async () => {
        const challenge = (captchaId: string) => ({
          captchaId,
          challenge: 'test-challenge',
          difficulty: 0,
          enabled: true,
          provider: 'pow',
          scene: 'friend_link_apply',
        });
        authApi.isCaptchaEnabled.mockReturnValue(true);
        authApi.getCaptchaApi
          .mockResolvedValueOnce(challenge('captcha-A'))
          .mockResolvedValueOnce(challenge('captcha-B'));
        let settleOld!: () => void;
        authApi.verifyCaptchaApi.mockImplementationOnce(
          () =>
            new Promise((resolve, reject) => {
              settleOld = () =>
                outcome === 'success'
                  ? resolve(true)
                  : reject(new Error('old verification failed'));
            }),
        );
        const container = mountPage();
        await flushUpdates();
        await openApplyPanel(container);
        document.body
          .querySelector<HTMLButtonElement>('[data-testid="solve-captcha"]')
          ?.click();
        await flushUpdates();
        expect(authApi.verifyCaptchaApi).toHaveBeenCalledWith(
          expect.objectContaining({ captchaId: 'captcha-A' }),
          { time: '1' },
        );

        document.body
          .querySelector('[role="dialog"]')
          ?.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
          );
        await flushUpdates();
        await openApplyPanel(container);
        settleOld();
        await flushUpdates();

        expect(
          document.body.querySelector<HTMLButtonElement>(
            '[data-testid="friend-link-submit"]',
          )?.disabled,
        ).toBe(true);
        expect(authApi.getCaptchaApi).toHaveBeenCalledTimes(2);
        authApi.verifyCaptchaApi.mockResolvedValueOnce(true);
        document.body
          .querySelector<HTMLButtonElement>('[data-testid="solve-captcha"]')
          ?.click();
        await flushUpdates();
        expect(authApi.verifyCaptchaApi).toHaveBeenLastCalledWith(
          expect.objectContaining({ captchaId: 'captcha-B' }),
          { time: '1' },
        );
        expect(
          document.body.querySelector<HTMLButtonElement>(
            '[data-testid="friend-link-submit"]',
          )?.disabled,
        ).toBe(false);
      },
    );
  }

  it('ignores a late captcha load from a closed application session', async () => {
    const enabledChallenge = {
      captchaId: 'captcha-B',
      challenge: 'test-challenge',
      difficulty: 0,
      enabled: true,
      provider: 'pow',
      scene: 'friend_link_apply',
    };
    let resolveOld!: (challenge: typeof enabledChallenge) => void;
    authApi.isCaptchaEnabled.mockImplementation(
      (challenge) => challenge.enabled,
    );
    authApi.getCaptchaApi
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce(enabledChallenge);
    const container = mountPage();
    await flushUpdates();
    await openApplyPanel(container);
    document.body
      .querySelector('[role="dialog"]')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    await flushUpdates();
    await openApplyPanel(container);
    resolveOld({ ...enabledChallenge, captchaId: 'captcha-A', enabled: false });
    await flushUpdates();

    expect(
      document.body.querySelector<HTMLButtonElement>(
        '[data-testid="friend-link-submit"]',
      )?.disabled,
    ).toBe(true);
    authApi.verifyCaptchaApi.mockResolvedValueOnce(true);
    document.body
      .querySelector<HTMLButtonElement>('[data-testid="solve-captcha"]')
      ?.click();
    await flushUpdates();
    expect(authApi.verifyCaptchaApi).toHaveBeenLastCalledWith(
      expect.objectContaining({ captchaId: 'captcha-B' }),
      { time: '1' },
    );
  });
});
