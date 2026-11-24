<script setup lang="ts">
import type { HomeApi } from '#/api/home';

import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { getHomeOverview } from '#/api/home';
import PublicSiteShell from '#/components/public-site-shell.vue';
import { useConsoleEntry } from '#/composables/use-console-entry';
import { $t } from '#/locales';
import { applySiteBrand, DEFAULT_SITE_NAME } from '#/site-brand';

import HomeCta from './components/HomeCta.vue';
import HomeFaq from './components/HomeFaq.vue';
import HomeFeaturedApis from './components/HomeFeaturedApis.vue';
import HomeFlowCard from './components/HomeFlowCard.vue';
import HomeLifecycle from './components/HomeLifecycle.vue';
import HomeMetrics from './components/HomeMetrics.vue';
import HomePromoCard from './components/HomePromoCard.vue';

const API_MARKET_PATH = '/apilist';
const router = useRouter();
const { goToConsole, isConsoleNavigating, isSignedIn } = useConsoleEntry();

const defaultSiteConfig: HomeApi.SiteConfig = {
  contactAddress: '', contactEmail: '', contactPhone: '', contactQq: '', contactWechat: '',
  copyright: `Copyright 2026 ${DEFAULT_SITE_NAME}. All rights reserved.`,
  description: $t('page.public.home.defaultDescription'), icp: '', logoUrl: '',
  siteName: DEFAULT_SITE_NAME, slogan: $t('page.public.home.defaultSlogan'), updateTime: null,
};
// Pre-load state: no verdict has been received yet, so traffic metrics render
// as unavailable until the first response carries a real `analyticsReady`.
const emptyOverview: HomeApi.Overview = {
  homeNotice: { content: '', enabled: 0 },
  hotApis: [],
  siteConfig: defaultSiteConfig,
  stats: {
    activeRegions24h: 0, activeRegions24hDelta: 0, analyticsReady: false, apiTotal: 0,
    availabilityPercent: 0, availabilitySource: 'API_STATUS', calls24h: 0, calls24hDeltaPercent: 0,
    coveredUpTo: '', degradedSections: [], enabledApiTotal: 0, lagSeconds: 0, peakQps24h: 0,
    peakQps24hDelta: 0, unavailableFields: [], userTotal: 0,
  },
};

const overview = shallowRef<HomeApi.Overview>(emptyOverview);
const loading = shallowRef(false);
const loadFailed = shallowRef(false);
const searchKeyword = shallowRef('');
const homeContentRef = shallowRef<HTMLElement>();
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let revealObserver: IntersectionObserver | undefined;
let loadGeneration = 0;
let mounted = false;

const siteConfig = computed(() => overview.value.siteConfig ?? defaultSiteConfig);
const siteName = computed(() => String(siteConfig.value.siteName || DEFAULT_SITE_NAME).trim() || DEFAULT_SITE_NAME);
const noticeText = computed(() => Number(overview.value.homeNotice?.enabled || 0) === 1 ? String(overview.value.homeNotice?.content || '').trim() : '');
const footerSiteConfig = computed(() => ({ ...siteConfig.value, description: siteConfig.value.description || $t('page.public.home.defaultDescription') }));
const stats = computed(() => overview.value.stats);
const hotApis = computed(() => (overview.value.hotApis ?? []).slice(0, 5));
const hotWords = computed(() => hotApis.value.map((item) => item.name).filter(Boolean));

watch(siteName, (name) => { if (typeof document !== 'undefined') document.title = name; }, { immediate: true });

onMounted(() => {
  mounted = true;
  document.addEventListener('visibilitychange', handleVisibilityChange);
  void loadOverview();
  refreshTimer = setInterval(() => { if (document.visibilityState === 'visible') void loadOverview(); }, 60_000);
  void nextTick(setupReveal);
});
onBeforeUnmount(() => {
  mounted = false;
  loadGeneration += 1;
  if (refreshTimer) clearInterval(refreshTimer);
  revealObserver?.disconnect();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

function setupReveal() {
  if (typeof IntersectionObserver === 'undefined') return;
  revealObserver?.disconnect();
  revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      revealObserver?.unobserve(entry.target);
    }
  }, { threshold: 0.2 });
  for (const el of homeContentRef.value?.querySelectorAll('.reveal') ?? []) {
    revealObserver.observe(el);
  }
}
async function loadOverview() {
  if (loading.value || !mounted) return;
  const generation = ++loadGeneration;
  loading.value = true;
  try {
    const nextOverview = await getHomeOverview();
    if (!mounted || generation !== loadGeneration) return;
    overview.value = nextOverview;
    loadFailed.value = false;
    await applySiteBrand(nextOverview.siteConfig);
  } catch {
    if (!mounted || generation !== loadGeneration) return;
    overview.value = emptyOverview;
    loadFailed.value = true;
  } finally {
    if (mounted && generation === loadGeneration) loading.value = false;
  }
}
function handleVisibilityChange() { if (document.visibilityState === 'visible') void loadOverview(); }
function submitSearch() {
  const keyword = searchKeyword.value.trim();
  void router.push({ path: API_MARKET_PATH, query: keyword ? { keyword } : {} });
}
</script>

