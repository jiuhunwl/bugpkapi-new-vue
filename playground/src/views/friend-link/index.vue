<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FriendLinkApi } from '#/api/friend-link';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Button,
  Checkbox,
  Drawer,
  Input,
  message,
  Modal,
  Select,
  Tooltip,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  approveFriendLinkApplication,
  getAdminFriendLinkApplications,
  getPublicFriendLinkMeta,
  rejectFriendLinkApplication,
} from '#/api/friend-link';
import { $t } from '#/locales';

import ConfigPanel from './modules/config-panel.vue';
import LinksPanel from './modules/links-panel.vue';
import { useApplicationColumns } from './data';

// 撤回（WITHDRAWN）由申请人自己发起，管理员没有处置动作，
// 但记录仍要能被单独筛出来，否则只能混在「全部」里靠肉眼分辨。
type ApplicationFilter = FriendLinkApi.ApplicationStatus | 'ALL';
type ReviewAction = 'approve' | 'reject';
type TabKey = 'applications' | 'config' | 'links';

interface FilterOption {
  hint: string;
  key: ApplicationFilter;
  label: string;
  tone: 'approved' | 'pending' | 'rejected' | 'total' | 'withdrawn';
}

interface ReasonTemplateOption {
  label: string;
  reason: string;
  value: string;
}

const accessStore = useAccessStore();
const userStore = useUserStore();
const route = useRoute();
const router = useRouter();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const canList = computed(() => hasCode('friend-link:application:list'));
const canReview = computed(() => hasCode('friend-link:application:review'));
const canConfig = computed(() => hasCode('friend-link:config:update'));
const canManageLinks = computed(() => hasCode('friend-link:list'));

// 友情链接 / 友链中心 / 友链配置三条历史菜单收敛成同一个页面：路由名只决定默认
// 页签，旧书签与旧角色授权都能落到自己有权限的那一页，不会走进死路由。
const TAB_BY_ROUTE_NAME: Record<string, TabKey> = {
  FriendLinkApplications: 'applications',
  FriendLinkCenter: 'applications',
  FriendLinkConfig: 'config',
  FriendLinkList: 'links',
};

const TAB_VALUES: TabKey[] = ['applications', 'links', 'config'];

function canAccess(tab: TabKey) {
  if (tab === 'applications') return canList.value;
  return tab === 'config' ? canConfig.value : canManageLinks.value;
}

function preferredTab(): TabKey | '' {
  const queryTab = String(route.query.tab ?? '') as TabKey;
  if (TAB_VALUES.includes(queryTab)) return queryTab;
  return TAB_BY_ROUTE_NAME[String(route.name ?? '')] ?? '';
}

function firstAccessibleTab(): TabKey {
  const tabs: TabKey[] = ['applications', 'links', 'config'];
  return tabs.find((tab) => canAccess(tab)) ?? 'applications';
}

function initialTab(): TabKey {
  const preferred = preferredTab();
  return preferred && canAccess(preferred) ? preferred : firstAccessibleTab();
}
const activeTab = ref<TabKey>(initialTab());
const publicPageHref = computed(
  () => router.resolve({ name: 'FriendLinks' }).href,
);

watch(
  () => [route.name, route.query.tab],
  () => {
    const preferred = preferredTab();
    if (preferred && canAccess(preferred)) {
      activeTab.value = preferred;
    }
  },
);

const keyword = ref('');
const statusFilter = ref<ApplicationFilter>('ALL');
const stats = reactive<Record<ApplicationFilter, null | number>>({
  ALL: null,
  APPROVED: null,
  PENDING: null,
  REJECTED: null,
  WITHDRAWN: null,
});
const applyEnabled = ref<boolean | null>(null);

const detailOpen = ref(false);
const detailRow = ref<FriendLinkApi.FriendLinkApplication | null>(null);
const reviewModalOpen = ref(false);
const reviewAction = ref<ReviewAction>('approve');
const reviewReason = ref('');
const reviewReasonTemplate = ref('');
const reviewSendEmail = ref(true);
const pendingReviewRow = ref<FriendLinkApi.FriendLinkApplication | null>(null);
const reviewLoading = ref(false);

const filterOptions = computed<FilterOption[]>(() => [
  {
    hint: $t('friendLinkReview.hub.filters.allHint'),
    key: 'ALL',
    label: $t('friendLinkReview.hub.filters.all'),
    tone: 'total',
  },
  {
    hint: $t('friendLinkReview.hub.filters.pendingHint'),
    key: 'PENDING',
    label: $t('friendLinkReview.hub.filters.pending'),
    tone: 'pending',
  },
  {
    hint: $t('friendLinkReview.hub.filters.approvedHint'),
    key: 'APPROVED',
    label: $t('friendLinkReview.hub.filters.approved'),
    tone: 'approved',
  },
  {
    hint: $t('friendLinkReview.hub.filters.rejectedHint'),
    key: 'REJECTED',
    label: $t('friendLinkReview.hub.filters.rejected'),
    tone: 'rejected',
  },
  {
    hint: $t('friendLinkReview.hub.filters.withdrawnHint'),
    key: 'WITHDRAWN',
    label: $t('friendLinkReview.hub.filters.withdrawn'),
    tone: 'withdrawn',
  },
]);

