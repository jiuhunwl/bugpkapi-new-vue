<script lang="ts" setup>
import type { HomeApi } from '#/api/home';

import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { IconifyIcon } from '@vben/icons';

import ServiceProviderAdvertisement from '#/components/advertisement/ServiceProviderAdvertisement.vue';
import { useConsoleEntry } from '#/composables/use-console-entry';
import { usePublicSiteTheme } from '#/composables/use-public-site-theme';
import { $t } from '#/locales';
import { DEFAULT_SITE_NAME, useSiteBrand } from '#/site-brand';

const props = withDefaults(
  defineProps<{
    siteConfig?: Partial<HomeApi.SiteConfig>;
  }>(),
  {
    siteConfig: () => ({}),
  },
);

const API_MARKET_PATH = '/apilist';
const DONATE_PATH = '/donate';
const LINKS_PATH = '/links';
const PRIVACY_POLICY_PATH = '/privacy-policy';
const TERMS_OF_SERVICE_PATH = '/terms-of-service';
const DEFAULT_OPEN_SOURCE_URL =
  'https://github.com/search?q=BugPk-Api&type=repositories';

const { goToConsole, isSignedIn } = useConsoleEntry();
const { siteThemeVars } = usePublicSiteTheme();
const siteBrand = useSiteBrand();

const siteName = computed(
  () =>
    String(
      props.siteConfig.siteName || siteBrand.siteName || DEFAULT_SITE_NAME,
    ).trim() || DEFAULT_SITE_NAME,
);
const openSourceUrl = computed(() =>
  String(
    props.siteConfig.githubUrl ||
      siteBrand.githubUrl ||
      DEFAULT_OPEN_SOURCE_URL,
  ).trim(),
);
// The shared brand state has already preloaded and validated this URL. Never
// render the raw overview payload here because a stale request could bypass
// the generation guard and overwrite a newer successful logo.
const renderedLogoUrl = computed(() => siteBrand.logoUrl);
const siteDescription = computed(
  () =>
    String(
      props.siteConfig.description || siteBrand.description || '',
    ).trim() || $t('page.public.footer.defaultSlogan'),
);
const icpText = computed(() =>
  String(props.siteConfig.icp || '').trim(),
);
const contactQq = computed(() =>
  String(props.siteConfig.contactQq || '10000000').trim(),
);
const contactEmail = computed(() =>
  String(props.siteConfig.contactEmail || '').trim(),
);
const contactWechat = computed(() =>
  String(props.siteConfig.contactWechat || '').trim(),
);
const copyrightText = computed(
  () =>
    String(props.siteConfig.copyright || '').trim() ||
    `©️ ${new Date().getFullYear()} ${siteName.value}`,
);
const year = computed(() => new Date().getFullYear());
</script>