<template>
  <PublicSiteShell active-key="home" :announcement="noticeText" :site-config="footerSiteConfig">
    <div ref="homeContentRef" class="home-content">
      <HomePromoCard />

      <section id="hero" class="hero" data-testid="home-hero">
        <div class="hero-grid">
          <div>
            <span class="hero-badge"><span aria-hidden="true">⚡</span> {{ $t('page.public.home.v3.hero.badge') }}</span>
            <h1>
              {{ $t('page.public.home.v3.hero.title1') }}<br />
              <span class="grad">{{ $t('page.public.home.v3.hero.titleAccent') }}</span>
              {{ $t('page.public.home.v3.hero.title2') }}
            </h1>
            <p class="lead">{{ $t('page.public.home.v3.hero.lead') }}</p>
            <!-- 主行动紧跟价值主张；搜索框降为次级入口置于其后。
                 原顺序（搜索 → 热词 → CTA）里两个 btn-primary 隔着热词互相抢重心。 -->
            <div class="hero-ctas">
              <button v-if="isSignedIn" class="btn btn-primary btn-lg" :disabled="isConsoleNavigating" type="button" @click="goToConsole">
                {{ $t('page.public.home.v3.hero.ctaConsole') }} →
              </button>
              <RouterLink v-else class="btn btn-primary btn-lg" to="/auth/register">
                {{ $t('page.public.home.v3.hero.ctaRegister') }} →
              </RouterLink>
              <a class="btn btn-ghost btn-lg" href="#faq">{{ $t('page.public.home.v3.hero.ctaFaq') }}</a>
            </div>
            <form class="search" data-testid="home-search" @submit.prevent="submitSearch">
              <IconifyIcon aria-hidden="true" icon="lucide:search" />
              <input v-model="searchKeyword" data-testid="home-search-input" :aria-label="$t('page.public.home.search.ariaLabel')" :placeholder="$t('page.public.home.v3.hero.searchPlaceholder')" type="search" />
              <button class="btn btn-ghost" type="submit">{{ $t('page.public.home.v3.hero.search') }}</button>
            </form>
            <div v-if="hotWords.length" class="hot-words" :aria-label="$t('page.public.home.v3.hero.hotLabel')">
              <span>{{ $t('page.public.home.v3.hero.hotLabel') }}</span>
              <RouterLink v-for="word in hotWords" :key="word" :to="{ path: API_MARKET_PATH, query: { keyword: word } }">{{ word }}</RouterLink>
            </div>
          </div>

          <HomeFlowCard
            :availability="stats.availabilityPercent"
            :call-count="stats.calls24h"
            :failed="loadFailed"
            :loading="loading"
          />
        </div>

        <div class="hero-stats">
          <HomeMetrics :failed="loadFailed" :loading="loading" :stats="stats" />
          <div v-if="loadFailed" class="home-data-error" role="alert">
            <IconifyIcon icon="lucide:cloud-off" />
            <span>{{ $t('page.public.home.dataError') }}</span>
            <button type="button" @click="loadOverview">{{ $t('page.public.home.retry') }}</button>
          </div>
        </div>
      </section>

      <HomeFeaturedApis :failed="loadFailed" :items="hotApis" :loading="loading" :total="stats.apiTotal" />
      <HomeLifecycle />
      <HomeFaq />
      <HomeCta :console-navigating="isConsoleNavigating" :signed-in="isSignedIn" @enter-console="goToConsole" />
    </div>
  </PublicSiteShell>
</template>

<style scoped>
.home-content {
  position: relative;
  z-index: 1;
  width: 100%;
  padding-bottom: 24px;
}

/* ---------- 间距刻度 ----------
   区块间距统一从这里取值，避免再出现 36px / 64px / 70px 这类
   彼此无关的孤立数字（原先 hero 收 36、section 起 70，节奏是断的）。 */
