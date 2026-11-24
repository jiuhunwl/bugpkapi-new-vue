<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { Fallback } from '@vben/common-ui';

import PublicNotFound from './public-not-found.vue';

defineOptions({ name: 'Fallback404Demo' });

const route = useRoute();
const isConsolePath = computed(() => route.path.startsWith('/console/'));
</script>

<template>
  <Fallback v-if="isConsolePath" status="404" />
  <PublicNotFound v-else />
</template>
