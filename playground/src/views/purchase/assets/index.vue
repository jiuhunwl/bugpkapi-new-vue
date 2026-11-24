<script setup lang="ts">
import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, RotateCw } from '@vben/icons';

import { Button } from 'ant-design-vue';

import UserLogRetentionSettings from '#/components/call-log/UserLogRetentionSettings.vue';
import { $t } from '#/locales';

import BillingRecordPanel from './components/BillingRecordPanel.vue';
import FreeQuotaPanel from './components/FreeQuotaPanel.vue';
import RedeemCodeDialog from './components/RedeemCodeDialog.vue';
import UserPackagePanel from './components/UserPackagePanel.vue';
import WalletTransactionPanel from './components/WalletTransactionPanel.vue';
import { useUserAssets } from './composables/use-user-assets';

const {
  billingPage,
  billingRecords,
  billingLoading,
  changeBillingPage,
  changePrimaryPackage,
  changeWalletPage,
  loading,
  packageLoading,
  packages,
  quotaLoading,
  quotaOverview,
  refresh,
  walletPage,
  walletLoading,
  walletTransactions,
} = useUserAssets();

const packageCount = computed(() => packages.value.length);
const redeemDialogOpen = ref(false);

// 免费额度里的「日」窗口是用户最常看的那个数：它决定今天还能免费调用多少次。
const dayWindow = computed(() =>
  quotaOverview.value?.free.find((item) => item.window === 'day'),
);
const freeDayRemaining = computed(() => {
  const item = dayWindow.value;
  if (!item) {
    return '—';
  }
  if (item.limit <= 0) {
    return $t('system.package.assets.windowUnlimited');
  }
  return item.remaining.toLocaleString();
});
const roleName = computed(() => quotaOverview.value?.role.name || '—');
const paidAvailable = computed(() => quotaOverview.value?.paid.available === true);
</script>

<template>
  <Page>
    <div class="user-assets-page">
      <header class="user-assets-header">
        <div class="user-assets-heading">
          <span class="user-assets-icon"
            ><IconifyIcon icon="lucide:wallet-cards"
          /></span>
          <div>
            <h1>{{ $t('system.package.assets.title') }}</h1>
          </div>
        </div>
        <div class="user-assets-actions">
          <Button type="primary" @click="redeemDialogOpen = true">
            <template #icon><IconifyIcon icon="lucide:ticket-percent" /></template>
            {{ $t('system.redeem.dialog.title') }}
          </Button>
          <Button :loading="loading" @click="refresh">
            <template #icon><RotateCw /></template>
            {{ $t('system.package.assets.refresh') }}
          </Button>
        </div>
      </header>

      <RedeemCodeDialog v-model:open="redeemDialogOpen" @success="refresh" />

      <section class="asset-metrics" aria-label="asset metrics">
        <div class="asset-metric">
          <span>{{ $t('system.package.assets.roleLabel') }}</span>
          <strong>{{ roleName }}</strong>
        </div>
        <div class="asset-metric">
          <span>{{ $t('system.package.assets.windowDay') }}</span>
          <strong>{{ freeDayRemaining }}</strong>
        </div>
        <div class="asset-metric">
          <span>{{ $t('system.package.assets.activePackages') }}</span>
          <strong>{{ packageCount.toLocaleString() }}</strong>
        </div>
        <div class="asset-metric">
          <span>{{ $t('system.package.assets.paidQuotaTitle') }}</span>
          <strong>
            {{
              paidAvailable
                ? $t('system.package.assets.paidAvailable')
                : $t('system.package.assets.paidUnavailable')
            }}
          </strong>
        </div>
      </section>

      <FreeQuotaPanel
        :loading="quotaLoading"
        :overview="quotaOverview ?? undefined"
      />
      <UserPackagePanel
        :items="packages"
        :loading="packageLoading"
        :paid="quotaOverview?.paid"
        @set-primary="changePrimaryPackage"
      />
      <WalletTransactionPanel
        :items="walletTransactions"
        :loading="walletLoading"
        :page="walletPage"
        @page-change="changeWalletPage"
      />
      <BillingRecordPanel
        :items="billingRecords"
        :loading="billingLoading"
        :page="billingPage"
        @page-change="changeBillingPage"
      />
      <UserLogRetentionSettings />
    </div>
  </Page>
</template>

<style scoped>
.user-assets-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.user-assets-header {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0;
}

.user-assets-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.user-assets-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
}

.user-assets-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 8px;
}

.user-assets-icon svg {
  width: 21px;
  height: 21px;
}

.user-assets-heading h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  line-height: 28px;
  color: hsl(var(--foreground));
}

.asset-metrics {
  display: grid;
  /* 指标从 3 个变成 4 个（用户组 / 今日免费剩余 / 套餐 / 付费可用性），
     固定 3 列会让最后一个掉到下一行，改用自适应列宽。 */
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.asset-metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 16px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.asset-metric span {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.asset-metric strong {
  font-size: 24px;
  line-height: 30px;
  color: hsl(var(--foreground));
}

@media (max-width: 768px) {
  .user-assets-header {
    align-items: flex-start;
  }

  .asset-metrics {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .user-assets-header {
    flex-direction: column;
  }
}
</style>
