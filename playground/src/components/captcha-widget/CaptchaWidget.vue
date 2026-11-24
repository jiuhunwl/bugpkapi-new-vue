<script setup lang="ts">
import type { AuthApi } from '#/api';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';

import { SliderCaptcha } from '@vben/common-ui';

import { $t } from '#/locales';

import { createCaptchaSolutionGuard } from './captcha-solution-guard';

interface GeeTestValidate {
  captcha_output?: string;
  gen_time?: string;
  lot_number?: string;
  pass_token?: string;
}

interface GeeTestCaptcha {
  appendTo(target: HTMLElement | string): void;
  destroy?: () => void;
  getValidate?: () => GeeTestValidate | null;
  onClose?: (callback: () => void) => GeeTestCaptcha | void;
  onError?: (callback: (...args: unknown[]) => void) => GeeTestCaptcha | void;
  onReady?: (callback: () => void) => GeeTestCaptcha | void;
  onSuccess?: (callback: () => void) => GeeTestCaptcha | void;
  reset?: () => void;
  showCaptcha?: () => void;
}

interface GeeTestGlobal {
  initGeetest4?: (
    options: Record<string, unknown>,
    callback: (captcha: GeeTestCaptcha) => void,
  ) => void;
}

interface TurnstileGlobal {
  remove?: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: {
      action?: string;
      callback: (token: string) => void;
      cData?: string;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      sitekey: string;
      'timeout-callback'?: () => void;
    },
  ) => string;
}

type CaptchaWindow = Window & {
  initGeetest4?: GeeTestGlobal['initGeetest4'];
  turnstile?: TurnstileGlobal;
};

const props = defineProps<{
  challenge: AuthApi.CaptchaResult | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  error: [error: Error];
  success: [solution: AuthApi.CaptchaVerifyPayload];
}>();

const containerRef = useTemplateRef<HTMLDivElement>('container');
const powCaptchaRef =
  useTemplateRef<InstanceType<typeof SliderCaptcha>>('powCaptcha');
const externalCaptcha = shallowRef<GeeTestCaptcha | null>(null);
const turnstileWidgetID = shallowRef<string | null>(null);
const loading = ref(false);
const geeTestReady = ref(false);
// 保存翻译 key 而不是已翻译文案，语言切换时提示能立即跟随刷新。
const statusMessageKey = ref('');
const statusMessage = computed(() =>
  statusMessageKey.value ? $t(statusMessageKey.value) : '',
);
let mounted = false;
const solutionGuard = createCaptchaSolutionGuard();

const GEETEST_SCRIPT = 'https://static.geetest.com/v4/gt4.js';
const TURNSTILE_SCRIPT =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const scriptPromises = new Map<string, Promise<void>>();

const provider = computed(() => props.challenge?.provider || 'pow');
const geeTestProduct = computed(() => {
  const value = metaString('product');
  return value === 'bind' || value === 'popup' ? value : 'float';
});

function metaString(key: string) {
  const value = props.challenge?.meta?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function loadScript(src: string, marker: string, ready: () => boolean) {
  if (ready()) return Promise.resolve();
  const pending = scriptPromises.get(marker);
  if (pending) return pending;

  const selector = `script[data-bugpk-captcha="${marker}"]`;
  document.querySelector<HTMLScriptElement>(selector)?.remove();
  const element = document.createElement('script');
  element.async = true;
  element.dataset.bugpkCaptcha = marker;
  element.src = src;

  const promise = new Promise<void>((resolve, reject) => {
    element.addEventListener(
      'load',
      () => {
        if (ready()) {
          resolve();
          return;
        }
        reject(new Error(`${marker} SDK loaded without its global API`));
      },
      { once: true },
    );
    element.addEventListener(
      'error',
      () => reject(new Error(`${marker} SDK failed to load`)),
      { once: true },
    );
    document.head.appendChild(element);
  }).catch((error: unknown) => {
    element.remove();
    scriptPromises.delete(marker);
    throw error instanceof Error ? error : new Error(String(error));
  });

  scriptPromises.set(marker, promise);
  return promise;
}

function cleanupWidget() {
  geeTestReady.value = false;
  externalCaptcha.value?.destroy?.();
  externalCaptcha.value = null;
  const turnstile = (window as CaptchaWindow).turnstile;
  if (turnstileWidgetID.value && turnstile?.remove) {
    turnstile.remove(turnstileWidgetID.value);
  }
  turnstileWidgetID.value = null;
  containerRef.value?.replaceChildren();
}

function emitSolution(
  solution: AuthApi.CaptchaVerifyPayload,
  currentGeneration: number,
) {
  if (
    props.disabled ||
    !mounted ||
    !solutionGuard.accept(
      currentGeneration,
      props.challenge?.captchaId || '',
    )
  ) {
    return;
  }
  emit('success', solution);
}

function reportError(error: unknown, messageKey?: string) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  statusMessageKey.value = messageKey || 'captchaWidget.loadFailed';
  emit('error', normalized);
}

