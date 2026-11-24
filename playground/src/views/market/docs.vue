<script setup lang="ts">
import type { MarketApi } from '#/api/market';

import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { getMarketApiDetail } from '#/api/market';
import PublicPageState from '#/components/public-page-state.vue';
import PublicSiteShell from '#/components/public-site-shell.vue';
import { usePublicSeo } from '#/composables/use-public-seo';
import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';
import { DEFAULT_SITE_NAME, useSiteBrand } from '#/site-brand';

import DocsAuthentication from './components/docs/DocsAuthentication.vue';
import DocsCodeExamples from './components/docs/DocsCodeExamples.vue';
import DocsExplorer from './components/docs/DocsExplorer.vue';
import DocsOverview from './components/docs/DocsOverview.vue';
import DocsParameters from './components/docs/DocsParameters.vue';
import DocsResponse from './components/docs/DocsResponse.vue';

const MARKET_PATH = '/apilist';
const route = useRoute();
const siteBrand = useSiteBrand();

const detail = shallowRef<MarketApi.ApiDetail | null>(null);
const loading = shallowRef(false);
const errorKind = shallowRef<'' | 'missing' | 'network' | 'not-found'>('');
const docsRoot = shallowRef<HTMLElement>();
let detailRequestSequence = 0;
let spyObserver: IntersectionObserver | undefined;
const activeSection = shallowRef('overview');

const routeId = computed(() => {
  const value = Array.isArray(route.params.id)
    ? route.params.id[0]
    : route.params.id;
  return String(value ?? '').trim();
});
const siteName = computed(() => siteBrand.siteName || DEFAULT_SITE_NAME);
const seoTitle = computed(() =>
  detail.value
    ? `${detail.value.name} - ${siteName.value}`
    : `${$t('page.public.marketDocs.title')} - ${siteName.value}`,
);
const seoDescription = computed(
  () =>
    detail.value?.description ||
    siteBrand.description ||
    $t('page.public.marketDocs.concise.errors.loadFailed'),
);
const canonicalPath = computed(() =>
  routeId.value ? `/docs/${encodeURIComponent(routeId.value)}` : MARKET_PATH,
);
const seoNoindex = computed(() => loading.value || !detail.value);

usePublicSeo({
  canonicalPath,
  description: seoDescription,
  noindex: seoNoindex,
  title: seoTitle,
});

const navItems = computed(() => [
  {
    id: 'overview',
    label: $t('page.public.marketDocs.concise.nav.overview'),
    icon: 'lucide:book-open',
  },
  {
    id: 'authentication',
    label: $t('page.public.marketDocs.concise.nav.authentication'),
    icon: 'lucide:key-round',
  },
  {
    id: 'parameters',
    label: $t('page.public.marketDocs.concise.nav.parameters'),
    icon: 'lucide:sliders-horizontal',
  },
  {
    id: 'response',
    label: $t('page.public.marketDocs.concise.nav.response'),
    icon: 'lucide:braces',
  },
  {
    id: 'examples',
    label: $t('page.public.marketDocs.concise.nav.examples'),
    icon: 'lucide:code-2',
  },
  {
    id: 'online-test',
    label: $t('page.public.marketDocs.concise.nav.onlineTest'),
    icon: 'lucide:terminal',
  },
]);

