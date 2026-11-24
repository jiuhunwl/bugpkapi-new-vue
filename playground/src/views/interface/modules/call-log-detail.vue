<script lang="ts" setup>
import type { InterfaceApi } from '#/api/interface';

import { computed, ref, shallowRef } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  Alert,
  Descriptions,
  DescriptionsItem,
  Spin,
  Tag,
} from 'ant-design-vue';

import { getInterfaceCallLogDetail } from '#/api/interface';
import { $t } from '#/locales';
import CallLogRequestId from './CallLogRequestId.vue';

interface DrawerData {
  id: string;
  unmasked: boolean;
  userScope: boolean;
}

const detail = ref<InterfaceApi.CallLogViewItem>();
const loading = shallowRef(false);
const userScope = shallowRef(false);

const [Drawer, drawerApi] = useVbenDrawer({
  cancelText: $t('system.interface.close'),
  showConfirmButton: false,
  async onOpenChange(isOpen) {
    if (!isOpen) {
      detail.value = undefined;
      userScope.value = false;
      return;
    }
    const data = drawerApi.getData<DrawerData>();
    userScope.value = data.userScope;
    loading.value = true;
    try {
      detail.value = await getInterfaceCallLogDetail(
        data.id,
        data.userScope,
        data.unmasked,
      );
    } finally {
      loading.value = false;
    }
  },
});

const title = computed(() =>
  $t('system.interface.callLogDetailTitle', [detail.value?.id ?? '']),
);

function yesNo(value: boolean | number | undefined) {
  return value === true || value === 1 ? $t('common.yes') : $t('common.no');
}
</script>

<template>
  <Drawer :title="title" class="w-full sm:w-[720px]">
    <Spin :spinning="loading">
      <div v-if="detail" class="detail-body" data-testid="call-log-detail">
        <Descriptions bordered :column="{ xs: 1, sm: 2 }" size="small">
          <DescriptionsItem :label="$t('system.interface.usedInterface')">
            {{ detail.interfaceName }} ({{ detail.apiCode }})
          </DescriptionsItem>
          <DescriptionsItem
            v-if="!userScope"
            :label="$t('system.interface.callUsername')"
          >
            {{ detail.username }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('system.interface.requestMethod')">
            <Tag>{{ detail.requestMethod }}</Tag>
          </DescriptionsItem>
          <DescriptionsItem :label="$t('system.interface.statusCode')">
            {{ detail.responseStatus }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('system.interface.callResult')">
            {{ yesNo(detail.success) }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('system.interface.elapsedMs')">
            {{ detail.elapsedMs }} ms
          </DescriptionsItem>
          <DescriptionsItem :label="$t('system.interface.chargeType')">
            {{ detail.chargeType }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('system.interface.billingStatus')">
            {{ detail.billingStatus || '-' }}
          </DescriptionsItem>
          <DescriptionsItem
            v-if="!userScope"
            :label="$t('system.interface.clientIp')"
          >
            {{ detail.clientIp || '-' }}
          </DescriptionsItem>
          <DescriptionsItem
            v-if="!userScope"
            :label="$t('system.interface.clientRegion')"
          >
            {{ detail.clientRegion || '-' }}
          </DescriptionsItem>
          <DescriptionsItem :label="$t('system.interface.traceId')" :span="2">
            <CallLogRequestId :id="detail.traceId" />
          </DescriptionsItem>
          <DescriptionsItem :label="$t('system.interface.createTime')">
            {{ detail.createTime || '-' }}
          </DescriptionsItem>
          <DescriptionsItem
            v-if="!userScope && detail.upstreamUrl"
            :label="$t('interfaceSchema.log.upstreamUrl')"
            :span="2"
          >
            <code class="breakable">{{ detail.upstreamUrl }}</code>
          </DescriptionsItem>
        </Descriptions>

        <Alert
          v-if="detail.responseTruncated"
          show-icon
          type="warning"
          :message="
            $t('system.interface.responseTruncated', [
              detail.responseSavedBytes || 0,
              detail.responseSize || 0,
            ])
          "
        />

        <section v-if="!userScope && detail.requestValue">
          <h4>{{ $t('system.interface.linkOrValue') }}</h4>
          <pre>{{ detail.requestValue }}</pre>
        </section>
        <section v-if="detail.requestParams">
          <h4>{{ $t('system.interface.queryParams') }}</h4>
          <pre>{{ detail.requestParams }}</pre>
        </section>
        <section v-if="detail.responseBody">
          <h4>{{ $t('system.interface.responseBody') }}</h4>
          <pre>{{ detail.responseBody }}</pre>
        </section>
        <section v-if="detail.errorMessage">
          <h4>{{ $t('system.interface.errorMessage') }}</h4>
          <pre class="error-text">{{ detail.errorMessage }}</pre>
        </section>
        <section v-if="!userScope && detail.billingSnapshot">
          <h4>{{ $t('system.interface.billingSnapshot') }}</h4>
          <pre>{{ detail.billingSnapshot }}</pre>
        </section>
      </div>
    </Spin>
  </Drawer>
</template>

<style scoped>
.detail-body {
  display: grid;
  gap: 16px;
}

section h4 {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

pre {
  max-height: 320px;
  padding: 12px;
  margin: 0;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  color: hsl(var(--foreground));
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.breakable {
  word-break: break-all;
}

.error-text {
  color: hsl(var(--destructive));
}

@media (max-width: 640px) {
  .detail-body {
    gap: 12px;
  }

  pre {
    max-height: 260px;
    padding: 10px;
    font-size: 11px;
  }

  :deep(.ant-descriptions-item-label),
  :deep(.ant-descriptions-item-content) {
    padding: 9px 10px;
    overflow-wrap: anywhere;
  }
}
</style>