function emitGeeTestResult(captcha: GeeTestCaptcha, currentGeneration: number) {
  if (
    props.disabled ||
    !mounted ||
    currentGeneration !== solutionGuard.current()
  ) {
    return;
  }
  const result = captcha.getValidate?.();
  if (
    result?.lot_number &&
    result.captcha_output &&
    result.pass_token &&
    result.gen_time
  ) {
    emitSolution({
      captcha_output: result.captcha_output,
      gen_time: result.gen_time,
      lot_number: result.lot_number,
      pass_token: result.pass_token,
    }, currentGeneration);
    return;
  }
  reportError(
    new Error('GeeTest returned an incomplete response'),
    'captchaWidget.geeTestIncomplete',
  );
}

async function mountGeeTest(currentGeneration: number) {
  const captchaID = metaString('captchaId');
  if (!captchaID || !containerRef.value) {
    throw new Error('GeeTest captchaId is missing');
  }
  await loadScript(
    GEETEST_SCRIPT,
    'geetest4',
    () => typeof (window as CaptchaWindow).initGeetest4 === 'function',
  );
  if (
    !mounted ||
    currentGeneration !== solutionGuard.current() ||
    !containerRef.value
  ) {
    return;
  }
  const init = (window as CaptchaWindow).initGeetest4;
  if (!init) throw new Error('GeeTest initGeetest4 is unavailable');

  await new Promise<void>((resolve) => {
    init(
      {
        captchaId: captchaID,
        language: metaString('language') || undefined,
        onError: (error: unknown) => {
          if (mounted && currentGeneration === solutionGuard.current()) {
            reportError(error, $t('captchaWidget.geeTestInitFailed'));
          }
          resolve();
        },
        product: geeTestProduct.value,
      },
      (captcha) => {
        if (
          !mounted ||
          currentGeneration !== solutionGuard.current() ||
          !containerRef.value
        ) {
          captcha.destroy?.();
          resolve();
          return;
        }
        externalCaptcha.value = captcha;
        captcha.onSuccess?.(() =>
          emitGeeTestResult(captcha, currentGeneration),
        );
        captcha.onError?.(() => {
          if (mounted && currentGeneration === solutionGuard.current()) {
            reportError(
              new Error('GeeTest validation failed'),
              'captchaWidget.geeTestFailed',
            );
          }
        });
        captcha.onClose?.(() => {
          if (mounted && currentGeneration === solutionGuard.current()) {
            statusMessageKey.value = 'captchaWidget.notCompleted';
          }
        });
        if (captcha.onReady) {
          captcha.onReady(() => {
            if (mounted && currentGeneration === solutionGuard.current()) {
              geeTestReady.value = true;
              statusMessageKey.value = '';
            }
          });
        } else {
          geeTestReady.value = true;
        }
        if (geeTestProduct.value !== 'bind') {
          captcha.appendTo(containerRef.value);
        }
        resolve();
      },
    );
  });
}

async function mountTurnstile(currentGeneration: number) {
  const siteKey = metaString('siteKey');
  if (!siteKey || !containerRef.value) {
    throw new Error('Cloudflare Turnstile siteKey is missing');
  }
  await loadScript(
    TURNSTILE_SCRIPT,
    'cloudflare-turnstile',
    () => Boolean((window as CaptchaWindow).turnstile),
  );
  if (
    !mounted ||
    currentGeneration !== solutionGuard.current() ||
    !containerRef.value
  ) {
    return;
  }
  const turnstile = (window as CaptchaWindow).turnstile;
  if (!turnstile) throw new Error('Cloudflare Turnstile API is unavailable');
  turnstileWidgetID.value = turnstile.render(containerRef.value, {
    action: metaString('action') || undefined,
    callback: (token) => {
      if (
        token &&
        !props.disabled &&
        mounted &&
        currentGeneration === solutionGuard.current()
      ) {
        statusMessageKey.value = '';
        emitSolution({ token }, currentGeneration);
      }
    },
    cData: metaString('cData') || undefined,
    'error-callback': () => {
      if (mounted && currentGeneration === solutionGuard.current()) {
        reportError(
          new Error('Cloudflare Turnstile validation failed'),
          'captchaWidget.turnstileFailed',
        );
      }
    },
    'expired-callback': () => {
      if (mounted && currentGeneration === solutionGuard.current()) {
        statusMessageKey.value = 'captchaWidget.expired';
      }
    },
    sitekey: siteKey,
    'timeout-callback': () => {
      if (mounted && currentGeneration === solutionGuard.current()) {
        statusMessageKey.value = 'captchaWidget.timeout';
      }
    },
  });
}

