<script lang="ts" setup>
import { computed, onBeforeMount, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import { IconifyIcon } from '@vben/icons';
import { BasicLayout, LockScreen, UserDropdown } from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';
import { useAccessStore, useTabbarStore, useUserStore } from '@vben/stores';

import { VbenIconButton } from '@vben-core/shadcn-ui';

import ServiceProviderAdvertisement from '#/components/advertisement/ServiceProviderAdvertisement.vue';
import MessageBell from '#/components/inbox/MessageBell.vue';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import { resolveUserAvatar } from '#/utils/user-avatar';
import LoginForm from '#/views/_core/authentication/login.vue';

const { setMenuList } = useTabbarStore();
setMenuList([
  'close',
  'affix',
  'maximize',
  'reload',
  'open-in-new-window',
  'close-left',
  'close-right',
  'close-other',
  'close-all',
]);

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const { isDark } = usePreferences();

const menus = computed(() => [
  {
    handler: () => {
      router.push({ name: 'MyOperationLog' });
    },
    icon: 'lucide:history',
    text: $t('system.operationLog.personalTitle'),
  },
  {
    handler: () => {
      router.push({ name: 'Profile' });
    },
    icon: 'lucide:user',
    text: $t('page.auth.profile'),
  },
  {
    handler: () => {
      router.push({ name: 'Home' });
    },
    icon: 'lucide:house',
    text: $t('page.console.header.backToHome'),
  },
]);

function maskEmail(email: string): string {
  if (!email) return '';
  const at = email.indexOf('@');
  if (at <= 2) return email;
  return `${email.slice(0, 2)}***${email.slice(Math.max(0, at))}`;
}

const avatar = computed(() => {
  return resolveUserAvatar(userStore.userInfo?.avatar);
});

async function handleLogout() {
  await authStore.logout(false);
}

function handleClickLogo() {
  router.push({ name: 'Home' });
}

function handleGoHome() {
  router.push({ name: 'Home' });
}

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
    isDark: isDark.value,
  }),
  async ({ enable, content, isDark: isDarkValue }) => {
    if (enable) {
      const watermarkColor = isDarkValue
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.12)';

      await updateWatermark({
        advancedStyle: {
          colorStops: [
            {
              color: watermarkColor,
              offset: 0,
            },
            {
              color: watermarkColor,
              offset: 1,
            },
          ],
          type: 'linear',
        },
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);

onBeforeMount(() => {
  if (preferences.app.watermark) {
    destroyWatermark();
  }
});
</script>

<template>
  <BasicLayout
    @clear-preferences-and-logout="handleLogout"
    @click-logo="handleClickLogo"
  >
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName"
        :description="maskEmail((userStore.userInfo as any)?.email || '')"
        trigger="both"
        @logout="handleLogout"
      />
    </template>
    <template #notification>
      <MessageBell />
    </template>
    <template #header-right-200>
      <!-- 只有图标时太容易被忽略，宽屏带上文字，窄屏退回图标 + tooltip -->
      <VbenIconButton
        class="mr-1 h-8 w-auto gap-1.5 px-2.5"
        :tooltip="$t('page.console.header.backToHome')"
        @click="handleGoHome"
      >
        <IconifyIcon icon="lucide:house" class="size-4 text-foreground" />
        <span class="hidden text-xs lg:inline">
          {{ $t('page.console.header.backToHome') }}
        </span>
      </VbenIconButton>
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
    <template #footer>
      <ServiceProviderAdvertisement class="layout-service-provider" />
    </template>
  </BasicLayout>
</template>

<style scoped>
.layout-service-provider {
  min-height: 100%;
  padding: 0 16px;
}
</style>
