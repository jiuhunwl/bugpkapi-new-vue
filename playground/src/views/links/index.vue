<script lang="ts" setup>
import type { AuthApi } from '#/api';
import type { FriendLinkApi } from '#/api/friend-link';

import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import {
  applyFriendLink,
  getFriendLinkApplyStatus,
  getPublicFriendLinkMeta,
  getPublicFriendLinks,
} from '#/api/friend-link';
import {
  getCaptchaApi,
  isCaptchaEnabled,
  verifyCaptchaApi,
} from '#/api/core/auth';
import RichTextPreview from '#/components/rich-text-preview/index.vue';
import PublicSiteShell from '#/components/public-site-shell.vue';
import { restoreAccessTokenFromCookie } from '#/composables/use-auth-session';
import { $t } from '#/locales';
import {
  DEFAULT_LOGO_URL,
  DEFAULT_SITE_NAME,
  useSiteBrand,
} from '#/site-brand';

import FriendLinkApplyPanel from './components/FriendLinkApplyPanel.vue';
import FriendLinkDirectory from './components/FriendLinkDirectory.vue';

const accessStore = useAccessStore();
const router = useRouter();
const route = useRoute();
const siteBrand = useSiteBrand();

const links = ref<FriendLinkApi.FriendLinkItem[]>([]);
const meta = ref<FriendLinkApi.PublicMeta>({
  config: {
    applyEnabled: 1,
    // The administrator configuration is the only source of application
    // instructions. An empty value deliberately renders no notice.
    applyNotice: '',
  },
  siteInfo: {
    description: $t('page.public.footer.defaultSlogan'),
    logoUrl: '',
    siteName: DEFAULT_SITE_NAME,
    siteUrl: '',
  },
});
const loading = shallowRef(true);
const pageError = shallowRef(false);
const modalOpen = shallowRef(false);
const submitting = ref(false);
const hasSubmittedApply = ref(false);
const captchaChallenge = ref<AuthApi.CaptchaResult | null>(null);
const captchaChecking = ref(false);
const captchaError = ref('');
const captchaLoading = ref(false);
const captchaVerified = ref(false);
const captchaWidgetKey = ref(0);
let captchaRequestId = 0;
const applyForm = ref<
  Omit<FriendLinkApi.ApplyPayload, 'captchaId' | 'language'>
>({
  backlinkUrl: '',
  contactEmail: '',
  contactName: '',
  contactQq: '',
  description: '',
  logoUrl: '',
  siteName: '',
  siteUrl: '',
});

const isSignedIn = computed(() => Boolean(accessStore.accessToken));
const applyEnabled = computed(() => meta.value.config.applyEnabled === 1);

// 申请说明支持两种形态：富文本（HTML，经白名单过滤后渲染）与历史纯文本（按换行展示）
const applyNoticeText = computed(() =>
  String(meta.value.config.applyNotice || '').trim(),
);
const applyNoticeIsHtml = computed(() =>
  /<[a-z][\s\S]*>/i.test(applyNoticeText.value),
);
const canSubmitApply = computed(
  () =>
    !captchaLoading.value && !captchaChecking.value && captchaVerified.value,
);
const captchaSkipped = computed(
  () => captchaChallenge.value?.enabled === false,
);
const footerSiteConfig = computed(() => ({
  description: meta.value.siteInfo.description,
  logoUrl: meta.value.siteInfo.logoUrl,
  siteName: meta.value.siteInfo.siteName,
}));
const exchangeLogoUrl = computed(
  () => String(siteBrand.logoUrl || '').trim() || DEFAULT_LOGO_URL,
);
const isMobileViewport = shallowRef(false);
const applyMode = computed<'dialog' | 'sheet'>(() =>
  isMobileViewport.value ? 'sheet' : 'dialog',
);
let viewportQuery: MediaQueryList | undefined;

function syncViewportMode() {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  isMobileViewport.value = window.matchMedia('(max-width: 899px)').matches;
}

onMounted(() => {
  syncViewportMode();
  viewportQuery = window.matchMedia?.('(max-width: 899px)');
  viewportQuery?.addEventListener?.('change', syncViewportMode);
  viewportQuery?.addListener?.(syncViewportMode);
  void loadPageData();
});