const endpoint = computed(() =>
  withCurrentOrigin(String(detail.value?.gatewayPath || '').trim()),
);
const methods = computed<Array<'GET' | 'POST'>>(() => {
  if (detail.value?.requestMethod === 'GET_POST') return ['GET', 'POST'];
  return detail.value?.requestMethod === 'POST' ? ['POST'] : ['GET'];
});
const preferredMethod = computed<'GET' | 'POST'>(() => {
  if (
    detail.value?.preferredMethod === 'POST' &&
    methods.value.includes('POST')
  ) {
    return 'POST';
  }
  return methods.value[0] ?? 'GET';
});
const methodLabel = computed(() => methods.value.join('/'));
const priceLabel = computed(() => {
  if (!detail.value) return $t('page.public.marketDocs.concise.overview.free');
  if (Number(detail.value.pointPrice || 0) > 0) {
    return $t('page.public.marketDocs.concise.overview.points', [
      formatAmount(detail.value.pointPrice),
    ]);
  }
  if (Number(detail.value.price || 0) > 0) {
    return $t('page.public.marketDocs.concise.overview.balance', [
      formatSettlementPrice(detail.value.price, 4),
    ]);
  }
  return $t('page.public.marketDocs.concise.overview.free');
});
const documentedParameters = computed<MarketApi.ApiParameter[]>(() => {
  const parameters = new Map<string, MarketApi.ApiParameter>();
  for (const item of detail.value?.parameters ?? []) {
    const normalizedName = String(item.name || '')
      .trim()
      .toLowerCase();
    if (
      !normalizedName ||
      normalizedName === 'key' ||
      normalizedName === 'body'
    ) {
      continue;
    }
    parameters.set(`${item.location}:${item.name}`, item);
  }
  for (const name of detail.value?.templateParameters ?? []) {
    const key = `Query:${name}`;
    const alreadyExists = [...parameters.values()].some(
      (item) => item.name === name,
    );
    if (!alreadyExists) {
      parameters.set(key, {
        description: $t(
          'page.public.marketDocs.concise.params.templateDescription',
          [name],
        ),
        location: 'Query',
        name,
        required: true,
        type: 'string',
      });
    }
  }
  return [...parameters.values()];
});
const testParameters = computed(() =>
  documentedParameters.value.filter((item) => item.location === 'Query'),
);

watch(
  () => route.params.id,
  () => {
    void loadDetail();
  },
  { immediate: true },
);

function setupScrollSpy() {
  spyObserver?.disconnect();
  if (typeof IntersectionObserver === 'undefined') return;
  spyObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) activeSection.value = visible[0].target.id;
    },
    { rootMargin: '-100px 0px -55% 0px' },
  );
  for (const el of docsRoot.value?.querySelectorAll(
    '.docs-article .doc-card',
  ) ?? [])
    spyObserver.observe(el);
}

function navigateSection(id: string) {
  activeSection.value = id;
  const target = docsRoot.value?.querySelector(`[id="${id}"]`);
  target?.scrollIntoView({ block: 'start' });
}

onBeforeUnmount(() => {
  detailRequestSequence++;
  spyObserver?.disconnect();
  spyObserver = undefined;
});

async function loadDetail() {
  const sequence = ++detailRequestSequence;
  const rawId = routeId.value;
  if (!rawId) {
    detail.value = null;
    errorKind.value = 'missing';
    return;
  }

  loading.value = true;
  detail.value = null;
  errorKind.value = '';
  try {
    const result = await getMarketApiDetail(rawId);
    if (sequence !== detailRequestSequence) return;
    detail.value = result;
    activeSection.value = 'overview';
  } catch (error) {
    if (sequence !== detailRequestSequence) return;
    detail.value = null;
    errorKind.value = responseStatus(error) === 404 ? 'not-found' : 'network';
  } finally {
    if (sequence === detailRequestSequence) {
      loading.value = false;
      await nextTick();
      if (sequence === detailRequestSequence && detail.value) {
        setupScrollSpy();
        const hash = route.hash.slice(1);
        if (navItems.value.some((item) => item.id === hash))
          navigateSection(hash);
      }
    }
  }
}

function responseStatus(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as {
    response?: { status?: unknown };
    status?: unknown;
  };
  const status = Number(value.response?.status ?? value.status);
  return Number.isInteger(status) ? status : undefined;
}

