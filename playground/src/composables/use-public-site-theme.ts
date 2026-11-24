import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watchEffect,
} from 'vue';

import { usePreferences, preferencesManager } from '@vben/preferences';

import { $t } from '#/locales';

interface PublicThemeOption {
  accent: string;
  color: string;
  key: string;
  mapColors: string[];
  name: string;
  rgb: string;
  soft: string;
}

interface PublicThemeDefinition extends Omit<PublicThemeOption, 'name'> {
  nameKey: string;
}

const THEME_STORAGE_KEY = 'bugpk_api_home_theme';

const lightToneVars = {
  '--home-background': '#f5f7fc',
  '--home-background-mid': '#eef2f9',
  '--home-border': 'rgba(15, 23, 42, 0.1)',
  '--home-border-strong': 'rgba(15, 23, 42, 0.18)',
  '--home-chip-background': 'rgba(15, 23, 42, 0.05)',
  '--home-code-background': '#0d152b',
  '--home-code-background-soft': '#16203a',
  '--home-code-border': 'rgba(148, 163, 184, 0.25)',
  '--home-code-header': '#16203a',
  '--home-code-line-number': 'rgb(15 23 42 / 32%)',
  '--home-code-muted': '#8a93a8',
  '--home-code-scrollbar': '#475569 #0d152b',
  '--home-code-text': '#c9d4ee',
  '--home-contrast-chip-background': '#0c1428',
  '--home-danger': '#dc2626',
  '--home-danger-soft': 'rgba(220, 38, 38, 0.1)',
  '--home-focus-ring': 'rgba(53, 101, 232, 0.35)',
  '--home-grid-line': 'rgba(15, 23, 42, 0.05)',
  '--home-heading': '#0c1428',
  '--home-image-background': '#fff',
  '--home-inset-highlight': 'rgb(255 255 255 / 75%)',
  '--home-mask': 'rgb(15 23 42 / 60%)',
  '--home-muted': '#4a5670',
  '--home-shadow': 'rgba(23, 43, 99, 0.1)',
  '--home-shadow-hover': 'rgba(23, 43, 99, 0.16)',
  '--home-shadow-menu': 'rgba(23, 43, 99, 0.14)',
  '--home-shadow-soft': 'rgba(23, 43, 99, 0.06)',
  '--home-success': '#059669',
  '--home-success-soft': 'rgba(5, 150, 105, 0.1)',
  '--home-subtle': '#4a5670',
  '--home-surface': 'rgba(255, 255, 255, 0.75)',
  '--home-surface-popover': '#fff',
  '--home-surface-strong': 'rgba(255, 255, 255, 0.92)',
  '--home-surface-soft': 'rgba(255, 255, 255, 0.74)',
  '--home-surface-subtle': 'rgba(255, 255, 255, 0.7)',
  '--home-text': '#0c1428',
  '--home-text-3': '#8a93a8',
  '--home-text-faint': '#8a93a8',
  '--home-topbar-background': 'rgba(255, 255, 255, 0.85)',
  '--home-warning': '#d97706',
  '--home-warning-soft': 'rgba(217, 119, 6, 0.1)',
  // ---- 新设计语言：极光渐变 / 发光 / 玻璃 ----
  '--home-grad': 'linear-gradient(120deg, #2f6bff 0%, #7c3aed 52%, #0891b2 100%)',
  '--home-grad-soft':
    'linear-gradient(120deg, rgba(47, 107, 255, 0.1), rgba(124, 58, 237, 0.08), rgba(8, 145, 178, 0.08))',
  '--home-glow': '0 0 70px rgba(47, 107, 255, 0.16)',
  '--home-card-shadow': '0 16px 40px rgba(23, 43, 99, 0.1)',
};