onBeforeUnmount(() => {
  closeApplyPanel();
  viewportQuery?.removeEventListener?.('change', syncViewportMode);
  viewportQuery?.removeListener?.(syncViewportMode);
});

async function loadPageData() {
  loading.value = true;
  pageError.value = false;
  try {
    const [list, pageMeta] = await Promise.all([
      getPublicFriendLinks(),
      getPublicFriendLinkMeta(),
    ]);
    links.value = list;
    meta.value = pageMeta;
    // A private status probe must not hide a successfully loaded public directory.
    void refreshApplyStatus().catch(() => {});
  } catch {
    pageError.value = true;
  } finally {
    loading.value = false;
  }
}

async function refreshApplyStatus() {
  if (!isSignedIn.value) return;
  const status = await getFriendLinkApplyStatus();
  hasSubmittedApply.value = status.submitted;
}

async function openApplyModal() {
  if (loading.value || pageError.value) return;
  if (!applyEnabled.value) {
    message.warning($t('page.public.links.messages.applyClosed'));
    return;
  }
  if (hasSubmittedApply.value) {
    message.warning($t('page.public.links.messages.alreadySubmitted'));
    return;
  }
  if (!isSignedIn.value) {
    await restoreAccessTokenFromCookie();
  }
  if (!isSignedIn.value) {
    message.warning($t('page.public.links.messages.loginRequired'));
    router.push({
      path: LOGIN_PATH,
      query: {
        redirect: encodeURIComponent(route.fullPath),
      },
    });
    return;
  }
  try {
    await refreshApplyStatus();
  } catch {
    // Keep the existing form flow available if the optional status probe is down.
  }
  if (hasSubmittedApply.value) {
    message.warning($t('page.public.links.messages.alreadySubmitted'));
    return;
  }
  modalOpen.value = true;
  await loadApplyCaptcha();
}

function closeApplyPanel() {
  modalOpen.value = false;
  captchaRequestId += 1;
  captchaVerified.value = false;
}

function resetApplyForm() {
  applyForm.value.backlinkUrl = '';
  applyForm.value.contactEmail = '';
  applyForm.value.contactName = '';
  applyForm.value.contactQq = '';
  applyForm.value.description = '';
  applyForm.value.logoUrl = '';
  applyForm.value.siteName = '';
  applyForm.value.siteUrl = '';
}

function currentPageLanguage(): FriendLinkApi.Language {
  const candidates = [
    typeof document === 'undefined' ? '' : document.documentElement.lang,
    preferences.app.locale,
    typeof navigator === 'undefined' ? '' : navigator.language,
  ];
  const language =
    candidates.find((value) => String(value || '').trim()) || 'zh-CN';
  return String(language).trim().toLowerCase().startsWith('en') ? 'en' : 'zh';
}

async function loadApplyCaptcha() {
  if (!modalOpen.value) return;
  const requestId = ++captchaRequestId;
  captchaLoading.value = true;
  captchaChecking.value = false;
  captchaError.value = '';
  captchaVerified.value = false;
  captchaChallenge.value = null;
  try {
    const challenge = await getCaptchaApi('friend_link_apply');
    if (requestId !== captchaRequestId) return;
    captchaChallenge.value = challenge;
    captchaVerified.value = !isCaptchaEnabled(challenge);
    captchaWidgetKey.value += 1;
  } catch {
    if (requestId === captchaRequestId) {
      captchaError.value = $t('page.public.links.captcha.loadFailed');
    }
  } finally {
    if (requestId === captchaRequestId) captchaLoading.value = false;
  }
}

async function onApplyCaptchaSuccess(solution: AuthApi.CaptchaVerifyPayload) {
  const challenge = captchaChallenge.value;
  if (!challenge || captchaChecking.value || !modalOpen.value) return;
  const requestId = captchaRequestId;
  captchaChecking.value = true;
  captchaError.value = '';
  try {
    await verifyCaptchaApi(challenge, solution);
    if (requestId !== captchaRequestId) return;
    captchaVerified.value = true;
  } catch {
    if (requestId !== captchaRequestId) return;
    captchaError.value = $t('page.public.links.captcha.verifyFailed');
    await loadApplyCaptcha();
  } finally {
    if (requestId === captchaRequestId) captchaChecking.value = false;
  }
}

