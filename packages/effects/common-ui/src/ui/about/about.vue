<script setup lang="ts">
import { Page } from '../../components';

defineOptions({
  name: 'AboutUI',
});

const title = '关于 BugPk-Api';
const description =
  'BugPk-Api 是面向开放 API 管理、开放网关、套餐计费、调用日志和内容运营的一体化服务平台。';
</script>

<template>
  <Page :title="title">
    <p class="mt-3 text-sm/6 text-foreground">
      {{ description }}
    </p>
  </Page>
</template>