const darkToneVars = {
  '--home-background': '#070b16',
  '--home-background-mid': '#0b1122',
  '--home-border': 'rgba(148, 163, 184, 0.16)',
  '--home-border-strong': 'rgba(148, 163, 184, 0.28)',
  '--home-chip-background': 'rgba(255, 255, 255, 0.045)',
  '--home-code-background': '#0a0f1e',
  '--home-code-background-soft': '#111a30',
  '--home-code-border': 'rgba(148, 163, 184, 0.18)',
  '--home-code-header': '#111a30',
  '--home-code-line-number': 'rgb(2 6 23 / 56%)',
  '--home-code-muted': '#8a93a8',
  '--home-code-scrollbar': '#475569 #0a0f1e',
  '--home-code-text': '#c9d4ee',
  '--home-contrast-chip-background': 'rgb(var(--home-primary-rgb) / 72%)',
  '--home-danger': '#f87171',
  '--home-danger-soft': 'rgba(248, 113, 113, 0.12)',
  '--home-focus-ring': 'rgba(91, 140, 255, 0.4)',
  '--home-grid-line': 'rgba(148, 163, 184, 0.07)',
  '--home-heading': '#eaeef8',
  '--home-image-background': 'rgb(255 255 255 / 94%)',
  '--home-inset-highlight': 'rgba(255, 255, 255, 0.06)',
  '--home-mask': 'rgb(7 11 22 / 76%)',
  '--home-muted': '#a7b0c2',
  '--home-shadow': 'rgba(2, 6, 18, 0.55)',
  '--home-shadow-hover': 'rgba(2, 6, 18, 0.65)',
  '--home-shadow-menu': 'rgba(2, 6, 18, 0.6)',
  '--home-shadow-soft': 'rgba(2, 6, 18, 0.4)',
  '--home-success': '#34d399',
  '--home-success-soft': 'rgba(52, 211, 153, 0.12)',
  '--home-subtle': '#a7b0c2',
  '--home-surface': 'rgba(13, 20, 40, 0.82)',
  '--home-surface-popover': '#0b1122',
  '--home-surface-strong': 'rgba(13, 20, 40, 0.82)',
  '--home-surface-soft': 'rgba(255, 255, 255, 0.04)',
  '--home-surface-subtle': 'rgba(255, 255, 255, 0.045)',
  '--home-text': '#eaeef8',
  '--home-text-3': '#6b7590',
  '--home-text-faint': '#6b7590',
  '--home-topbar-background': 'rgba(13, 20, 40, 0.82)',
  '--home-warning': '#fbbf24',
  '--home-warning-soft': 'rgba(251, 191, 36, 0.12)',
  // ---- 新设计语言：极光渐变 / 发光 / 玻璃 ----
  '--home-grad': 'linear-gradient(120deg, #4f8cff 0%, #8b5cf6 52%, #22d3ee 100%)',
  '--home-grad-soft':
    'linear-gradient(120deg, rgba(79, 140, 255, 0.16), rgba(139, 92, 246, 0.14), rgba(34, 211, 238, 0.12))',
  '--home-glow': '0 0 80px rgba(91, 140, 255, 0.22)',
  '--home-card-shadow': '0 18px 50px rgba(2, 6, 18, 0.55)',
};

const themeDefinitions: PublicThemeDefinition[] = [
  {
    accent: '#3565e8',
    color: '#5b8cff',
    key: 'blue',
    mapColors: ['#eaf2fb', '#d9e9fb', '#afd3ff', '#6aa9ff', '#5b8cff'],
    nameKey: 'page.public.theme.colors.blue',
    rgb: '91 140 255',
    soft: 'rgba(91, 140, 255, 0.12)',
  },
  {
    accent: '#7c3aed',
    color: '#6d5dfc',
    key: 'violet',
    mapColors: ['#f1efff', '#e4ddff', '#c7b8ff', '#9b7dff', '#6d5dfc'],
    nameKey: 'page.public.theme.colors.violet',
    rgb: '109 93 252',
    soft: '#f3f0ff',
  },
  {
    accent: '#e11d48',
    color: '#f0446e',
    key: 'rose',
    mapColors: ['#fff1f4', '#ffdce5', '#ffb4c5', '#fb7185', '#f0446e'],
    nameKey: 'page.public.theme.colors.rose',
    rgb: '240 68 110',
    soft: '#fff1f4',
  },
  {
    accent: '#f59e0b',
    color: '#f6b73c',
    key: 'amber',
    mapColors: ['#fff8e7', '#ffedbd', '#fed77a', '#fbbf24', '#f59e0b'],
    nameKey: 'page.public.theme.colors.amber',
    rgb: '246 183 60',
    soft: '#fff8e7',
  },
  {
    accent: '#4f46e5',
    color: '#6366f1',
    key: 'indigo',
    mapColors: ['#eef2ff', '#dfe6ff', '#bdc9ff', '#818cf8', '#6366f1'],
    nameKey: 'page.public.theme.colors.indigo',
    rgb: '99 102 241',
    soft: '#eef2ff',
  },
  {
    accent: '#059669',
    color: '#10b981',
    key: 'green',
    mapColors: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#34d399', '#10b981'],
    nameKey: 'page.public.theme.colors.green',
    rgb: '16 185 129',
    soft: '#ecfdf5',
  },
  {
    accent: '#111827',
    color: '#374151',
    key: 'slate',
    mapColors: ['#f1f5f9', '#e2e8f0', '#cbd5e1', '#64748b', '#334155'],
    nameKey: 'page.public.theme.colors.slate',
    rgb: '55 65 81',
    soft: '#f1f5f9',
  },
];

function toPublicThemeOption(
  definition: PublicThemeDefinition,
): PublicThemeOption {
  const { nameKey, ...theme } = definition;
  return {
    ...theme,
    name: $t(nameKey),
  };
}

function getInitialThemeKey() {
  if (typeof localStorage === 'undefined') {
    return themeDefinitions[0]!.key;
  }
  const cached = localStorage.getItem(THEME_STORAGE_KEY);
  return themeDefinitions.some((item) => item.key === cached)
    ? cached!
    : themeDefinitions[0]!.key;
}

const selectedTheme = shallowRef(getInitialThemeKey());

const activeThemeDefinition = computed(
  () =>
    themeDefinitions.find((item) => item.key === selectedTheme.value) ??
    themeDefinitions[0]!,
);

