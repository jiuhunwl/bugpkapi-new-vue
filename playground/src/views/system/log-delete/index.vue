<script setup lang="ts">
import { Page } from '@vben/common-ui';

import AdminCallLogCleanup from '#/components/call-log/AdminCallLogCleanup.vue';
import UserLogRetentionSettings from '#/components/call-log/UserLogRetentionSettings.vue';

defineOptions({ name: 'SystemLogDelete' });
</script>

<template>
  <Page auto-content-height>
    <div class="log-cleanup-page">
      <UserLogRetentionSettings />
      <AdminCallLogCleanup />
    </div>
  </Page>
</template>

<style scoped>
.log-cleanup-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
</style>