.home-content {
  --hs1: 6px;
  --hs2: 10px;
  --hs3: 16px;
  --hs4: 24px;
  --hs5: 36px;
  --hs6: 56px;
  --hs7: 88px;
}

/* ---------- Hero ---------- */
.hero { position: relative; padding: var(--hs6) 0 var(--hs5); }
.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: var(--hs6);
  align-items: center;
}
@media (max-width: 1024px) { .hero-grid { gap: 40px; } }
@media (max-width: 920px) { .hero-grid { grid-template-columns: 1fr; gap: 38px; } }

.hero-badge {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 20px;
  padding: 7px 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--home-primary);
  background: var(--home-grad-soft);
  border: 1px solid rgb(var(--home-primary-rgb) / 30%);
  border-radius: 999px;
}
.hero h1 {
  font-size: clamp(30px, 4.8vw, 56px);
  font-weight: 800;
  letter-spacing: -0.5px;
  line-height: 1.14;
  color: var(--home-heading);
  text-wrap: balance;
}
.hero h1 .grad {
  background: var(--home-grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero .lead {
  max-width: 56ch;
  margin-top: 18px;
  font-size: clamp(14.5px, 1.2vw, 16.5px);
  color: var(--home-muted);
}
.search {
  display: flex;
  gap: 8px;
  align-items: center;
  max-width: 560px;
  margin-top: var(--hs4);
  padding: 7px 7px 7px 16px;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border-strong);
  border-radius: 15px;
  box-shadow: var(--home-card-shadow);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.search:focus-within {
  border-color: var(--home-primary);
  box-shadow: 0 0 0 4px rgb(var(--home-primary-rgb) / 15%), var(--home-card-shadow);
}
.search > svg { flex: none; font-size: 18px; color: var(--home-text-faint); }
.search input {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  font: 500 15px var(--font-sans, system-ui, sans-serif);
  color: var(--home-text);
  background: none;
  border: 0;
  outline: 0;
}
.search input::placeholder { color: var(--home-text-faint); }
.search .btn {
  flex: none;
  height: 38px;
  min-height: 38px;
  border-radius: 10px;
}
@media (max-width: 520px) {
  .search { flex-wrap: wrap; padding: 10px; border-radius: 14px; }
  .search input { flex: 1 1 auto; padding-left: 4px; }
  .search .btn { flex: 1 1 100%; min-height: 44px; height: auto; }
}
.hot-words {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
  font-size: 12.5px;
}
.hot-words span { padding: 5px 0; color: var(--home-text-faint); }
.hot-words a {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 32px;
  padding: 6px 13px;
  color: var(--home-muted);
  background: var(--home-surface);
  border: 1px solid var(--home-border);
  border-radius: 999px;
  transition: all 0.18s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.hot-words a:hover {
  color: var(--home-primary);
  border-color: rgb(var(--home-primary-rgb) / 40%);
  transform: translateY(-1px);
}
.hero-ctas {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: var(--hs4);
}
@media (max-width: 420px) { .hero-ctas .btn { flex: 1 1 100%; } }
/* hero-meta 已移除：那 4 条卖点与顶部徽章、下方数据条重复三遍，
   删掉后 hero 只剩「标题 → 价值 → 主行动 → 次级搜索」四层。 */

.hero-stats { margin-top: var(--hs4); }
.home-data-error {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 48px;
  margin-top: 14px;
  padding: 10px 13px;
  font-size: 13px;
  color: var(--home-danger);
  background: var(--home-danger-soft);
  border: 1px solid rgb(220 38 38 / 20%);
  border-radius: 10px;
}
.home-data-error span { color: var(--home-muted); }
.home-data-error button {
  min-height: 36px;
  padding: 0 14px;
  margin-left: auto;
  font-weight: 700;
  color: var(--home-heading);
  cursor: pointer;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border-strong);
  border-radius: 8px;
}

/* ---------- 共享按钮 ---------- */
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
.btn-ghost:hover { transform: translateY(-1px); border-color: var(--home-border-strong); }
.btn-primary {
  color: #fff;
  background: var(--home-grad);
  box-shadow: 0 8px 24px rgb(79 140 255 / 38%);
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 12px 30px rgb(79 140 255 / 50%); }
.btn-primary:disabled { cursor: wait; opacity: 0.72; transform: none; }
.btn-lg {
  min-height: 48px;
  padding: 0 26px;
  font-size: 15px;
  border-radius: 13px;
}

/* ---------- 滚动显现 ---------- */
.reveal {
  opacity: 0;
  transform: translateY(22px);
  transition: opacity 0.7s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.7s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
  .btn { transition: none; }
}
</style>
