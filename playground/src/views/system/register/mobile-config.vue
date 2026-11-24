<script setup lang="ts">
import { Fallback, Page } from '@vben/common-ui';

import { $t } from '#/locales';

defineOptions({ name: 'MobileVerificationConfig' });
</script>

<template>
  <Page auto-content-height>
    <Fallback
      :description="$t('smsPending.description')"
      status="coming-soon"
      :title="$t('smsPending.title')"
    />
  </Page>
</template>