async function initialize() {
  if (!mounted) return;
  const currentGeneration = solutionGuard.begin(
    props.challenge?.captchaId || '',
  );
  cleanupWidget();
  statusMessageKey.value = '';
  if (!props.challenge || provider.value === 'pow') return;
  loading.value = true;
  try {
    if (provider.value === 'geetest4') {
      await mountGeeTest(currentGeneration);
    } else if (provider.value === 'cloudflare') {
      await mountTurnstile(currentGeneration);
    } else {
      throw new Error(`Unsupported captcha provider: ${provider.value}`);
    }
  } catch (error) {
    if (currentGeneration === solutionGuard.current()) reportError(error);
  } finally {
    if (currentGeneration === solutionGuard.current()) loading.value = false;
  }
}

function showGeeTestCaptcha() {
  if (props.disabled || !geeTestReady.value) return;
  statusMessageKey.value = '';
  externalCaptcha.value?.showCaptcha?.();
}

function onPowSuccess(values: { time?: number | string }) {
  if (
    !props.disabled &&
    (typeof values.time === 'number' || typeof values.time === 'string')
  ) {
    emitSolution({ time: String(values.time) }, solutionGuard.current());
  }
}

function resume() {
  solutionGuard.retry();
  if (provider.value === 'pow') {
    powCaptchaRef.value?.resume?.();
    return;
  }
  void initialize();
}

defineExpose({ resume });

onMounted(() => {
  mounted = true;
  void initialize();
});

watch(
  () => props.challenge?.captchaId,
  () => {
    if (mounted) void initialize();
  },
);

onBeforeUnmount(() => {
  mounted = false;
  solutionGuard.invalidate();
  cleanupWidget();
});
</script>

<template>
  <div class="captcha-widget">
    <SliderCaptcha
      v-if="provider === 'pow'"
      :key="props.challenge?.captchaId || 'captcha-empty'"
      ref="powCaptcha"
      @success="onPowSuccess"
    />
    <template v-else>
      <button
        v-if="provider === 'geetest4' && geeTestProduct === 'bind'"
        class="captcha-widget__geetest-button"
        :disabled="props.disabled || !geeTestReady || loading"
        type="button"
        @click="showGeeTestCaptcha"
      >
        {{
          geeTestReady
            ? $t('captchaWidget.geeTestButton')
            : $t('captchaWidget.preparing')
        }}
      </button>
      <div
        ref="container"
        class="captcha-widget__container"
        :class="{
          'captcha-widget__container--bind':
            provider === 'geetest4' && geeTestProduct === 'bind',
        }"
      />
    </template>
    <div v-if="loading" class="captcha-widget__status">
      {{ $t('captchaWidget.loading') }}
    </div>
    <div
      v-else-if="statusMessage"
      class="captcha-widget__status captcha-widget__status--error"
    >
      {{ statusMessage }}
      <button class="captcha-widget__retry" type="button" @click="initialize">
        {{ $t('captchaWidget.retry') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.captcha-widget {
  min-height: 44px;
}

.captcha-widget__container {
  min-height: 44px;
}

.captcha-widget__container--bind {
  min-height: 0;
}

.captcha-widget__geetest-button {
  width: 100%;
  min-height: 44px;
  padding: 0 16px;
  color: hsl(var(--primary-foreground));
  cursor: pointer;
  background: hsl(var(--primary));
  border: 0;
  border-radius: 6px;
}

.captcha-widget__geetest-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.captcha-widget__status {
  padding: 8px 10px;
  margin-top: 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.captcha-widget__status--error {
  color: hsl(var(--destructive));
}

.captcha-widget__retry {
  margin-left: 8px;
  color: hsl(var(--primary));
  cursor: pointer;
  text-decoration: underline;
}
</style>
