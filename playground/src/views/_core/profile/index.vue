<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Profile } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { $t } from '#/locales';
import { resolveUserAvatar } from '#/utils/user-avatar';

import ProfileBase from './base-setting.vue';
import ProfilePasswordSetting from './password-setting.vue';
import ProfilePasswordSetup from './password-setup.vue';
import ProfileSecuritySetting from './security-setting.vue';

const userStore = useUserStore();
const route = useRoute();
const router = useRouter();

const profileUserInfo = computed(() => ({
  ...userStore.userInfo,
  avatar: resolveUserAvatar(userStore.userInfo?.avatar),
  realName:
    userStore.userInfo?.realName ||
    userStore.userInfo?.username ||
    $t('profile.defaultUser'),
  userId: userStore.userInfo?.userId || '',
  username: userStore.userInfo?.username || '',
}));

const tabsValue = ref('basic');
const needsPasswordSetup = computed(
  () => (userStore.userInfo as any)?.passwordSet === false,
);
const tabs = computed(() => [
  { label: $t('profile.tabs.basic'), value: 'basic' },
  ...(needsPasswordSetup.value
    ? [{ label: $t('profile.tabs.passwordSetup'), value: 'password-setup' }]
    : []),
  { label: $t('profile.tabs.security'), value: 'security' },
  { label: $t('profile.tabs.password'), value: 'password' },
]);

onMounted(() => {
  if (route.query.oauth === 'auto') {
    tabsValue.value = 'password-setup';
    message.info($t('profile.password.setDescription'));
    void router.replace({ path: route.path, query: {} });
    return;
  }
  if (route.query.oauth === 'bound') {
    tabsValue.value = 'security';
    message.success($t('oauth.bindings.boundSuccess'));
    void router.replace({ path: route.path, query: {} });
    return;
  }
  if (route.query.oauth_error) {
    tabsValue.value = 'security';
    message.error($t('oauth.bindings.bindFailed'));
    void router.replace({ path: route.path, query: {} });
    return;
  }
  if (route.query.qqBind === 'success') {
    tabsValue.value = 'security';
    message.success($t('profile.security.boundSuccess'));
    void router.replace({ path: route.path, query: {} });
    return;
  }
  const qqError = String(route.query.qqError || '').trim();
  if (route.query.qqBind === 'failed' || qqError) {
    tabsValue.value = 'security';
    message.error(qqError || $t('profile.security.boundFailed'));
    void router.replace({ path: route.path, query: {} });
  }
});
</script>

<template>
  <Profile
    v-model:model-value="tabsValue"
    :title="$t('profile.title')"
    :user-info="profileUserInfo"
    :tabs="tabs"
  >
    <template #content>
      <ProfileBase v-if="tabsValue === 'basic'" />
      <ProfilePasswordSetup
        v-else-if="tabsValue === 'password-setup'"
        @success="tabsValue = 'security'"
      />
      <ProfileSecuritySetting v-else-if="tabsValue === 'security'" />
      <ProfilePasswordSetting v-else />
    </template>
  </Profile>
</template>