<template>
  <footer class="site-footer" :style="siteThemeVars">
    <div class="wrap">
      <div class="foot-main">
        <div class="foot-brand">
          <RouterLink class="brand" to="/">
            <img
              v-if="renderedLogoUrl"
              :alt="siteName"
              class="brand-logo"
              :src="renderedLogoUrl"
              loading="lazy"
            />
            <span v-else class="brand-mark">
              <IconifyIcon icon="lucide:waypoints" />
            </span>
            <span>{{ siteName }}</span>
          </RouterLink>
          <p>{{ siteDescription }}</p>
        </div>

        <nav class="foot-col" :aria-label="$t('page.public.aria.footerNav')">
          <h5>{{ $t('page.public.footer.quickLinks') }}</h5>
          <RouterLink :to="API_MARKET_PATH">
            {{ $t('page.public.nav.market') }}
          </RouterLink>
          <RouterLink :to="LINKS_PATH">
            {{ $t('page.public.nav.links') }}
          </RouterLink>
          <RouterLink :to="DONATE_PATH">
            {{ $t('page.public.nav.donate') }}
          </RouterLink>
          <a
            v-if="openSourceUrl"
            :href="openSourceUrl"
            rel="noopener noreferrer"
            target="_blank"
          >
            {{ $t('page.public.footer.openSource') }}
          </a>
        </nav>

        <nav class="foot-col" :aria-label="$t('page.public.footer.support')">
          <h5>{{ $t('page.public.footer.support') }}</h5>
          <RouterLink :to="DONATE_PATH">
            {{ $t('page.public.nav.donate') }}
          </RouterLink>
          <RouterLink :to="PRIVACY_POLICY_PATH">
            {{ $t('legal.common.privacyPolicy') }}
          </RouterLink>
          <RouterLink :to="TERMS_OF_SERVICE_PATH">
            {{ $t('legal.common.termsOfService') }}
          </RouterLink>
          <a v-if="isSignedIn" href="#" @click.prevent="goToConsole">
            {{ $t('page.public.nav.console') }}
          </a>
          <RouterLink v-else :to="LOGIN_PATH">
            {{ $t('page.public.footer.signIn') }}
          </RouterLink>
        </nav>

        <div class="foot-col">
          <h5>{{ $t('page.public.footer.contactTitle') }}</h5>
          <span v-if="contactQq">QQ：{{ contactQq }}</span>
          <span v-if="contactEmail">{{ $t('page.public.footer.email') }}：{{ contactEmail }}</span>
          <span v-if="contactWechat">{{ $t('page.public.footer.wechat') }}：{{ contactWechat }}</span>
          <a
            v-if="openSourceUrl"
            :href="openSourceUrl"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub：{{ openSourceUrl.replace('https://github.com/', '') }}
          </a>
        </div>
      </div>

      <div class="foot-bottom">
        <span class="copyright">
          <IconifyIcon icon="lucide:copyright" />
          {{ copyrightText || `©️ ${year} ${siteName}` }} · MIT License
        </span>
        <ServiceProviderAdvertisement />
        <span class="beian">
          <a v-if="icpText" href="https://beian.miit.gov.cn/" rel="noopener noreferrer" target="_blank">
            {{ icpText }}
          </a>
        </span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  position: relative;
  z-index: 1;
  width: 100%;
  margin-top: 84px;
  color: var(--ps-muted, var(--home-muted));
  background: var(--ps-bg-elevated, var(--home-background-mid));
  border-top: 1px solid var(--ps-border, var(--home-border));
}
@media (max-width: 640px) {
  .site-footer { margin-top: 56px; }
}

.wrap {
  width: min(100% - 40px, 1200px);
  margin: 0 auto;
}
@media (max-width: 768px) { .wrap { width: min(100% - 32px, 1200px); } }
@media (max-width: 420px) { .wrap { width: min(100% - 24px, 1200px); } }

.foot-main {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1.1fr;
  gap: 34px;
  padding: 48px 0 36px;
}
@media (max-width: 920px) {
  .foot-main { grid-template-columns: 1fr 1fr; gap: 28px; padding: 40px 0 30px; }
}
@media (max-width: 520px) {
  .foot-main { grid-template-columns: 1fr 1fr; gap: 22px 18px; padding: 36px 0 26px; }
  .foot-brand {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--home-border);
  }
  .foot-brand p { margin: 12px auto 0; font-size: 12.5px; max-width: 34ch; }
  .foot-col h5 { text-align: center; font-size: 12.5px; margin-bottom: 8px; }
  .foot-col a, .foot-col span { justify-content: center; min-height: 34px; font-size: 13px; }
  .foot-col:last-child { grid-column: 1 / -1; }
}

.brand {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  font-weight: 800;
  font-size: 17px;
  color: var(--home-text);
}
.brand-logo {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  object-fit: contain;
  background: var(--home-surface-soft);
}
.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--home-grad);
  color: #fff;
  font-size: 19px;
  box-shadow: 0 6px 18px rgb(var(--home-primary-rgb) / 45%);
}

.brand-mark svg {
  width: 1em;
  height: 1em;
  stroke-width: 1.9;
}
.foot-brand p {
  margin-top: 13px;
  font-size: 13px;
  color: var(--home-muted);
  max-width: 40ch;
  line-height: 1.8;
}

.foot-col { min-width: 0; }
.foot-col h5 { font-size: 13px; font-weight: 700; margin-bottom: 14px; color: var(--home-text); }
.foot-col a,
.foot-col span {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 30px;
  font-size: 13px;
  color: var(--home-muted);
  transition: color 0.18s;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.foot-col a:hover { color: var(--home-primary); }

.foot-bottom {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0 24px;
  border-top: 1px solid var(--home-border);
  font-size: 12px;
  color: var(--home-text-faint);
}
@media (max-width: 520px) {
  .foot-bottom {
    flex-direction: column;
    justify-content: center;
    text-align: center;
    padding: 16px 0 22px;
    gap: 6px;
  }
}
.foot-bottom span { min-width: 0; overflow-wrap: anywhere; display: inline-flex; align-items: center; gap: 5px; }
.foot-bottom .beian a:hover { color: var(--home-primary); }
</style>