const activeTheme = computed(() =>
  toPublicThemeOption(activeThemeDefinition.value),
);

const themeOptions = computed(() => themeDefinitions.map(toPublicThemeOption));

const baseThemeVars = computed(() => ({
  '--ps-primary': activeThemeDefinition.value.color,
  '--ps-primary-rgb': activeThemeDefinition.value.rgb,
  '--home-accent': activeThemeDefinition.value.accent,
  '--home-primary': activeThemeDefinition.value.color,
  '--home-primary-rgb': activeThemeDefinition.value.rgb,
  '--home-soft': activeThemeDefinition.value.soft,
  '--home-primary-soft': activeThemeDefinition.value.soft,
}));

watchEffect(() => {
  if (typeof document === 'undefined') {
    return;
  }
  for (const [key, value] of Object.entries(baseThemeVars.value)) {
    document.documentElement.style.setProperty(key, value);
  }
});

function setSiteTheme(key: string) {
  if (!themeDefinitions.some((item) => item.key === key)) {
    return;
  }
  selectedTheme.value = key;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, key);
  }
}

function useDocumentDarkClass() {
  const hasDarkSignal = shallowRef(false);
  let observer: MutationObserver | null = null;
  let bodyObserver: MutationObserver | null = null;
  let mediaQuery: MediaQueryList | null = null;

  function syncDarkClass() {
    if (typeof document === 'undefined') {
      hasDarkSignal.value = false;
      return;
    }
    const root = document.documentElement;
    const body = document.body;
    hasDarkSignal.value =
      root.classList.contains('dark') ||
      body?.classList.contains('dark') ||
      root.dataset.theme === 'dark' ||
      body?.dataset.theme === 'dark' ||
      mediaQuery?.matches === true;
  }

  onMounted(() => {
    mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
    syncDarkClass();
    observer = new MutationObserver(syncDarkClass);
    observer.observe(document.documentElement, {
      attributeFilter: ['class'],
      attributes: true,
    });
    if (document.body) {
      bodyObserver = new MutationObserver(syncDarkClass);
      bodyObserver.observe(document.body, {
        attributeFilter: ['class', 'data-theme'],
        attributes: true,
      });
    }
    mediaQuery?.addEventListener?.('change', syncDarkClass);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    bodyObserver?.disconnect();
    mediaQuery?.removeEventListener?.('change', syncDarkClass);
    observer = null;
    bodyObserver = null;
    mediaQuery = null;
  });

  return hasDarkSignal;
}

function usePublicSiteTheme() {
  const { isDark } = usePreferences();
  const hasDarkClass = useDocumentDarkClass();
  // 显式选择 light/dark 时以偏好为准；仅 auto 模式才回退到系统/根节点暗色信号，
  // 否则在系统偏好暗色的浏览器上手动切换会永远无法回到亮色。
  const isPublicDark = computed(() => {
    const mode = preferencesManager.getPreferences().theme.mode;
    return mode === 'auto' ? isDark.value || hasDarkClass.value : isDark.value;
  });
const siteThemeVars = computed(() => ({
    ...baseThemeVars.value,
    ...(isPublicDark.value ? darkToneVars : lightToneVars),
    '--home-primary-soft': isPublicDark.value
      ? `rgb(${activeThemeDefinition.value.rgb} / 14%)`
      : activeThemeDefinition.value.soft,
    '--ps-bg': isPublicDark.value ? darkToneVars['--home-background'] : lightToneVars['--home-background'],
    '--ps-bg-elevated': isPublicDark.value ? darkToneVars['--home-background-mid'] : lightToneVars['--home-background-mid'],
    '--ps-surface': isPublicDark.value ? darkToneVars['--home-surface'] : lightToneVars['--home-surface'],
    '--ps-border': isPublicDark.value ? darkToneVars['--home-border'] : lightToneVars['--home-border'],
    '--ps-text': isPublicDark.value ? darkToneVars['--home-text'] : lightToneVars['--home-text'],
    '--ps-muted': isPublicDark.value ? darkToneVars['--home-muted'] : lightToneVars['--home-muted'],
    '--ps-success': isPublicDark.value ? darkToneVars['--home-success'] : lightToneVars['--home-success'],
    '--ps-warning': isPublicDark.value ? darkToneVars['--home-warning'] : lightToneVars['--home-warning'],
    '--ps-danger': isPublicDark.value ? darkToneVars['--home-danger'] : lightToneVars['--home-danger'],
    '--ps-grid': isPublicDark.value ? darkToneVars['--home-grid-line'] : lightToneVars['--home-grid-line'],
    '--ps-shadow': isPublicDark.value ? darkToneVars['--home-shadow'] : lightToneVars['--home-shadow'],
  }));

  watchEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    for (const [key, value] of Object.entries(siteThemeVars.value)) {
      document.documentElement.style.setProperty(key, value);
    }
  });

  return {
    activeTheme,
    isPublicDark,
    selectedTheme,
    setSiteTheme,
    siteThemeVars,
    themeOptions,
  };
}

export { themeOptions, usePublicSiteTheme };
export type { PublicThemeOption };
