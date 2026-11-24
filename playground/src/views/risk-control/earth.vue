<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

const router = useRouter();

onMounted(() => {
  void router.replace('/risk-control/dashboard');
});
</script>

<template>
  <Page>
    <div class="legacy-earth-redirect" role="status">
      <IconifyIcon icon="lucide:loader-circle" class="animate-spin" />
      <span>{{ $t('system.riskControl.earthRedirect') }}</span>
    </div>
  </Page>
</template>

<style scoped>
.legacy-earth-redirect {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  color: rgb(100 116 139);
  font-size: 14px;
}

.legacy-earth-redirect svg {
  width: 20px;
  height: 20px;
  color: hsl(var(--primary));
}
</style>