const approveReasonTemplates = computed<ReasonTemplateOption[]>(() => [
  {
    label: $t('friendLinkReview.templates.approved.label'),
    reason: $t('friendLinkReview.templates.approved.reason'),
    value: 'approved',
  },
  {
    label: $t('friendLinkReview.templates.custom.label'),
    reason: '',
    value: 'custom',
  },
]);

const rejectReasonTemplates = computed<ReasonTemplateOption[]>(() => [
  {
    label: $t('friendLinkReview.templates.siteUnreachable.label'),
    reason: $t('friendLinkReview.templates.siteUnreachable.reason'),
    value: 'site_unreachable',
  },
  {
    label: $t('friendLinkReview.templates.backlinkMissing.label'),
    reason: $t('friendLinkReview.templates.backlinkMissing.reason'),
    value: 'backlink_missing',
  },
  {
    label: $t('friendLinkReview.templates.informationIncomplete.label'),
    reason: $t('friendLinkReview.templates.informationIncomplete.reason'),
    value: 'information_incomplete',
  },
  {
    label: $t('friendLinkReview.templates.contentMismatch.label'),
    reason: $t('friendLinkReview.templates.contentMismatch.reason'),
    value: 'content_mismatch',
  },
  {
    label: $t('friendLinkReview.templates.custom.label'),
    reason: '',
    value: 'custom',
  },
]);

const activeReasonTemplates = computed(() =>
  reviewAction.value === 'approve'
    ? approveReasonTemplates.value
    : rejectReasonTemplates.value,
);
const reasonTemplateOptions = computed(() =>
  activeReasonTemplates.value.map(({ label, value }) => ({ label, value })),
);
const reviewModalTitle = computed(() =>
  $t(`friendLinkReview.${reviewAction.value}.title`),
);
const reviewModalDescription = computed(() =>
  $t(`friendLinkReview.${reviewAction.value}.description`),
);
const reviewActionText = computed(() =>
  $t(`friendLinkReview.${reviewAction.value}.action`),
);
const reasonTemplateLabels = computed<Record<string, string>>(() => ({
  approved: $t('friendLinkReview.templates.approved.label'),
  backlink_missing: $t('friendLinkReview.templates.backlinkMissing.label'),
  content_mismatch: $t('friendLinkReview.templates.contentMismatch.label'),
  custom: $t('friendLinkReview.templates.custom.label'),
  information_incomplete: $t(
    'friendLinkReview.templates.informationIncomplete.label',
  ),
  site_unreachable: $t('friendLinkReview.templates.siteUnreachable.label'),
}));

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useApplicationColumns(canReview.value),
    emptyText: $t('friendLinkReview.hub.empty.title'),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          const result = await getAdminFriendLinkApplications({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...(keyword.value.trim() ? { keyword: keyword.value.trim() } : {}),
            ...(statusFilter.value === 'ALL'
              ? {}
              : { status: statusFilter.value }),
          });
          return result;
        },
      },
    },
    rowClassName: ({ row }) =>
      row.status === 'PENDING' ? 'fl-row--pending' : '',
    rowConfig: { keyField: 'id', height: 48 },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions<FriendLinkApi.FriendLinkApplication>,
});

onMounted(() => {
  if (activeTab.value === 'applications') {
    void refreshStats();
  }
  void loadApplyState();
});

watch(activeTab, (tab) => {
  if (tab === 'applications') {
    void refreshStats();
  }
});

async function loadApplyState() {
  try {
    const meta = await getPublicFriendLinkMeta();
    applyEnabled.value = meta.config.applyEnabled === 1;
  } catch {
    applyEnabled.value = null;
  }
}

async function refreshStats() {
  if (!canList.value) return;
  const keys: ApplicationFilter[] = [
    'ALL',
    'PENDING',
    'APPROVED',
    'REJECTED',
    'WITHDRAWN',
  ];
  const results = await Promise.allSettled(
    keys.map((key) =>
      getAdminFriendLinkApplications({
        page: 1,
        pageSize: 1,
        ...(key === 'ALL' ? {} : { status: key }),
      }),
    ),
  );
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      stats[keys[index]!] = result.value.total ?? 0;
    }
  });
}

function selectFilter(key: ApplicationFilter) {
  if (statusFilter.value === key) return;
  statusFilter.value = key;
  void gridApi.query();
}

function onKeywordSearch() {
  void gridApi.query();
}

function onKeywordChange() {
  if (!keyword.value.trim()) {
    void gridApi.query();
  }
}

function onConfigSaved(enabled: boolean) {
  applyEnabled.value = enabled;
  void refreshStats();
}

function statusText(status: FriendLinkApi.ApplicationStatus) {
  const key = `friendLinkReview.status.${String(status).toLowerCase()}`;
  const text = $t(key);
  return text === key ? $t('friendLinkReview.statusUnknown') : text;
}

function statusTone(status: FriendLinkApi.ApplicationStatus) {
  switch (status) {
    case 'APPROVED': {
      return 'approved';
    }
    case 'REJECTED': {
      return 'rejected';
    }
    case 'WITHDRAWN': {
      return 'withdrawn';
    }
    default: {
      return 'pending';
    }
  }
}

function languageText(language: FriendLinkApi.Language) {
  return language === 'en'
    ? $t('friendLinkReview.languages.en')
    : $t('friendLinkReview.languages.zh');
}

function reasonTemplateText(value?: string) {
  if (!value) return '';
  return reasonTemplateLabels.value[value] ?? value;
}

