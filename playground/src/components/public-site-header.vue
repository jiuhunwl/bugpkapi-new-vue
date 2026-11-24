<script lang="ts" setup>
import type { SupportedLanguagesType } from '@vben/locales';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  toValue,
  useTemplateRef,
} from 'vue';
import { RouterLink } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { IconifyIcon } from '@vben/icons';
import { getLocaleOptions, loadLocaleMessages } from '@vben/locales';
import { preferences, preferencesManager } from '@vben/preferences';
import { VbenDropdownRadioMenu } from '@vben-core/shadcn-ui';

import PublicSiteMobileNav from '#/components/public-site-mobile-nav.vue';
import { useConsoleEntry } from '#/composables/use-console-entry';
import { usePublicSiteTheme } from '#/composables/use-public-site-theme';
import { $t } from '#/locales';
import {
  DEFAULT_SITE_NAME,
  useSiteBrand,
} from '#/site-brand';

type PublicNavKey =
  | 'apis'
  | 'donate'
  | 'home'
  | 'legal'
  | 'links'
  | 'market'
  | 'opensource';

interface NavItem {
  external?: boolean;
  href?: string;
  key: PublicNavKey;
  label: string;
  to: string;
}

const props = withDefaults(
  defineProps<{
    activeKey?: PublicNavKey;
    repositoryUrl?: string;
  }>(),
  {
    activeKey: 'home',
    repositoryUrl: '',
  },
);

const DEFAULT_OPEN_SOURCE_URL =
  'https://github.com/search?q=BugPk-Api&type=repositories';

const siteBrand = useSiteBrand();
const { isPublicDark } = usePublicSiteTheme();
const { goToConsole, isConsoleNavigating, isSignedIn } = useConsoleEntry();

const languageOptions = computed(() => [...getLocaleOptions().value]);
const currentLocale = computed(() => preferences.app.locale);

async function handleLanguageUpdate(value?: string) {
  if (!value) {
    return;
  }
  const locale = value as SupportedLanguagesType;
  if (locale === preferences.app.locale) {
    return;
  }
  preferencesManager.updatePreferences({ app: { locale } });
  await loadLocaleMessages(locale);
  // 切换语言后重新加载，确保页面中挂载时构建的静态文案也切换为新的语言。
  window.setTimeout(() => window.location.reload(), 250);
}

const siteName = computed(() => siteBrand.siteName || DEFAULT_SITE_NAME);
const renderedLogoUrl = computed(() => siteBrand.logoUrl);
const openSourceUrl = computed(() =>
  String(
    props.repositoryUrl || siteBrand.githubUrl || DEFAULT_OPEN_SOURCE_URL,
  ).trim(),
);
const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { key: 'home', label: toValue($t('page.public.nav.home')), to: '/' },
    {
      key: 'market',
      label: toValue($t('page.public.nav.market')),
      to: '/apilist',
    },
    { key: 'links', label: toValue($t('page.public.nav.links')), to: '/links' },
    {
      key: 'donate',
      label: toValue($t('page.public.nav.donate')),
      to: '/donate',
    },
  ];

  if (openSourceUrl.value) {
    items.push({
      key: 'opensource',
      label: toValue($t('page.public.nav.opensource')),
      to: '',
      href: openSourceUrl.value,
      external: true,
    });
  }

  return items;
});
const mobileMenuToggleLabel = computed(() =>
  isMobileMenuOpen.value
    ? $t('page.public.aria.closeNav')
    : $t('page.public.aria.openNav'),
);
const isMobileMenuOpen = shallowRef(false);
const isScrolled = shallowRef(false);
const mobileMenuTriggerRef = useTemplateRef<HTMLButtonElement>(
  'mobileMenuTrigger',
);

function toggleDark() {
  preferencesManager.updatePreferences({
    theme: { mode: isPublicDark.value ? 'light' : 'dark' },
  });
}

function openMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
}

async function closeMobileMenu(restoreFocus = true) {
  isMobileMenuOpen.value = false;
  if (restoreFocus) {
    await nextTick();
    mobileMenuTriggerRef.value?.focus();
  }
}

async function handleGoToConsole() {
  await closeMobileMenu(false);
  await goToConsole();
}

function handleWindowScroll() {
  isScrolled.value = window.scrollY > 8;
}

function handleWindowResize() {
  if (window.innerWidth > 920) {
    void closeMobileMenu(false);
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleWindowScroll, { passive: true });
  window.addEventListener('resize', handleWindowResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleWindowScroll);
  window.removeEventListener('resize', handleWindowResize);
});
</script>