function withCurrentOrigin(pathOrUrl: string) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalizedPath = pathOrUrl.startsWith('/')
    ? pathOrUrl
    : `/${pathOrUrl}`;
  if (typeof window === 'undefined') return normalizedPath;
  return `${window.location.origin}${normalizedPath}`;
}

function formatAmount(value: number | string) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  return number.toFixed(4).replace(/\.?0+$/, '');
}
</script>

<template>
  <PublicSiteShell active-key="market" class="docs-page" main-id="docs-main">
    <div ref="docsRoot" class="docs-shell">
      <nav class="docs-breadcrumb" aria-label="Breadcrumb">
        <RouterLink to="/">
          {{ $t('page.public.marketDocs.concise.breadcrumb.home') }}
        </RouterLink>
        <IconifyIcon icon="lucide:chevron-right" />
        <RouterLink :to="MARKET_PATH">
          {{ $t('page.public.marketDocs.concise.breadcrumb.market') }}
        </RouterLink>
        <IconifyIcon icon="lucide:chevron-right" />
        <span>{{ detail?.name || 'API' }}</span>
      </nav>

      <PublicPageState
        v-if="loading"
        data-testid="docs-loading"
        icon="lucide:loader-circle"
        :title="$t('page.public.marketDocs.concise.loading')"
      />

      <PublicPageState
        v-else-if="errorKind === 'not-found' || errorKind === 'missing'"
        data-testid="docs-not-found"
        icon="lucide:file-question"
        :description="
          $t('page.public.marketDocs.concise.errors.notFoundDescription')
        "
        :title="
          errorKind === 'missing'
            ? $t('page.public.marketDocs.concise.errors.missingId')
            : $t('page.public.marketDocs.concise.errors.notFound')
        "
      >
        <template #action>
          <RouterLink class="docs-state-action" :to="MARKET_PATH">
            <IconifyIcon icon="lucide:arrow-left" />
            {{ $t('page.public.marketDocs.concise.backMarket') }}
          </RouterLink>
        </template>
      </PublicPageState>

      <PublicPageState
        v-else-if="errorKind === 'network'"
        data-testid="docs-error"
        icon="lucide:cloud-off"
        tone="danger"
        :description="
          $t('page.public.marketDocs.concise.errors.loadFailedDescription')
        "
        :title="$t('page.public.marketDocs.concise.errors.loadFailed')"
      >
        <template #action>
          <button
            class="docs-state-action"
            data-testid="docs-retry"
            type="button"
            @click="loadDetail"
          >
            <IconifyIcon icon="lucide:rotate-cw" />
            {{ $t('page.public.marketDocs.concise.retry') }}
          </button>
        </template>
      </PublicPageState>

      <template v-else-if="detail">
        <nav
          class="docs-jump-nav"
          :aria-label="$t('page.public.marketDocs.concise.nav.title')"
        >
          <a
            v-for="item in navItems"
            :key="item.id"
            :href="`#${item.id}`"
            :aria-current="activeSection === item.id ? 'location' : undefined"
            @click="navigateSection(item.id)"
          >
            <IconifyIcon :icon="item.icon" />
            {{ item.label }}
          </a>
        </nav>

        <div class="docs-layout">
          <nav
            class="docs-section-nav docs-nav docs-toc"
            :aria-label="$t('page.public.marketDocs.concise.nav.title')"
          >
            <RouterLink class="docs-back-market" :to="MARKET_PATH">
<IconifyIcon icon="lucide:arrow-left" />{{
                $t('page.public.marketDocs.concise.backMarket')
              }}
