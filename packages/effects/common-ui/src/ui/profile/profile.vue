<script setup lang="ts">
import type { Props } from './types';

import { preferences } from '@vben-core/preferences';
import {
  Card,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  VbenAvatar,
} from '@vben-core/shadcn-ui';

import { Page } from '../../components';

defineOptions({
  name: 'ProfileUI',
});

withDefaults(defineProps<Props>(), {
  title: '关于项目',
  tabs: () => [],
});

const tabsValue = defineModel<string>('modelValue');
</script>
<template>
  <Page auto-content-height :title="title">
    <div
      class="grid size-full min-h-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]"
    >
      <Card class="min-w-0 p-4 lg:p-5">
        <div
          class="flex items-center gap-4 lg:flex-col lg:justify-center lg:py-4 lg:text-center"
        >
          <VbenAvatar
            :src="userInfo?.avatar ?? preferences.app.defaultAvatar"
            class="size-16 shrink-0 lg:size-20"
          />
          <div class="min-w-0">
            <div class="truncate text-lg font-semibold">
              {{ userInfo?.realName ?? '' }}
            </div>
            <div class="mt-1 truncate text-sm text-foreground/70">
              {{ userInfo?.username ?? '' }}
            </div>
          </div>
        </div>
        <Separator class="my-4" />
        <Tabs v-model="tabsValue" class="lg:hidden">
          <TabsList
            class="flex h-auto w-full justify-start gap-1 overflow-x-auto bg-card p-0"
          >
            <TabsTrigger
              v-for="tab in tabs"
              :key="tab.value"
              :value="tab.value"
              class="h-10 shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs
          v-model="tabsValue"
          orientation="vertical"
          class="hidden lg:block"
        >
          <TabsList class="grid h-auto w-full grid-cols-1 gap-1 bg-card p-0">
            <TabsTrigger
              v-for="tab in tabs"
              :key="tab.value"
              :value="tab.value"
              class="h-12 justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>
      <Card class="min-w-0 overflow-auto p-4 sm:p-6 lg:p-8">
        <slot name="content"></slot>
      </Card>
    </div>
  </Page>
</template>