<template>
  <header class="site-public-header" :class="{ scrolled: isScrolled }">
    <div class="wrap nav">
      <RouterLink class="logo" to="/">
        <img
          v-if="renderedLogoUrl"
          :alt="siteName"
          class="logo-mark logo-img"
          :src="renderedLogoUrl"
        />
        <span v-else class="logo-mark">
          <IconifyIcon icon="lucide:waypoints" />
        </span>
        <span class="logo-name">{{ siteName }}</span>
      </RouterLink>

      <nav class="nav-links site-nav" :aria-label="$t('page.public.aria.siteNav')">
        <template v-for="item in navItems" :key="item.key">
          <a
            v-if="item.external"
            :class="{ active: props.activeKey === item.key }"
            :href="item.href"
            rel="noopener noreferrer"
            target="_blank"
          >
            {{ item.label }}
          </a>
          <RouterLink
            v-else
            :class="{ active: props.activeKey === item.key }"
            :to="item.to"
          >
            {{ item.label }}
          </RouterLink>
        </template>
      </nav>

      <div class="nav-right site-actions">
        <button
          class="icon-btn"
          :aria-label="$t('page.public.aria.themeSwitcher')"
          :title="$t('page.public.aria.themeSwitcher')"
          type="button"
          data-testid="public-theme-toggle"
          @click="toggleDark"
        >
          <IconifyIcon :icon="isPublicDark ? 'lucide:sun' : 'lucide:moon'" />
        </button>

        <VbenDropdownRadioMenu
          :menus="languageOptions"
          :model-value="currentLocale"
          @update:model-value="handleLanguageUpdate"
        >
          <button
            class="icon-btn"
            :aria-label="$t('page.public.aria.languageSwitcher')"
            :title="$t('page.public.aria.languageSwitcher')"
            type="button"
            data-testid="public-language-toggle"
          >
            <IconifyIcon icon="lucide:languages" />
          </button>
        </VbenDropdownRadioMenu>

        <!-- 登录态：未登录仅显示登录/注册，已登录仅显示进入控制台（默认渲染未登录态，登录后覆盖） -->
        <RouterLink
          v-if="!isSignedIn"
          class="btn btn-ghost login-link"
          data-testid="public-login-entry"
          :to="LOGIN_PATH"
        >
          {{ $t('page.public.actions.loginRegister') }}
        </RouterLink>

        <button
          v-else
          class="btn btn-primary"
          data-testid="console-entry"
          :disabled="isConsoleNavigating"
          type="button"
          @click="handleGoToConsole"
        >
          {{ $t('page.public.actions.consoleFull') }}
        </button>

        <button
          ref="mobileMenuTrigger"
          class="icon-btn nav-toggle"
          :aria-expanded="isMobileMenuOpen"
          :aria-label="mobileMenuToggleLabel"
          type="button"
          @click="openMobileMenu"
        >
          <IconifyIcon :icon="isMobileMenuOpen ? 'lucide:x' : 'lucide:menu'" />
        </button>
      </div>
    </div>

    <PublicSiteMobileNav
      :active-key="props.activeKey"
      :items="navItems"
      :navigating="isConsoleNavigating"
      :open="isMobileMenuOpen"
      :signed-in="isSignedIn"
      @close="closeMobileMenu"
      @console="handleGoToConsole"
    />
  </header>
</template>

<style scoped>
.site-public-header {
  position: sticky;
  top: 0;
  z-index: 60;
  background: var(--home-surface-strong);
  border-bottom: 1px solid var(--home-border);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transition: box-shadow 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.site-public-header.scrolled {
  box-shadow: 0 10px 30px var(--home-shadow);
}
.wrap {
  width: min(100% - 40px, 1200px);
  margin: 0 auto;
}
.nav {
  display: flex;
  gap: 22px;
  align-items: center;
  height: 64px;
}
.logo {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.2px;
  color: var(--home-text);
  text-decoration: none;
}
.logo-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.logo-mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 34px;
  height: 34px;
  font-size: 19px;
  color: #fff;
  background: var(--home-grad);
  border-radius: 10px;
  box-shadow: 0 6px 18px rgb(79 140 255 / 45%);
}

.logo-mark svg {
  width: 1em;
  height: 1em;
  stroke-width: 1.9;
}
.logo-img {
  object-fit: contain;
  background: var(--home-image-background, #fff);
}
.nav-links {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}
.nav-links a {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 38px;
  padding: 9px 14px;
  font-size: 14px;
  font-weight: 500;
  color: var(--home-muted);
  text-decoration: none;
  border-radius: 10px;
  transition: all 0.2s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.nav-links a:hover {
  color: var(--home-text);
  background: var(--home-surface);
}
.nav-links a.active {
  color: var(--home-text);
  background: var(--home-grad-soft);
  box-shadow: inset 0 0 0 1px rgb(var(--home-primary-rgb) / 25%);
}
.nav-right {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-left: auto;
}
.icon-btn {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  font-size: 16px;
  color: var(--home-muted);
  cursor: pointer;
  background: var(--home-surface);
  border: 1px solid var(--home-border);
  border-radius: 11px;
  transition: all 0.2s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.icon-btn:hover {
  color: var(--home-text);
  border-color: var(--home-border-strong);
}
.btn {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  border: 0;
  border-radius: 11px;
  transition: all 0.2s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.btn-ghost {
  color: var(--home-text);
  background: var(--home-surface);
  border: 1px solid var(--home-border);
}
.btn-ghost:hover {
  transform: translateY(-1px);
  border-color: var(--home-border-strong);
}
.btn-primary {
  color: #fff;
  background: var(--home-grad);
  box-shadow: 0 8px 24px rgb(79 140 255 / 38%);
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 30px rgb(79 140 255 / 50%);
}
.btn-primary:disabled {
  cursor: wait;
  opacity: 0.72;
  transform: none;
}
.nav-toggle {
  display: none;
}
@media (max-width: 920px) {
  .nav { gap: 12px; }
  .nav-links { display: none; }
  .nav-toggle { display: grid; }
  .nav .btn-ghost { display: none; }
  .nav .btn-primary {
    min-height: 44px;
    padding: 0 14px;
    font-size: 13.5px;
  }
}
@media (max-width: 360px) {
  .nav .btn-primary { display: none; }
}
@media (max-width: 420px) {
  .logo-name { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .site-public-header,
  .nav-links a,
  .icon-btn,
  .btn {
    transition: none;
  }
}
</style>
