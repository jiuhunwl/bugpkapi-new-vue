<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';
import { RouterLink } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

interface MobileNavItem {
  external?: boolean;
  href?: string;
  key: string;
  label: string;
  to?: string;
}

const props = defineProps<{
  activeKey: string;
  items: MobileNavItem[];
  open: boolean;
  signedIn: boolean;
  navigating: boolean;
}>();

const emit = defineEmits<{
  close: [];
  console: [];
}>();

const panelRef = useTemplateRef<HTMLElement>('panel');
const previousBodyOverflow = shallowRef<string | null>(null);
const focusableSelector =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function focusFirst() {
  panelRef.value?.querySelector<HTMLElement>(focusableSelector)?.focus();
}

function restoreBodyOverflow() {
  if (
    typeof document === 'undefined' ||
    !document.body ||
    previousBodyOverflow.value === null
  ) {
    return;
  }
  document.body.style.overflow = previousBodyOverflow.value;
  previousBodyOverflow.value = null;
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
    return;
  }
  if (event.key !== 'Tab' || !panelRef.value) return;
  const focusable = Array.from(
    panelRef.value.querySelectorAll<HTMLElement>(focusableSelector),
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

watch(
  () => props.open,
  async (open) => {
    if (typeof document === 'undefined' || !document.body) return;
    if (open) {
      if (previousBodyOverflow.value === null) {
        previousBodyOverflow.value = document.body.style.overflow;
      }
      document.body.style.overflow = 'hidden';
      await nextTick();
      focusFirst();
      return;
    }
    restoreBodyOverflow();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  restoreBodyOverflow();
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="public-mobile-nav-layer"
      data-testid="public-mobile-nav"
    >
      <button
        class="public-mobile-nav-overlay"
        tabindex="-1"
        type="button"
        :aria-label="$t('page.public.aria.closeNav')"
        @click="emit('close')"
      ></button>
      <div
        ref="panel"
        class="mobile-menu-panel open"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('page.public.aria.mobileSiteNav')"
        @keydown="handleKeydown"
      >
        <button
          class="mobile-nav-close"
          type="button"
          :aria-label="$t('page.public.aria.closeNav')"
          @click="emit('close')"
        >
          <IconifyIcon icon="lucide:x" />
        </button>
        <nav class="mobile-site-nav">
          <template v-for="item in props.items" :key="item.key">
            <a
              v-if="item.external"
              :class="{ active: props.activeKey === item.key }"
              :href="item.href"
              rel="noopener noreferrer"
              target="_blank"
              @click="emit('close')"
            >
              {{ item.label }}
            </a>
            <RouterLink
              v-else
              :class="{ active: props.activeKey === item.key }"
              :to="item.to || '/'"
              @click="emit('close')"
            >
              {{ item.label }}
            </RouterLink>
          </template>
        </nav>
        <div class="mobile-menu-actions">
          <button
            v-if="props.signedIn"
            class="console-link"
            data-testid="console-entry-mobile"
            :disabled="props.navigating"
            type="button"
            @click="emit('console')"
          >
            {{ $t('page.public.actions.consoleShort') }}
          </button>
          <template v-else>
            <RouterLink class="login-link" :to="LOGIN_PATH" @click="emit('close')">
              {{ $t('page.public.actions.login') }}
            </RouterLink>
            <RouterLink class="register-link" to="/auth/register" @click="emit('close')">
              {{ $t('page.public.actions.register') }}
            </RouterLink>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.public-mobile-nav-layer {
  position: fixed;
  inset: 64px 0 0;
  z-index: 49;
}

.public-mobile-nav-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  background: var(--home-mask);
  border: 0;
}

.mobile-menu-panel {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  display: grid;
  gap: 18px;
  padding: 18px;
  background: var(--home-surface-popover);
  border-bottom: 1px solid var(--home-border);
  box-shadow: 0 16px 36px var(--home-shadow-menu);
}

.mobile-nav-close {
  display: grid;
  place-items: center;
  justify-self: end;
  width: 44px;
  height: 44px;
  color: var(--home-muted);
  background: transparent;
  border: 0;
  border-radius: 10px;
}

.mobile-site-nav {
  display: grid;
}

.mobile-site-nav a {
  padding: 14px 0;
  color: var(--home-muted);
  text-decoration: none;
  border-bottom: 1px solid var(--home-border);
}

.mobile-site-nav a.active {
  color: var(--home-primary);
}

.mobile-menu-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.mobile-menu-actions .console-link {
  grid-column: 1 / -1;
}

.login-link,
.register-link,
.console-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 16px;
  font-weight: 700;
  text-decoration: none;
  border-radius: 8px;
}

.login-link {
  color: var(--home-text);
  border: 1px solid var(--home-border-strong);
}

.register-link,
.console-link {
  color: #fff;
  background: var(--home-primary);
}
</style>