</RouterLink>
            <div class="nav-title">
              {{ $t('page.public.marketDocs.design.navigation') }}
            </div>
            <a
              v-for="item in navItems"
              :key="item.id"
              :class="{ active: item.id === activeSection }"
              :aria-current="activeSection === item.id ? 'location' : undefined"
              @click="navigateSection(item.id)"
              :href="`#${item.id}`"
            >
              <IconifyIcon :icon="item.icon" />
              {{ item.label }}
            </a>
            <div class="docs-nav-support">
              <IconifyIcon icon="lucide:messages-square" /><strong>{{
                $t('page.public.marketDocs.design.helpTitle')
              }}</strong>
              <p>{{ $t('page.public.marketDocs.design.helpDescription') }}</p>
              <RouterLink to="/console/tickets">
{{ $t('page.public.marketDocs.design.support')
                }}<IconifyIcon icon="lucide:arrow-up-right" />
</RouterLink>
            </div>
          </nav>

          <div class="docs-main-column">
            <article class="docs-content docs-article">
              <DocsOverview
                :detail="detail"
                :endpoint="endpoint"
                :method-label="methodLabel"
                :price-label="priceLabel"
                @navigate="navigateSection"
              />
              <DocsAuthentication :endpoint="endpoint" />
              <DocsParameters :parameters="documentedParameters" />
              <DocsResponse :detail="detail" />
              <DocsCodeExamples
                :endpoint="endpoint"
                :method="preferredMethod"
                :parameters="testParameters"
              />
            </article>
            <aside class="docs-playground">
              <DocsExplorer
                :detail="detail"
                :endpoint="endpoint"
                :methods="methods"
                :parameters="testParameters"
              />
            </aside>
          </div>
        </div>
      </template>
    </div>
  </PublicSiteShell>
</template>

