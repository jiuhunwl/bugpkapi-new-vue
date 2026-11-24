<script setup lang="ts">
import type { BreadcrumbItem as DrilldownBreadcrumbItem } from './useDrilldown';

import { IconifyIcon } from '@vben/icons';

import { Breadcrumb, BreadcrumbItem, BreadcrumbSeparator } from 'ant-design-vue';

import { $t } from '#/locales';

const props = defineProps<{
  /** 面包屑列表（含"全国"根节点） */
  items: DrilldownBreadcrumbItem[];
  /** 当前粒度标签（"市级" / "区县级"） */
  granularityLabel?: string;
  /** 上一级名称（返回按钮文案） */
  parentLabel?: string;
}>();

const emit = defineEmits<{
  /** 点击面包屑某一项（index=-1 表示点击"全国"） */
  select: [index: number];
  /** 点击返回按钮 */
  back: [];
}>();

function handleClick(item: DrilldownBreadcrumbItem) {
  if (item.isLast) return;
  emit('select', item.index);
}
</script>

<template>
  <div class="drilldown-breadcrumb atlas-segment">
    <button
      v-if="props.items.length > 1"
      class="drilldown-breadcrumb__back"
      type="button"
      @click="emit('back')"
    >
      <IconifyIcon icon="lucide:arrow-left" />
      {{
        $t('adminAccess.drilldown.backTo', [
          props.parentLabel || $t('adminAccess.drilldown.upperLevel'),
        ])
      }}
    </button>
    <Breadcrumb class="drilldown-breadcrumb__crumbs">
      <BreadcrumbItem v-for="item in props.items" :key="item.index">
        <BreadcrumbSeparator v-if="item.index !== -1" />
        <span
          :class="{
            'drilldown-breadcrumb__item': true,
            'is-last': item.isLast,
            'is-clickable': !item.isLast,
          }"
          @click="handleClick(item)"
        >
          {{ item.label }}
        </span>
      </BreadcrumbItem>
    </Breadcrumb>
    <span
      v-if="props.granularityLabel"
      class="drilldown-breadcrumb__granularity"
    >
      {{ props.granularityLabel }}
    </span>
  </div>
</template>

<style scoped>
.drilldown-breadcrumb {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 6px 14px;
  min-height: 36px;
  border: 1px solid rgb(148 163 184 / 22%);
  border-radius: 9px;
  background: rgb(15 34 50 / 72%);
}

.drilldown-breadcrumb__back {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  color: #a5f3fc;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  transition:
    color 160ms ease,
    background 160ms ease;
}

.drilldown-breadcrumb__back:hover {
  color: #ecfeff;
  background: rgb(34 211 238 / 10%);
}

.drilldown-breadcrumb__crumbs {
  flex: 1;
  min-width: 0;
}

.drilldown-breadcrumb__crumbs :deep(.ant-breadcrumb) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  color: rgb(186 230 253 / 72%);
  font-size: 11px;
}

.drilldown-breadcrumb__crumbs :deep(.ant-breadcrumb-separator) {
  color: rgb(148 163 184 / 50%);
  margin: 0 4px;
}

.drilldown-breadcrumb__item {
  color: rgb(186 230 253 / 72%);
  font-size: 11px;
}

.drilldown-breadcrumb__item.is-clickable {
  cursor: pointer;
  transition: color 160ms ease;
}

.drilldown-breadcrumb__item.is-clickable:hover {
  color: #ecfeff;
}

.drilldown-breadcrumb__item.is-last {
  color: #f8fafc;
  font-weight: 600;
  cursor: default;
}

.drilldown-breadcrumb__granularity {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  padding: 2px 8px;
  border: 1px solid rgb(103 232 249 / 30%);
  border-radius: 6px;
  color: #67e8f9;
  background: rgb(8 145 178 / 14%);
  font-size: 10px;
  font-weight: 600;
}
</style>
