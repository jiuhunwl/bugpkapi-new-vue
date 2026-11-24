<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { $t } from '#/locales';

import ListPanel from '../modules/list-panel.vue';
import TickerPanel from '../modules/ticker-panel.vue';
import {
  type NoticeHubTab,
  preferredNoticeHubTab,
  resolveNoticeHubTab,
} from './tabs';

const accessStore = useAccessStore();
const userStore = useUserStore();
const route = useRoute();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) => isAdmin.value || accessStore.accessCodes.includes(code);
const canList = computed(() => hasCode('notice:list'));
const canTicker = computed(() => hasCode('notice:home-config'));

const listPanel = ref<InstanceType<typeof ListPanel> | null>(null);

function tabInput() {
  return {
    canList: canList.value,
    canTicker: canTicker.value,
    queryTab: route.query.tab,
    routeName: route.name,
  };
}

const activeTab = ref<NoticeHubTab>(resolveNoticeHubTab(tabInput()));

watch(
  () => [route.name, route.query.tab],
  () => {
    const preferred = preferredNoticeHubTab(tabInput());
    if (preferred) activeTab.value = preferred;
  },
);

// 滚动位保存后会落地成一条公告，列表页签需要同步刷新。
function onTickerSaved() {
  listPanel.value?.reload();
}
</script>

<template>
  <Page auto-content-height>
    <div class="nh-page">
      <section class="nh-hero">
        <span class="nh-hero__badge">
          <IconifyIcon icon="mdi:bullhorn-outline" />
        </span>
        <div class="min-w-0">
          <h1 class="nh-hero__title">{{ $t('noticeAdmin.hub.title') }}</h1>
          <p class="nh-hero__desc">{{ $t('noticeAdmin.hub.description') }}</p>
        </div>
      </section>

      <div class="nh-tabs">
        <div class="nh-tabs__bar">
          <button
            v-if="canList"
            class="nh-tab"
            :class="{ 'is-active': activeTab === 'list' }"
            type="button"
            @click="activeTab = 'list'"
          >
            <IconifyIcon class="size-4" icon="mdi:clipboard-text-outline" />
            {{ $t('noticeAdmin.hub.tabs.list') }}
          </button>
          <button
            v-if="canTicker"
            class="nh-tab"
            :class="{ 'is-active': activeTab === 'ticker' }"
            type="button"
            @click="activeTab = 'ticker'"
          >
            <IconifyIcon class="size-4" icon="mdi:home-outline" />
            {{ $t('noticeAdmin.hub.tabs.ticker') }}
          </button>
        </div>

        <div v-if="activeTab === 'list' && canList" class="nh-pane">
          <ListPanel ref="listPanel" />
        </div>
        <div v-else-if="activeTab === 'ticker' && canTicker" class="nh-pane">
          <TickerPanel @saved="onTickerSaved" />
        </div>
        <div v-else class="nh-pane nh-pane__denied">
          {{ $t('noticeAdmin.hub.noTab') }}
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.nh-page {
  /* Page auto-content-height 只保证内容区自身有高度，slot 子元素必须自己撑满，
     否则下方 Grid 的 h-full / vxe height:auto 全链塌陷，表体被压成几十像素。 */
  height: 100%;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.nh-hero {
  display: flex;
  flex: none;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.nh-hero__badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 12%);
  border-radius: 10px;
}

.nh-hero__title {
  font-size: 16px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.nh-hero__desc {
  margin-top: 2px;
  font-size: 12.5px;
  color: hsl(var(--muted-foreground));
}

.nh-tabs {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 10px 14px 14px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.nh-tabs__bar {
  display: flex;
  flex: none;
  gap: 6px;
  align-self: flex-start;
  padding: 3px;
  margin-bottom: 12px;
  background: hsl(var(--muted) / 55%);
  border-radius: 10px;
}

.nh-tab {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 6px 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.nh-tab:hover {
  color: hsl(var(--foreground));
}

.nh-tab.is-active {
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
}

.nh-pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}

.nh-pane__denied {
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}
</style>