function onApplyCaptchaError() {
  captchaError.value = $t('page.public.links.captcha.verifyFailed');
}

function assertApplyForm() {
  if (!applyForm.value.siteName.trim()) {
    return $t('page.public.links.validation.siteNameRequired');
  }
  if (!applyForm.value.siteUrl.trim()) {
    return $t('page.public.links.validation.siteUrlRequired');
  }
  if (!applyForm.value.contactEmail.trim()) {
    return $t('page.public.links.validation.contactEmailRequired');
  }
  if (
    !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(
      applyForm.value.contactEmail.trim(),
    )
  ) {
    return $t('page.public.links.validation.contactEmailInvalid');
  }
  return '';
}

async function submitApply() {
  const error = assertApplyForm();
  if (error) {
    message.warning(error);
    return;
  }
  if (!captchaVerified.value) {
    message.warning($t('page.public.links.captcha.required'));
    return;
  }
  submitting.value = true;
  try {
    await applyFriendLink({
      backlinkUrl: applyForm.value.backlinkUrl?.trim() || undefined,
      captchaId: captchaChallenge.value?.captchaId || '',
      contactEmail: applyForm.value.contactEmail.trim(),
      contactName: applyForm.value.contactName?.trim() || undefined,
      contactQq: applyForm.value.contactQq?.trim() || undefined,
      description: applyForm.value.description?.trim(),
      language: currentPageLanguage(),
      logoUrl: applyForm.value.logoUrl?.trim(),
      siteName: applyForm.value.siteName.trim(),
      siteUrl: applyForm.value.siteUrl.trim(),
    });
    message.success($t('page.public.links.messages.applySubmitted'));
    hasSubmittedApply.value = true;
    closeApplyPanel();
    resetApplyForm();
    captchaChallenge.value = null;
    captchaVerified.value = false;
  } catch {
    await loadApplyCaptcha();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <PublicSiteShell
    active-key="links"
    class="links-page"
    :site-config="footerSiteConfig"
  >
    <section class="lk-head">
      <div class="lk-head-copy">
        <span class="eyebrow">FRIEND LINKS</span>
        <h1>{{ $t('page.public.links.title') }}</h1>
        <p>{{ $t('page.public.links.description') }}</p>
      </div>
      <span class="count-badge" aria-live="polite">
        {{
          loading || pageError
            ? '—'
            : $t('page.public.links.count', [links.length])
        }}
      </span>
    </section>

    <section class="lk-body">
      <FriendLinkDirectory
        :error="pageError"
        :items="links"
        :loading="loading"
        @retry="loadPageData"
      />

      <div class="apply-strip">
        <div class="as-copy">
          <h3>{{ $t('page.public.links.applyPrompt') }}</h3>
          <RichTextPreview
            v-if="applyNoticeIsHtml"
            class="as-richtext"
            data-testid="friend-link-apply-notice"
            :content="applyNoticeText"
            :min-height="0"
          />
          <p
            v-else-if="applyNoticeText"
            class="as-richtext as-richtext--plain"
            data-testid="friend-link-apply-notice"
          >
            {{ applyNoticeText }}
          </p>
        </div>
        <button
          class="btn as-btn"
          data-testid="friend-link-apply"
          :disabled="loading || pageError"
          :class="{ 'as-btn--disabled': !applyEnabled || hasSubmittedApply }"
          type="button"
          @click="openApplyModal"
        >
          <span>
            {{
              hasSubmittedApply
                ? $t('page.public.links.messages.alreadySubmitted')
                : applyEnabled
                  ? $t('page.public.links.apply')
                  : $t('page.public.links.applyClosed')
            }}
          </span>
        </button>
      </div>
    </section>
  </PublicSiteShell>

  <FriendLinkApplyPanel
    v-model:form="applyForm"
    :apply-notice="applyNoticeText"
    :apply-notice-is-html="applyNoticeIsHtml"
    :can-submit="canSubmitApply"
    :captcha-challenge="captchaChallenge"
    :captcha-checking="captchaChecking"
    :captcha-error="captchaError"
    :captcha-loading="captchaLoading"
    :captcha-skipped="captchaSkipped"
    :captcha-verified="captchaVerified"
    :captcha-widget-key="captchaWidgetKey"
    :exchange-logo-url="exchangeLogoUrl"
    :loading="loading"
    :mode="applyMode"
    :open="modalOpen"
    :site-info="meta.siteInfo"
    :submitting="submitting"
    @captcha-error="onApplyCaptchaError"
    @captcha-success="onApplyCaptchaSuccess"
    @close="closeApplyPanel"
    @reload-captcha="loadApplyCaptcha"
    @submit="submitApply"
  />
</template>

<style scoped>
.links-page {
  display: flex;
  flex-direction: column;
}

.links-page :deep(.public-site-main) {
  flex: 1;
}

.lk-head {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: end;
  justify-content: space-between;
  width: 100%;
  padding: 44px 0 6px;
}

.lk-head-copy {
  min-width: 0;
}

.lk-head .eyebrow {
  display: inline-block;
  margin-bottom: 9px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--ps-primary);
}

.lk-head h1 {
  font-size: clamp(26px, 3.4vw, 40px);
  font-weight: 800;
  letter-spacing: -0.4px;
  color: var(--ps-text);
}

.lk-head p {
  max-width: 70ch;
  margin-top: 8px;
  font-size: 13.5px;
  color: var(--ps-muted);
}

.count-badge {
  flex: none;
  padding: 8px 16px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ps-primary);
  background: rgb(var(--ps-primary-rgb) / 10%);
  border: 1px solid rgb(var(--ps-primary-rgb) / 30%);
  border-radius: 999px;
}