function shortUrl(url?: string) {
  if (!url) return '';
  return url.replace(/^https?:\/\//, '');
}

function initial(name?: string) {
  return name?.trim().slice(0, 1) || 'L';
}

function openDetail(row: FriendLinkApi.FriendLinkApplication) {
  detailRow.value = row;
  detailOpen.value = true;
}

function reviewFromDetail(action: ReviewAction) {
  const row = detailRow.value;
  detailOpen.value = false;
  if (row) openReview(row, action);
}

function ensurePending(row: FriendLinkApi.FriendLinkApplication) {
  if (row.status === 'PENDING') return true;
  message.warning($t('friendLinkReview.messages.alreadyReviewed'));
  return false;
}

function openReview(
  row: FriendLinkApi.FriendLinkApplication,
  action: ReviewAction,
) {
  if (!canReview.value || !ensurePending(row)) return;
  pendingReviewRow.value = row;
  reviewAction.value = action;
  reviewSendEmail.value = true;
  reviewReasonTemplate.value = action === 'approve' ? 'approved' : '';
  reviewReason.value =
    action === 'approve'
      ? $t('friendLinkReview.templates.approved.reason')
      : '';
  reviewModalOpen.value = true;
}

function onReasonTemplateChange(value: unknown) {
  const key = typeof value === 'string' ? value : '';
  reviewReasonTemplate.value = key;
  const selected = activeReasonTemplates.value.find(
    (item) => item.value === key,
  );
  if (selected && key !== 'custom') {
    reviewReason.value = selected.reason;
  } else if (key === 'custom') {
    reviewReason.value = '';
  }
}

async function confirmReview() {
  if (!canReview.value || reviewLoading.value) return;
  const row = pendingReviewRow.value;
  const reason = reviewReason.value.trim();
  if (!row) return;
  if (reviewAction.value === 'reject' && !reason) {
    message.warning($t('friendLinkReview.messages.reasonRequired'));
    return;
  }

  reviewLoading.value = true;
  try {
    const payload: FriendLinkApi.ReviewPayload = {
      reason: reason || undefined,
      reasonTemplate: reviewReasonTemplate.value || undefined,
      sendEmail: reviewSendEmail.value,
    };
    if (reviewAction.value === 'approve') {
      await approveFriendLinkApplication(row.id, payload);
      message.success($t('friendLinkReview.messages.approved'));
    } else {
      await rejectFriendLinkApplication(row.id, payload);
      message.success($t('friendLinkReview.messages.rejected'));
    }
    reviewModalOpen.value = false;
    pendingReviewRow.value = null;
    reviewReason.value = '';
    reviewReasonTemplate.value = '';
    await gridApi.query();
    void refreshStats();
  } finally {
    reviewLoading.value = false;
  }
}
</script>

<template>
  <Page auto-content-height>
    <div class="fl-page">
      <section class="fl-hero">
        <div class="fl-hero__lead">
          <span class="fl-hero__badge">
            <IconifyIcon icon="mdi:link-variant" />
          </span>
          <div class="min-w-0">
            <div class="fl-hero__title-row">
              <h1 class="fl-hero__title">
                {{ $t('friendLinkReview.hub.title') }}
              </h1>
              <span
                v-if="applyEnabled !== null"
                class="fl-state"
                :class="applyEnabled ? 'is-on' : 'is-off'"
              >
                <i class="fl-state__dot"></i>
                {{
                  applyEnabled
                    ? $t('friendLinkReview.hub.applyEnabled')
                    : $t('friendLinkReview.hub.applyDisabled')
                }}
              </span>
            </div>
            <p class="fl-hero__desc">
              {{ $t('friendLinkReview.hub.description') }}
            </p>
          </div>
        </div>
        <a
          class="fl-hero__link"
          :href="publicPageHref"
          rel="noopener noreferrer"
          target="_blank"
        >
          <IconifyIcon class="size-4" icon="mdi:open-in-new" />
          {{ $t('friendLinkReview.hub.publicPage') }}
        </a>
      </section>

      <div class="fl-tabs">
        <div class="fl-tabs__bar">
          <button
            v-if="canList"
            class="fl-tab"
            :class="{ 'is-active': activeTab === 'applications' }"
            type="button"
            @click="activeTab = 'applications'"
          >
            <IconifyIcon class="size-4" icon="mdi:inbox-check-outline" />
            {{ $t('friendLinkReview.hub.tabs.applications') }}
          </button>
          <button
            v-if="canManageLinks"
            class="fl-tab"
            :class="{ 'is-active': activeTab === 'links' }"
            type="button"
            @click="activeTab = 'links'"
          >
            <IconifyIcon class="size-4" icon="mdi:link-box-variant-outline" />
            {{ $t('friendLinkReview.hub.tabs.links') }}
          </button>
          <button
            v-if="canConfig"
            class="fl-tab"
            :class="{ 'is-active': activeTab === 'config' }"
            type="button"
            @click="activeTab = 'config'"
          >
            <IconifyIcon class="size-4" icon="mdi:tune-variant" />
            {{ $t('friendLinkReview.hub.tabs.config') }}
          </button>
        </div>

        <div v-if="activeTab === 'applications' && canList" class="fl-pane">
          <div class="fl-stats">
            <button
              v-for="item in filterOptions"
              :key="item.key"
              class="fl-stat"
              :class="[
                `is-${item.tone}`,
                { 'is-active': statusFilter === item.key },
              ]"
              type="button"
              @click="selectFilter(item.key)"
            >
              <span class="fl-stat__label">{{ item.label }}</span>
              <span class="fl-stat__value">
                {{ stats[item.key] ?? '—' }}
              </span>
              <span class="fl-stat__hint">{{ item.hint }}</span>
            </button>
          </div>

          <Grid
            class="fl-grid"
            :table-title="$t('friendLinkReview.hub.tableTitle')"
          >
            <template #toolbar-tools>
              <Input
                v-model:value="keyword"
                allow-clear
                class="fl-search"
                :placeholder="$t('friendLinkReview.hub.searchPlaceholder')"
                @change="onKeywordChange"
                @press-enter="onKeywordSearch"
              >
                <template #prefix>
                  <IconifyIcon
                    class="size-4 text-muted-foreground"
                    icon="mdi:magnify"
                  />
                </template>
              </Input>
              <Button type="primary" @click="onKeywordSearch">
                {{ $t('friendLinkReview.hub.actions.search') }}
              </Button>
            </template>

            <template #site="{ row }">
              <div class="fl-site">
                <img
                  v-if="row.logoUrl"
                  :alt="row.siteName"
                  :src="row.logoUrl"
                  class="fl-site__logo"
                />
                <span v-else class="fl-site__logo fl-site__logo--fallback">
                  {{ initial(row.siteName) }}
                </span>
                <div class="fl-site__body">
                  <div class="fl-site__title">
                    <span class="truncate font-medium">{{ row.siteName }}</span>
                    <span class="fl-lang">{{
                      languageText(row.language)
                    }}</span>
                  </div>
                  <p
                    class="fl-site__desc"
                    :title="row.description || undefined"
                  >
                    {{ row.description || $t('friendLinkReview.notProvided') }}
                  </p>
                </div>
              </div>
            </template>

            <template #siteUrl="{ row }">
              <a
                class="fl-link"
                :href="row.siteUrl"
                rel="noopener noreferrer"
                target="_blank"
                :title="row.siteUrl"
              >
                <span class="truncate">{{ shortUrl(row.siteUrl) }}</span>
                <IconifyIcon
                  class="size-3.5 shrink-0"
                  icon="mdi:arrow-top-right"
                />
              </a>
            </template>

            <template #contact="{ row }">
              <div class="fl-contact">
                <span class="fl-contact__name">
                  {{ row.contactName || $t('friendLinkReview.notProvided') }}
                </span>
                <span v-if="row.contactQq" class="fl-contact__meta">
                  QQ {{ row.contactQq }}
                </span>
                <a
                  v-if="row.contactEmail"
                  class="fl-contact__link"
                  :href="`mailto:${row.contactEmail}`"
                  :title="row.contactEmail"
                >
                  {{ row.contactEmail }}
                </a>
                <span v-if="row.username" class="fl-contact__meta">
                  {{ $t('friendLinkReview.reviewModal.applicantAccount') }}
                  {{ row.username }}
                </span>
              </div>
            </template>

            <template #backlinkUrl="{ row }">
              <a
                v-if="row.backlinkUrl"
                class="fl-link"
                :href="row.backlinkUrl"
                rel="noopener noreferrer"
                target="_blank"
                :title="row.backlinkUrl"
              >
                <span class="truncate">{{ shortUrl(row.backlinkUrl) }}</span>
                <IconifyIcon
                  class="size-3.5 shrink-0"
                  icon="mdi:arrow-top-right"
                />
              </a>
              <span v-else class="fl-muted">
                {{ $t('friendLinkReview.notProvided') }}
              </span>
            </template>

            <template #status="{ row }">
              <div class="fl-status-cell">
                <span class="fl-status-cell__main">
                  <span class="fl-badge" :class="`is-${statusTone(row.status)}`">
                    <i class="fl-badge__dot"></i>
                    {{ statusText(row.status) }}
                  </span>
                  <span
                    v-if="row.status !== 'PENDING' && row.reviewTime"
                    class="fl-status-cell__time"
                  >
                    {{ row.reviewTime?.slice(0, 16) }}
                  </span>
                </span>
                <Tooltip
                  v-if="row.status === 'REJECTED' && row.rejectReason"
                  :title="row.rejectReason"
                >
                  <span class="fl-status-cell__reason">
                    {{ row.rejectReason }}
                  </span>
                </Tooltip>
              </div>
            </template>

            <template #createTime="{ row }">
              <span class="fl-time">{{ row.createTime || '—' }}</span>
            </template>

            <template #operation="{ row }">
              <div class="fl-actions">
                <template v-if="row.status === 'PENDING' && canReview">
                  <Button
                    size="small"
                    type="primary"
                    @click="openReview(row, 'approve')"
                  >
                    {{ $t('friendLinkReview.hub.actions.approve') }}
                  </Button>
                  <Button
                    danger
                    size="small"
                    @click="openReview(row, 'reject')"
                  >
                    {{ $t('friendLinkReview.hub.actions.reject') }}
                  </Button>
                </template>
                <Button
                  v-else
                  size="small"
                  type="link"
                  @click="openDetail(row)"
                >
                  {{ $t('friendLinkReview.hub.actions.detail') }}
                </Button>
              </div>
            </template>
          </Grid>
        </div>

        <div v-else-if="activeTab === 'links' && canManageLinks" class="fl-pane">
          <LinksPanel />
        </div>

        <div v-else-if="activeTab === 'config' && canConfig" class="fl-pane">
          <ConfigPanel @saved="onConfigSaved" />
        </div>
      </div>
    </div>

    <Drawer
      v-model:open="detailOpen"
      class="fl-detail-drawer"
      :title="$t('friendLinkReview.hub.detail.title')"
      width="560"
    >
      <div v-if="detailRow" class="fl-detail">
        <div class="fl-detail__hero">
          <img
            v-if="detailRow.logoUrl"
            :alt="detailRow.siteName"
            class="fl-detail__logo"
            :src="detailRow.logoUrl"
          />
          <span v-else class="fl-detail__logo fl-detail__logo--fallback">
            {{ initial(detailRow.siteName) }}
          </span>
          <div class="fl-detail__head">
            <div class="fl-detail__title">
              <strong>{{ detailRow.siteName }}</strong>
              <span class="fl-lang">{{
                languageText(detailRow.language)
              }}</span>
            </div>
            <a
              v-if="detailRow.siteUrl"
              class="fl-link"
              :href="detailRow.siteUrl"
              rel="noopener noreferrer"
              target="_blank"
            >
              <span class="truncate">{{ shortUrl(detailRow.siteUrl) }}</span>
              <IconifyIcon
                class="size-3.5 shrink-0"
                icon="mdi:arrow-top-right"
              />
            </a>
          </div>
          <span class="fl-badge" :class="`is-${statusTone(detailRow.status)}`">
            <i class="fl-badge__dot"></i>
            {{ statusText(detailRow.status) }}
          </span>
        </div>

        <p v-if="detailRow.description" class="fl-detail__desc">
          {{ detailRow.description }}
        </p>

        <div class="fl-detail__grid">
          <div class="fl-detail__field">
            <span class="fl-detail__label">
              {{ $t('friendLinkReview.reviewModal.contactInfo') }}
            </span>
            <p class="fl-detail__value">
              {{ detailRow.contactName || $t('friendLinkReview.notProvided') }}
            </p>
          </div>
          <div class="fl-detail__field">
            <span class="fl-detail__label">
              {{ $t('friendLinkReview.reviewModal.qq') }}
            </span>
            <p class="fl-detail__value">
              {{ detailRow.contactQq || '—' }}
            </p>
          </div>
          <div class="fl-detail__field">
            <span class="fl-detail__label">
              {{ $t('friendLinkAdmin.fields.email') }}
            </span>
            <p class="fl-detail__value">
              <a
                v-if="detailRow.contactEmail"
                :href="`mailto:${detailRow.contactEmail}`"
              >
                {{ detailRow.contactEmail }}
              </a>
              <span v-else>—</span>
            </p>
          </div>
          <div class="fl-detail__field">
            <span class="fl-detail__label">
              {{ $t('friendLinkReview.hub.detail.applicant') }}
            </span>
            <p class="fl-detail__value">
              {{ detailRow.username || detailRow.userId || '—' }}
            </p>
          </div>
          <div class="fl-detail__field">
            <span class="fl-detail__label">
              {{ $t('friendLinkAdmin.fields.backlink') }}
            </span>
            <p class="fl-detail__value">
              <a
                v-if="detailRow.backlinkUrl"
                :href="detailRow.backlinkUrl"
                rel="noopener noreferrer"
                target="_blank"
              >
                {{ detailRow.backlinkUrl }}
              </a>
              <span v-else class="fl-muted">
                {{ $t('friendLinkReview.notProvided') }}
              </span>
            </p>
          </div>
          <div class="fl-detail__field">
            <span class="fl-detail__label">
              {{ $t('friendLinkReview.hub.detail.appliedAt') }}
            </span>
            <p class="fl-detail__value">{{ detailRow.createTime || '—' }}</p>
          </div>
        </div>

        <div v-if="detailRow.status !== 'PENDING'" class="fl-detail__review">
          <div class="fl-detail__review-head">
            <span class="fl-detail__label">
              {{ $t('friendLinkReview.hub.detail.reviewInfo') }}
            </span>
            <span class="fl-detail__review-time">
              {{ $t('friendLinkReview.hub.detail.reviewedAt') }}
              {{ detailRow.reviewTime || '—' }}
            </span>
          </div>
          <div class="fl-detail__review-row">
            <span class="fl-detail__label">
              {{ $t('friendLinkReview.hub.detail.reviewedBy') }}
            </span>
            <span>{{ detailRow.reviewerName || '—' }}</span>
          </div>
          <div
            v-if="detailRow.reasonTemplate || detailRow.rejectReason"
            class="fl-detail__reason"
            :class="{ 'is-rejected': detailRow.status === 'REJECTED' }"
          >
            <span class="fl-detail__label">
              {{ $t('friendLinkReview.hub.detail.reason') }}
            </span>
            <span
              v-if="detailRow.reasonTemplate"
              class="fl-detail__reason-label"
            >
              {{ reasonTemplateText(detailRow.reasonTemplate) }}
            </span>
            <p class="fl-detail__reason-text">
              {{ detailRow.rejectReason || '—' }}
            </p>
          </div>
          <span v-if="detailRow.sendEmail" class="fl-detail__mail">
            <IconifyIcon class="size-3.5" icon="mdi:email-check-outline" />
            {{ $t('friendLinkReview.hub.detail.sendEmail') }}
          </span>
        </div>

        <div v-else-if="canReview" class="fl-detail__pending">
          <IconifyIcon class="size-4" icon="mdi:clock-outline" />
          {{ $t('friendLinkReview.hub.detail.pendingTip') }}
        </div>
      </div>

      <template #footer>
        <div class="fl-detail__footer">
          <Button @click="detailOpen = false">
            {{ $t('friendLinkReview.hub.actions.close') }}
          </Button>
          <div
            v-if="detailRow?.status === 'PENDING' && canReview"
            class="fl-detail__footer-actions"
          >
            <Button danger @click="reviewFromDetail('reject')">
              {{ $t('friendLinkReview.hub.actions.reject') }}
            </Button>
            <Button type="primary" @click="reviewFromDetail('approve')">
              {{ $t('friendLinkReview.hub.actions.approve') }}
            </Button>
          </div>
        </div>
      </template>
    </Drawer>

    <Modal
      v-if="canReview"
      v-model:open="reviewModalOpen"
      :confirm-loading="reviewLoading"
      :ok-text="reviewActionText"
      ok-type="primary"
      :title="reviewModalTitle"
      width="640px"
      :ok-button-props="{ danger: reviewAction === 'reject' }"
      @ok="confirmReview"
    >
      <div class="grid gap-4 pt-1">
        <div class="fl-review__summary">
          <div class="flex items-start gap-3">
            <img
              v-if="pendingReviewRow?.logoUrl"
              :alt="pendingReviewRow?.siteName"
              :src="pendingReviewRow?.logoUrl"
              class="size-12 shrink-0 rounded-lg border border-border object-cover"
            />
            <span
              v-else
              class="grid size-12 shrink-0 place-items-center rounded-lg border border-border bg-muted text-base font-bold text-primary"
            >
              {{ initial(pendingReviewRow?.siteName) }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <strong class="text-sm">
                  {{ pendingReviewRow?.siteName }}
                </strong>
                <span class="fl-lang">
                  {{ languageText(pendingReviewRow?.language ?? 'zh') }}
                </span>
              </div>
              <a
                v-if="pendingReviewRow?.siteUrl"
                class="mt-0.5 block max-w-full truncate text-xs"
                :href="pendingReviewRow.siteUrl"
                rel="noopener noreferrer"
                target="_blank"
              >
                {{ pendingReviewRow.siteUrl }}
              </a>
            </div>
          </div>
          <p
            v-if="pendingReviewRow?.description"
            class="m-0 mt-2 border-t border-border pt-2 text-xs text-muted-foreground"
          >
            {{ pendingReviewRow.description }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <span class="text-muted-foreground">
              {{ $t('friendLinkAdmin.fields.contact') }}
            </span>
            <p class="m-0 mt-0.5">
              {{ pendingReviewRow?.contactName || '—' }}
            </p>
          </div>
          <div>
            <span class="text-muted-foreground">
              {{ $t('friendLinkReview.reviewModal.qq') }}
            </span>
            <p class="m-0 mt-0.5">{{ pendingReviewRow?.contactQq || '—' }}</p>
          </div>
          <div class="min-w-0">
            <span class="text-muted-foreground">
              {{ $t('friendLinkAdmin.fields.email') }}
            </span>
            <p class="m-0 mt-0.5 truncate">
              <a
                v-if="pendingReviewRow?.contactEmail"
                :href="`mailto:${pendingReviewRow.contactEmail}`"
              >
                {{ pendingReviewRow.contactEmail }}
              </a>
              <span v-else>—</span>
            </p>
          </div>
          <div>
            <span class="text-muted-foreground">
              {{ $t('friendLinkReview.reviewModal.applicantAccount') }}
            </span>
            <p class="m-0 mt-0.5">{{ pendingReviewRow?.username || '—' }}</p>
          </div>
          <div class="col-span-2 min-w-0">
            <span class="text-muted-foreground">
              {{ $t('friendLinkAdmin.fields.backlink') }}
            </span>
            <p class="m-0 mt-0.5 truncate">
              <a
                v-if="pendingReviewRow?.backlinkUrl"
                :href="pendingReviewRow.backlinkUrl"
                rel="noopener noreferrer"
                target="_blank"
              >
                {{ pendingReviewRow.backlinkUrl }}
              </a>
              <span v-else class="text-muted-foreground">
                {{ $t('friendLinkReview.notProvided') }}
              </span>
            </p>
          </div>
        </div>

        <p class="m-0 text-sm text-muted-foreground">
          {{ reviewModalDescription }}
        </p>
        <label class="grid gap-2">
          <span class="text-sm font-medium">
            {{ $t('friendLinkReview.reasonTemplate') }}
          </span>
          <Select
            :options="reasonTemplateOptions"
            :placeholder="$t('friendLinkReview.reasonTemplatePlaceholder')"
            :value="reviewReasonTemplate || undefined"
            allow-clear
            @change="onReasonTemplateChange"
          />
        </label>
        <label class="grid gap-2">
          <span class="text-sm font-medium">
            {{
              reviewAction === 'reject'
                ? $t('friendLinkReview.reject.reasonLabel')
                : $t('friendLinkReview.approve.reasonLabel')
            }}
            <b v-if="reviewAction === 'reject'" class="text-destructive">*</b>
          </span>
          <Input.TextArea
            v-model:value="reviewReason"
            :maxlength="1000"
            :placeholder="
              reviewAction === 'reject'
                ? $t('friendLinkReview.reject.placeholder')
                : $t('friendLinkReview.approve.placeholder')
            "
            :rows="4"
            show-count
          />
        </label>
        <Checkbox v-model:checked="reviewSendEmail">
          {{ $t('friendLinkReview.sendEmail') }}
        </Checkbox>
        <p class="m-0 text-xs text-muted-foreground">
          {{ $t('friendLinkReview.sendEmailDescription') }}
        </p>
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.fl-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.fl-hero {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  overflow: hidden;
  background:
    radial-gradient(
      720px 180px at 0% 0%,
      hsl(var(--primary) / 12%),
      transparent 70%
    ),
    hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.fl-hero::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background-image: radial-gradient(hsl(var(--border)) 1px, transparent 1px);
  background-size: 16px 16px;
  opacity: 0.35;
  mask-image: linear-gradient(100deg, transparent 35%, #000 100%);
}

.fl-hero__lead {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 14px;
  align-items: center;
  min-width: 0;
}

.fl-hero__badge {
  display: grid;
  flex: none;
  place-items: center;
  width: 46px;
  height: 46px;
  font-size: 24px;
  color: hsl(var(--primary-foreground));
  background: linear-gradient(
    135deg,
    hsl(var(--primary)),
    hsl(var(--primary) / 70%)
  );
  border-radius: 13px;
  box-shadow: 0 10px 24px hsl(var(--primary) / 25%);
}

.fl-hero__title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.fl-hero__title {
  margin: 0;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.3px;
  color: hsl(var(--foreground));
}

.fl-hero__desc {
  max-width: 68ch;
  margin: 5px 0 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.fl-hero__link {
  position: relative;
  z-index: 1;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 7px 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: hsl(var(--foreground));
  text-decoration: none;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 9px;
  transition:
    border-color 0.2s ease,
    color 0.2s ease;
}

.fl-hero__link:hover {
  color: hsl(var(--primary));
  border-color: hsl(var(--primary) / 45%);
}

.fl-state {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 2px 9px;
  font-size: 11.5px;
  font-weight: 600;
  border-radius: 999px;
}

.fl-state .fl-state__dot {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
}

.fl-state.is-on {
  color: #047857;
  background: rgb(16 185 129 / 14%);
}

.fl-state.is-off {
  color: #b91c1c;
  background: rgb(244 63 94 / 12%);
}

.fl-tabs {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 10px 14px 14px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.fl-tabs__bar {
  display: flex;
  flex: none;
  gap: 6px;
  padding: 3px;
  margin-bottom: 12px;
  align-self: flex-start;
  background: hsl(var(--muted) / 55%);
  border-radius: 10px;
}

.fl-tab {
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

.fl-tab:hover {
  color: hsl(var(--foreground));
}

.fl-tab.is-active {
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
}

.fl-pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}

.fl-stats {
  display: grid;
  flex: none;
  grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
  gap: 10px;
}

.fl-stat {
  --tone: hsl(var(--primary));

  position: relative;
  padding: 10px 14px;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.fl-stat:hover {
  transform: translateY(-1px);
  border-color: hsl(var(--primary) / 35%);
}

.fl-stat.is-total {
  --tone: hsl(var(--primary));
}

.fl-stat.is-pending {
  --tone: #d97706;
}

.fl-stat.is-approved {
  --tone: #059669;
}

.fl-stat.is-rejected {
  --tone: #e11d48;
}

.fl-stat.is-withdrawn {
  --tone: #64748b;
}

.fl-stat.is-active {
  border-color: var(--tone);
  box-shadow: 0 0 0 3px rgb(0 0 0 / 6%);
}

.fl-stat.is-active .fl-stat__value {
  color: var(--tone);
}

.fl-stat__label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.fl-stat__value {
  display: block;
  margin-top: 1px;
  font-size: 23px;
  font-weight: 700;
  line-height: 1.2;
  color: hsl(var(--foreground));
  letter-spacing: -0.5px;
  transition: color 0.18s ease;
}

.fl-stat__hint {
  display: block;
  margin-top: 1px;
  font-size: 11px;
  color: hsl(var(--muted-foreground) / 80%);
}

.fl-grid {
  flex: 1;
  min-height: 0;
}

.fl-search {
  width: 250px;
}

.fl-site {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  min-width: 0;
  padding: 2px 0;
}

.fl-site__logo {
  flex: none;
  width: 36px;
  height: 36px;
  object-fit: cover;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.fl-site__logo--fallback {
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 700;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.fl-site__body {
  min-width: 0;
  padding-top: 1px;
}

.fl-site__title {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  font-size: 13px;
  line-height: 1.4;
  color: hsl(var(--foreground));
}

.fl-site__desc {
  display: -webkit-box;
  margin: 2px 0 0;
  overflow: hidden;
  font-size: 11.5px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.fl-lang {
  flex: none;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 700;
  line-height: 17px;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.4px;
  background: hsl(var(--muted) / 60%);
  border-radius: 5px;
}

.fl-link {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  max-width: 100%;
  font-size: 12.5px;
  color: hsl(var(--primary));
  text-decoration: none;
}

.fl-link:hover {
  text-decoration: underline;
}

.fl-contact {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  font-size: 11.5px;
  line-height: 1.55;
}

.fl-contact__name {
  font-weight: 600;
  color: hsl(var(--foreground));
}

.fl-contact__meta {
  color: hsl(var(--muted-foreground));
}

.fl-contact__link {
  max-width: 180px;
  overflow: hidden;
  color: hsl(var(--primary));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fl-muted {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.fl-status-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.fl-status-cell__main {
  display: flex;
  gap: 5px;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.fl-badge {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 1px 10px;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 19px;
  border-radius: 999px;
}

.fl-badge__dot {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
}

.fl-badge.is-pending {
  color: #b45309;
  background: rgb(245 158 11 / 14%);
}

.fl-badge.is-approved {
  color: #047857;
  background: rgb(16 185 129 / 14%);
}

.fl-badge.is-rejected {
  color: #be123c;
  background: rgb(244 63 94 / 12%);
}

.fl-badge.is-withdrawn {
  color: #475569;
  background: rgb(100 116 139 / 14%);
}

.fl-status-cell__reason {
  display: block;
  align-self: stretch;
  min-width: 0;
  overflow: hidden;
  font-size: 10.5px;
  line-height: 14px;
  text-align: center;
  text-overflow: ellipsis;
  color: hsl(var(--destructive));
  white-space: nowrap;
}

.fl-status-cell__time {
  font-size: 10.5px;
  line-height: 19px;
  white-space: nowrap;
  color: hsl(var(--muted-foreground));
}

.fl-time {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.fl-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
}

.fl-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.fl-detail__hero {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  background: hsl(var(--muted) / 40%);
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.fl-detail__logo {
  flex: none;
  width: 52px;
  height: 52px;
  object-fit: cover;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.fl-detail__logo--fallback {
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: 700;
  color: hsl(var(--primary));
}

.fl-detail__head {
  flex: 1;
  min-width: 0;
}

.fl-detail__title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 3px;
  font-size: 15px;
}

.fl-detail__desc {
  padding: 10px 12px;
  margin: 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 35%);
  border-left: 3px solid hsl(var(--primary) / 45%);
  border-radius: 6px;
}

.fl-detail__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 18px;
}

.fl-detail__field {
  min-width: 0;
}

.fl-detail__label {
  display: block;
  font-size: 11.5px;
  color: hsl(var(--muted-foreground));
}

.fl-detail__value {
  margin: 2px 0 0;
  overflow: hidden;
  font-size: 12.5px;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
}

.fl-detail__value a {
  color: hsl(var(--primary));
  word-break: break-all;
}

.fl-detail__review {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.fl-detail__review-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.fl-detail__review-head .fl-detail__label {
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.fl-detail__review-time {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.fl-detail__review-row {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 12px;
}

.fl-detail__reason {
  padding: 10px 12px;
  background: hsl(var(--muted) / 45%);
  border-radius: 8px;
}

.fl-detail__reason.is-rejected {
  background: rgb(244 63 94 / 7%);
}

.fl-detail__reason-label {
  display: inline-block;
  margin-top: 3px;
  font-size: 11.5px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.fl-detail__reason.is-rejected .fl-detail__reason-label {
  color: hsl(var(--destructive));
}

.fl-detail__reason-text {
  margin: 3px 0 0;
  font-size: 12.5px;
  line-height: 1.65;
  color: hsl(var(--foreground));
}

.fl-detail__mail {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  font-size: 11.5px;
  color: hsl(var(--muted-foreground));
}

.fl-detail__pending {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 11px 13px;
  font-size: 12px;
  color: #b45309;
  background: rgb(245 158 11 / 10%);
  border-radius: 9px;
}

.fl-detail__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.fl-detail__footer-actions {
  display: flex;
  gap: 8px;
}

.fl-review__summary {
  padding: 12px 14px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

:deep(.vxe-table--body .fl-row--pending) {
  background: rgb(245 158 11 / 6%);
}

:deep(.vxe-table--body .fl-row--pending td:first-child) {
  box-shadow: inset 3px 0 0 #f59e0b;
}

:global(html.dark) .fl-stat.is-pending,
:global(html.dark) .fl-detail__pending {
  --tone: #fbbf24;
  color: #fbbf24;
}

:global(html.dark) .fl-stat.is-approved {
  --tone: #34d399;
}

:global(html.dark) .fl-stat.is-rejected {
  --tone: #fb7185;
}

:global(html.dark) .fl-stat.is-withdrawn {
  --tone: #94a3b8;
}

:global(html.dark) .fl-badge.is-pending {
  color: #fbbf24;
}

:global(html.dark) .fl-badge.is-approved {
  color: #34d399;
}

:global(html.dark) .fl-badge.is-rejected {
  color: #fb7185;
}

:global(html.dark) .fl-badge.is-withdrawn {
  color: #94a3b8;
}

:global(html.dark) .fl-state.is-on {
  color: #34d399;
}

:global(html.dark) .fl-state.is-off {
  color: #fb7185;
}

@media (max-width: 900px) {
  .fl-search {
    width: 190px;
  }
}

@media (max-width: 640px) {
  .fl-hero {
    padding: 14px;
  }

  .fl-hero__title {
    font-size: 18px;
  }

  .fl-search {
    width: 100%;
  }

  .fl-detail__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fl-stat,
  .fl-tab,
  .fl-hero__link {
    transition: none;
  }

  .fl-stat:hover {
    transform: none;
  }
}
</style>