<style scoped>
.docs-page {
  background: var(--home-surface-popover);
}
.docs-page :deep(.bg-deco) {
  display: none;
}
.docs-page :deep(.public-site-main) {
  width: min(1320px, calc(100% - 64px));
}
.docs-shell {
  padding: 26px 0 72px;
}
.docs-breadcrumb {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  color: var(--home-muted);
  margin-bottom: 28px;
  min-width: 0;
}
.docs-breadcrumb a {
  flex: none;
}
.docs-breadcrumb svg {
  width: 12px;
  height: 12px;
  flex: none;
}
.docs-breadcrumb span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-layout {
  display: grid;
  grid-template-columns: 202px minmax(0, 1fr);
  gap: 54px;
  align-items: start;
}
.docs-nav {
  position: sticky;
  top: 90px;
  padding: 4px 0 20px;
  min-width: 0;
}
.docs-nav a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 13px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--home-muted);
  border-radius: 6px;
  margin: 3px 0;
}
.docs-nav a svg {
  width: 17px;
  height: 17px;
  flex: none;
}
.docs-nav a.active {
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 8%);
  font-weight: 600;
}
.docs-nav a:hover {
  color: var(--home-primary);
}
.docs-nav .docs-back-market {
  font-size: 12px;
  padding: 0 10px 20px;
  margin: 0 0 20px;
  border-bottom: 1px solid var(--home-border);
  border-radius: 0;
}
.nav-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--home-text-faint);
  margin: 0 13px 13px;
  letter-spacing: 0.06em;
}
.docs-nav-support {
  margin: 32px 10px 0;
  padding-top: 24px;
  border-top: 1px solid var(--home-border);
  color: var(--home-muted);
}
.docs-nav-support > svg {
  width: 20px;
  height: 20px;
  margin-bottom: 12px;
}
.docs-nav-support strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--home-heading);
}
.docs-nav-support p {
  margin: 8px 0 10px;
  font-size: 12px;
  line-height: 1.9;
}
.docs-nav .docs-nav-support a {
  padding: 0;
  font-size: 12px;
  color: var(--home-primary);
}
.docs-main-column,
.docs-article {
  min-width: 0;
}
.docs-playground {
  min-width: 0;
  margin-top: 44px;
  border: 1px solid var(--home-border);
  background: var(--home-surface);
  border-radius: 12px;
  padding: 28px;
}
.docs-jump-nav {
  display: none;
}
.docs-state-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid var(--home-border);
  border-radius: 6px;
  color: var(--home-primary);
  background: var(--home-surface);
  cursor: pointer;
}
@media (max-width: 1100px) {
  .docs-layout {
    grid-template-columns: 176px minmax(0, 1fr);
    gap: 32px;
  }
  .docs-page :deep(.public-site-main) {
    width: calc(100% - 48px);
  }
}
@media (max-width: 899px) {
  .docs-page :deep(.public-site-main) {
    width: calc(100% - 36px);
  }
  .docs-shell {
    padding-top: 18px;
    padding-bottom: 44px;
  }
  .docs-layout {
    display: block;
  }
  .docs-nav.docs-toc {
    display: none;
  }
  .docs-breadcrumb {
    margin-bottom: 16px;
  }
  .docs-jump-nav {
    position: sticky;
    top: 64px;
    z-index: 15;
    display: flex;
    gap: 6px;
    padding: 10px 0;
    margin-bottom: 22px;
    overflow-x: auto;
    background: var(--home-surface-popover);
    border-bottom: 1px solid var(--home-border);
    scrollbar-width: thin;
  }
  .docs-jump-nav a {
    flex: none;
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 8px 10px;
    color: var(--home-muted);
    border-radius: 5px;
    font-size: 12px;
  }
  .docs-jump-nav a svg {
    width: 14px;
    height: 14px;
  }
  .docs-jump-nav a[aria-current] {
    color: var(--home-primary);
    background: rgb(var(--home-primary-rgb) / 8%);
  }
  .docs-playground {
    margin-top: 30px;
    padding: 20px;
  }
}
@media (max-width: 480px) {
  .docs-playground {
    padding: 17px;
  }
}
</style>
<style>
/* Shared chapter system, contained to this document route. */
.docs-page .doc-card {
  min-width: 0;
  padding: 34px 0;
  scroll-margin-top: 100px;
  border-bottom: 1px solid var(--home-border);
}
.docs-page .doc-card__head {
  margin-bottom: 22px;
}
.docs-page .doc-card__head h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 21px;
  line-height: 1.4;
  font-weight: 600;
  color: var(--home-heading);
  letter-spacing: -0.3px;
}
.docs-page .doc-card__head .hint {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.85;
  color: var(--home-muted);
}
.docs-page .doc-block {
  min-width: 0;
  max-width: 100%;
  overflow: auto;
  margin-top: 18px;
}
.docs-page .param-name {
  font-family: ui-monospace, monospace;
  font-size: 13px;
  color: var(--home-heading);
}
.docs-page .type-chip {
  font:
    11px ui-monospace,
    monospace;
  padding: 3px 6px;
  border-radius: 4px;
  background: var(--home-surface);
  color: var(--home-muted);
}
.docs-page .doc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.docs-page .doc-table th {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  background: var(--home-surface);
  color: var(--home-muted);
  border-block: 1px solid var(--home-border);
}
.docs-page .doc-table td {
  padding: 14px 12px;
  border-bottom: 1px solid var(--home-border);
  color: var(--home-muted);
  line-height: 1.8;
  vertical-align: top;
  overflow-wrap: anywhere;
}
.docs-page .doc-table tr:last-child td {
  border-bottom: 0;
}
.docs-page .doc-table code {
  font-family: ui-monospace, monospace;
  color: var(--home-heading);
  font-size: 12px;
}
.docs-page .docs-playground .doc-card {
  padding: 0;
  border: 0;
}
.docs-page .docs-playground .doc-card__head {
  margin-bottom: 22px;
}
@media (max-width: 899px) {
  .docs-page .doc-card {
    scroll-margin-top: 145px;
    padding: 28px 0;
  }
  .docs-page .doc-card__head h2 {
    font-size: 20px;
  }
  .docs-page .doc-card__head .hint {
    font-size: 13px;
  }
  .docs-page .doc-table td,
  .docs-page .doc-table th {
    padding-inline: 8px;
  }
}
</style>