.lk-body {
  width: 100%;
  min-width: 0;
  padding: 16px 0 40px;
}

.apply-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: center;
  padding: 24px 26px;
  margin-top: 22px;
  background: var(--home-grad-soft);
  border: 1.5px dashed rgb(var(--ps-primary-rgb) / 45%);
  border-radius: 22px;
}

.as-copy {
  flex: 1 1 240px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.as-copy h3 {
  font-size: 16.5px;
  font-weight: 800;
  color: var(--ps-text);
}

.as-richtext {
  margin-top: 5px;
  font-size: 13px;
  line-height: 1.9;
  color: var(--ps-muted);
}

.as-richtext--plain {
  white-space: pre-line;
}

.as-richtext :deep(p) {
  margin: 0 0 8px;
}
.as-richtext :deep(p:last-child) {
  margin-bottom: 0;
}
.as-richtext :deep(strong) {
  font-weight: 800;
  color: var(--ps-primary);
}
.as-richtext :deep(ul) {
  padding-left: 20px;
  margin: 4px 0 10px;
}
.as-richtext :deep(li) {
  margin-bottom: 4px;
}
.as-richtext :deep(li::marker) {
  color: var(--ps-primary);
}

.as-btn {
  display: inline-flex;
  flex: none;
  gap: 8px;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  min-height: 48px;
  padding: 10px 26px;
  font-size: 14.5px;
  font-weight: 700;
  line-height: 1.5;
  color: #fff;
  cursor: pointer;
  background: var(--home-grad);
  border: 0;
  border-radius: 13px;
  box-shadow: 0 8px 24px rgb(var(--ps-primary-rgb) / 38%);
  transition: transform 0.2s ease;
}

.as-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.as-btn--disabled,
.as-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.as-btn:focus-visible {
  outline: 2px solid var(--ps-primary);
  outline-offset: 4px;
}

@media (max-width: 640px) {
  .lk-head {
    flex-direction: column;
    align-items: center;
    padding-top: 34px;
    text-align: center;
  }
  .lk-head p {
    margin-inline: auto;
  }
  .apply-strip {
    padding: 22px 20px;
  }
  .as-btn {
    flex: 1 1 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .as-btn {
    transition: none;
    transform: none;
  }
}
</style>
