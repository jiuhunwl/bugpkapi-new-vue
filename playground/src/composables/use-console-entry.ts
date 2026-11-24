import { computed, onMounted, shallowRef } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import { getAccessCodesApi, getUserInfoApi } from '#/api';
import {
  restoreAccessTokenFromCookie,
  restoreHintedAccessTokenFromCookie,
} from '#/composables/use-auth-session';
import { safeInternalRedirect } from '#/utils/safe-internal-redirect';

const CONSOLE_FALLBACK_PATH = '/console/workspace';

function normalizeConsolePath(value: unknown) {
  const path = safeInternalRedirect(value, CONSOLE_FALLBACK_PATH);
  if (path === '/') {
    return CONSOLE_FALLBACK_PATH;
  }
  return path;
}

export function useConsoleEntry() {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();
  const isConsoleNavigating = shallowRef(false);

  const consolePath = computed(() =>
    normalizeConsolePath(
      userStore.userInfo?.homePath || preferences.app.defaultHomePath,
    ),
  );
  const isSignedIn = computed(() => Boolean(accessStore.accessToken));

  onMounted(() => {
    void restoreHintedAccessTokenFromCookie();
  });

  async function ensureConsoleSession() {
    if (!accessStore.accessToken) {
      const restored = await restoreAccessTokenFromCookie();
      if (!restored) {
        return false;
      }
    }

    if (!userStore.userInfo) {
      const [userInfo, accessCodes] = await Promise.all([
        getUserInfoApi(),
        getAccessCodesApi(),
      ]);
      userStore.setUserInfo(userInfo);
      accessStore.setAccessCodes(accessCodes);
    }

    return true;
  }

  async function goToConsole() {
    if (isConsoleNavigating.value) {
      return;
    }

    isConsoleNavigating.value = true;
    try {
      const ready = await ensureConsoleSession();
      const targetPath = consolePath.value;
      await router.push(
        ready
          ? targetPath
          : {
              path: LOGIN_PATH,
              query: { redirect: encodeURIComponent(targetPath) },
            },
      );
    } finally {
      isConsoleNavigating.value = false;
    }
  }

  return {
    consolePath,
    goToConsole,
    isConsoleNavigating,
    isSignedIn,
  };
}
