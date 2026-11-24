<script setup lang="ts">
import type { AuthApi } from '#/api';
import type { FriendLinkApi } from '#/api/friend-link';

import {
  nextTick,
  onBeforeUnmount,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';

import { IconifyIcon } from '@vben/icons';

import CaptchaWidget from '#/components/captcha-widget/CaptchaWidget.vue';
import RichTextPreview from '#/components/rich-text-preview/index.vue';
import { $t } from '#/locales';
import { DEFAULT_LOGO_URL } from '#/site-brand';

type ApplyDraft = Omit<FriendLinkApi.ApplyPayload, 'captchaId' | 'language'>;

const props = defineProps<{
  applyNotice: string;
  applyNoticeIsHtml: boolean;
  canSubmit: boolean;
  captchaChallenge: AuthApi.CaptchaResult | null;
  captchaChecking: boolean;
  captchaError: string;
  captchaLoading: boolean;
  captchaSkipped: boolean;
  captchaVerified: boolean;
  captchaWidgetKey: number;
  exchangeLogoUrl: string;
  loading: boolean;
  mode: 'dialog' | 'sheet';
  open: boolean;
  siteInfo: FriendLinkApi.SiteInfo;
  submitting: boolean;
}>();

const form = defineModel<ApplyDraft>('form', { required: true });

const emit = defineEmits<{
  'captcha-error': [];
  'captcha-success': [solution: AuthApi.CaptchaVerifyPayload];
  close: [];
  'reload-captcha': [];
  submit: [];
}>();

const panel = useTemplateRef<HTMLElement>('panel');
const closeButton = useTemplateRef<HTMLButtonElement>('closeButton');
const previousFocus = shallowRef<HTMLElement | null>(null);
const previousOverflow = shallowRef<string | null>(null);
const exchangeLogo = shallowRef(props.exchangeLogoUrl);

const focusableSelector =
  'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

watch(
  () => props.exchangeLogoUrl,
  (value) => {
    exchangeLogo.value = value;
  },
);

watch(
  () => props.open,
  async (open) => {
    if (typeof document === 'undefined') return;
    if (open) {
      previousFocus.value = document.activeElement as HTMLElement | null;
      previousOverflow.value = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      await nextTick();
      closeButton.value?.focus();
      return;
    }
    restoreFocus();
  },
  { immediate: true },
);

function restoreFocus() {
  if (typeof document === 'undefined') return;
  if (previousOverflow.value !== null) {
    document.body.style.overflow = previousOverflow.value;
    previousOverflow.value = null;
  }
  previousFocus.value?.focus();
  previousFocus.value = null;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
    return;
  }
  if (event.key !== 'Tab' || !panel.value) return;
  const focusable = Array.from(
    panel.value.querySelectorAll<HTMLElement>(focusableSelector),
  );
  if (!focusable.length) return;
  const first = focusable[0]!;
  const last = focusable.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function handleExchangeLogoError(event: Event) {
  const image = event.currentTarget;
  if (!(image instanceof HTMLImageElement)) return;
  if (image.src.endsWith(DEFAULT_LOGO_URL)) return;
  exchangeLogo.value = DEFAULT_LOGO_URL;
}

onBeforeUnmount(restoreFocus);
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="friend-link-overlay" @click.self="emit('close')">
      <section
        ref="panel"
        class="friend-link-apply-panel"
        :data-apply-mode="props.mode"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('page.public.links.modal.title')"
        @keydown="handleKeydown"
      >
        <header class="apply-panel-head">
          <h2>{{ $t('page.public.links.modal.title') }}</h2>
          <button
            ref="closeButton"
            class="apply-panel-close"
            type="button"
            :aria-label="$t('page.public.aria.closeDialog')"
            @click="emit('close')"
          >
            <IconifyIcon icon="lucide:x" />
          </button>
        </header>

        <div class="apply-panel-body">
          <section class="exchange-card">
            <div class="exchange-card-identity">
              <img
                :alt="props.siteInfo.siteName"
                :src="exchangeLogo"
                @error="handleExchangeLogoError"
              />
              <div>
                <small>{{ $t('page.public.links.exchangeInfo.title') }}</small>
                <strong>{{ props.siteInfo.siteName }}</strong>
                <a
                  v-if="props.siteInfo.siteUrl"
                  :href="props.siteInfo.siteUrl"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {{ props.siteInfo.siteUrl }}
                </a>
              </div>
            </div>
            <RichTextPreview
              v-if="props.applyNoticeIsHtml"
              class="apply-notice"
              :content="props.applyNotice"
              :min-height="0"
            />
            <p v-else-if="props.applyNotice" class="apply-notice">
              {{ props.applyNotice }}
            </p>
          </section>

          <div class="apply-form-grid">
            <label>
              <span>{{ $t('page.public.links.form.siteName') }} <b>*</b></span>
              <input
                v-model="form.siteName"
                data-testid="friend-link-form-site-name"
                maxlength="80"
                :placeholder="$t('page.public.links.form.siteNamePlaceholder')"
              />
            </label>
            <label>
              <span>{{ $t('page.public.links.form.siteUrl') }} <b>*</b></span>
              <input
                v-model="form.siteUrl"
                data-testid="friend-link-form-site-url"
                :placeholder="'https://example.com'"
              />
            </label>
            <label>
              <span>{{ $t('page.public.links.form.contactEmail') }} <b>*</b></span>
              <input
                v-model="form.contactEmail"
                data-testid="friend-link-form-email"
                maxlength="128"
                type="email"
                :placeholder="$t('page.public.links.form.contactEmailPlaceholder')"
              />
            </label>
            <label>
              <span>{{ $t('page.public.links.form.contactName') }}</span>
              <input v-model="form.contactName" maxlength="64" :placeholder="$t('page.public.links.form.contactNamePlaceholder')" />
            </label>
            <label>
              <span>{{ $t('page.public.links.form.contactQq') }}</span>
              <input v-model="form.contactQq" maxlength="64" :placeholder="$t('page.public.links.form.contactQqPlaceholder')" />
            </label>
            <label>
              <span>{{ $t('page.public.links.form.logoUrl') }}</span>
              <input v-model="form.logoUrl" :placeholder="$t('page.public.links.form.logoUrlPlaceholder')" />
            </label>
            <label class="apply-field-full">
              <span>{{ $t('page.public.links.form.description') }}</span>
              <textarea v-model="form.description" maxlength="200" rows="3" :placeholder="$t('page.public.links.form.descriptionPlaceholder')"></textarea>
            </label>
            <label class="apply-field-full">
              <span>{{ $t('page.public.links.form.backlinkUrl') }}</span>
              <input v-model="form.backlinkUrl" :placeholder="$t('page.public.links.form.backlinkUrlPlaceholder')" />
            </label>
          </div>

          <section class="apply-captcha">
            <div class="apply-captcha-head">
              <span>{{ $t('page.public.links.captcha.title') }} <b>*</b></span>
              <em v-if="props.captchaChecking">{{ $t('page.public.links.captcha.checking') }}</em>
            </div>
            <div v-if="props.captchaLoading" class="apply-captcha-state">{{ $t('page.public.links.captcha.loading') }}</div>
            <div v-else-if="props.captchaVerified" class="apply-captcha-state success">{{ props.captchaSkipped ? $t('page.public.links.captcha.skipped') : $t('page.public.links.captcha.verified') }}</div>
            <div v-else-if="props.captchaError" class="apply-captcha-state error">
              <span>{{ props.captchaError }}</span>
              <button type="button" @click="emit('reload-captcha')">{{ $t('page.public.links.captcha.retry') }}</button>
            </div>
            <CaptchaWidget
              v-else-if="props.captchaChallenge"
              :key="props.captchaWidgetKey"
              :challenge="props.captchaChallenge"
              :disabled="props.captchaChecking"
              @error="emit('captcha-error')"
              @success="emit('captcha-success', $event)"
            />
          </section>
        </div>

        <footer class="apply-panel-foot">
          <button class="apply-panel-cancel" type="button" @click="emit('close')">{{ $t('page.public.actions.cancel') }}</button>
          <button
            class="apply-panel-submit"
            data-testid="friend-link-submit"
            :disabled="!props.canSubmit || props.submitting || props.loading"
            type="button"
            @click="emit('submit')"
          >
            {{ props.submitting ? $t('page.public.links.modal.submitting') : $t('page.public.links.modal.ok') }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.friend-link-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  padding: 24px;
  overflow: auto;
  background: rgb(4 8 20 / 60%);
  place-items: center;
}

.friend-link-apply-panel {
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  max-height: min(860px, calc(100vh - 48px));
  overflow: hidden;
  color: var(--ps-text, var(--home-text));
  background: var(--ps-bg-elevated, var(--home-surface-strong));
  border: 1px solid var(--ps-border, var(--home-border));
  border-radius: 18px;
  box-shadow: 0 24px 80px rgb(0 0 0 / 30%);
}

.apply-panel-head,
.apply-panel-foot {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  flex: none;
  padding: 16px 20px;
  border-bottom: 1px solid var(--ps-border, var(--home-border));
}

.apply-panel-head h2 { margin: 0; font-size: 18px; }
.apply-panel-close { display: grid; width: 44px; height: 44px; color: var(--ps-muted, var(--home-muted)); background: transparent; border: 0; border-radius: 8px; place-items: center; }
.apply-panel-close:hover { color: var(--ps-text, var(--home-text)); background: var(--ps-surface, var(--home-surface)); }
.apply-panel-body { min-height: 0; padding: 20px; overflow: auto; }
.exchange-card { padding: 14px; background: var(--ps-surface, var(--home-surface)); border: 1px solid var(--ps-border, var(--home-border)); border-radius: 12px; }
.exchange-card-identity { display: flex; gap: 12px; align-items: center; min-width: 0; }
.exchange-card-identity img { width: 42px; height: 42px; object-fit: contain; background: #fff; border-radius: 10px; }
.exchange-card-identity div { display: grid; min-width: 0; gap: 3px; }
.exchange-card-identity small { color: var(--ps-muted, var(--home-muted)); font-size: 11px; }
.exchange-card-identity strong, .exchange-card-identity a { overflow-wrap: anywhere; }
.exchange-card-identity a { color: var(--ps-primary, var(--home-primary)); font-size: 12px; }
.apply-notice { margin: 10px 0 0; color: var(--ps-muted, var(--home-muted)); font-size: 12px; line-height: 1.7; }
.apply-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
.apply-form-grid label { display: grid; gap: 6px; min-width: 0; color: var(--ps-muted, var(--home-muted)); font-size: 12px; }
.apply-form-grid label span { font-weight: 700; }
.apply-form-grid b { color: var(--ps-danger, var(--home-danger)); }
.apply-form-grid input, .apply-form-grid textarea { width: 100%; min-height: 44px; padding: 10px 12px; color: var(--ps-text, var(--home-text)); background: var(--ps-surface, var(--home-surface)); border: 1px solid var(--ps-border, var(--home-border)); border-radius: 8px; }
.apply-form-grid textarea { resize: vertical; }
.apply-field-full { grid-column: 1 / -1; }
.apply-captcha { margin-top: 16px; padding: 14px; background: var(--ps-surface, var(--home-surface)); border: 1px solid var(--ps-border, var(--home-border)); border-radius: 10px; }
.apply-captcha-head { display: flex; justify-content: space-between; min-height: 24px; color: var(--ps-muted, var(--home-muted)); font-size: 12px; }
.apply-captcha-head b { color: var(--ps-danger, var(--home-danger)); }
.apply-captcha-head em { color: var(--ps-warning, var(--home-warning)); font-style: normal; }
.apply-captcha-state { display: grid; min-height: 44px; margin-top: 8px; color: var(--ps-muted, var(--home-muted)); place-items: center; }
.apply-captcha-state.success { color: var(--ps-success, var(--home-success)); }
.apply-captcha-state.error { display: flex; gap: 10px; justify-content: space-between; color: var(--ps-danger, var(--home-danger)); }
.apply-captcha-state button { min-height: 44px; color: inherit; background: transparent; border: 1px solid currentColor; border-radius: 8px; }
.apply-panel-foot { border-top: 1px solid var(--ps-border, var(--home-border)); border-bottom: 0; justify-content: flex-end; }
.apply-panel-cancel, .apply-panel-submit { min-height: 44px; padding: 0 16px; border-radius: 8px; }
.apply-panel-cancel { color: var(--ps-text, var(--home-text)); background: transparent; border: 1px solid var(--ps-border, var(--home-border)); }
.apply-panel-submit { color: #fff; cursor: pointer; background: var(--ps-primary, var(--home-primary)); border: 0; }
.apply-panel-submit:disabled { cursor: not-allowed; opacity: 0.5; }
.apply-panel-cancel:focus-visible, .apply-panel-submit:focus-visible, .apply-form-grid input:focus-visible, .apply-form-grid textarea:focus-visible, .apply-captcha-state button:focus-visible { outline: 2px solid var(--ps-primary, var(--home-primary)); outline-offset: 2px; }

@media (max-width: 899px) {
  .friend-link-overlay { align-items: end; padding: 0; }
  .friend-link-apply-panel { width: 100%; max-height: 92vh; border-radius: 18px 18px 0 0; }
  .apply-form-grid { grid-template-columns: 1fr; }
  .apply-field-full { grid-column: auto; }
}
</style>
