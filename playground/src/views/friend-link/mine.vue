<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type { AuthApi } from '#/api';
import type { FriendLinkApi } from '#/api/friend-link';

import { computed, onMounted, reactive, ref, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, RotateCw } from '@vben/icons';
import { preferences } from '@vben/preferences';

import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Table,
  Tag,
  Tooltip,
  message,
} from 'ant-design-vue';

import { getCaptchaApi, isCaptchaEnabled, verifyCaptchaApi } from '#/api/core/auth';
import {
  applyFriendLink,
  getMyFriendLinks,
  submitFriendLinkChange,
  submitFriendLinkRemoval,
  withdrawFriendLinkRequest,
} from '#/api/friend-link';
import CaptchaWidget from '#/components/captcha-widget/CaptchaWidget.vue';
import { $t } from '#/locales';

type DraftField =
  | 'backlinkUrl'
  | 'contactEmail'
  | 'contactName'
  | 'contactQq'
  | 'description'
  | 'logoUrl'
  | 'siteName'
  | 'siteUrl';

const loading = shallowRef(false);
const links = ref<FriendLinkApi.FriendLinkItem[]>([]);
const requests = ref<FriendLinkApi.FriendLinkApplication[]>([]);
const applyEnabled = shallowRef(true);

const dialogOpen = shallowRef(false);
const dialogMode = ref<'apply' | 'edit'>('apply');
const editingLinkId = shallowRef('');
const submitting = shallowRef(false);
const draft = reactive<Record<DraftField, string>>({
  backlinkUrl: '',
  contactEmail: '',
  contactName: '',
  contactQq: '',
  description: '',
  logoUrl: '',
  siteName: '',
  siteUrl: '',
});

const captchaChallenge = ref<AuthApi.CaptchaResult | null>(null);
const captchaChecking = shallowRef(false);
const captchaError = shallowRef('');
const captchaLoading = shallowRef(false);
const captchaVerified = shallowRef(false);
const captchaWidgetKey = shallowRef(0);
let captchaRequestId = 0;

const pendingRequest = computed(() =>
  requests.value.find((item) => item.status === 'PENDING'),
);
// 一条待审请求会占住这个账号的申请额度（后端唯一索引兜底），
// 所以面板上要同时说明「为什么按钮点不动」。
const pendingLinkIds = computed(
  () =>
    new Set(
      requests.value
        .filter((item) => item.status === 'PENDING' && item.linkId)
        .map((item) => String(item.linkId)),
    ),
);

const linkColumns = computed<TableColumnsType>(() => [
  { dataIndex: 'siteName', key: 'site', title: $t('friendLinkMine.links.site') },
  { dataIndex: 'status', key: 'status', title: $t('friendLinkMine.links.status'), width: 148 },
  { dataIndex: 'updateTime', key: 'updateTime', title: $t('friendLinkMine.links.updateTime'), width: 170 },
  { key: 'actions', title: $t('friendLinkMine.links.actions'), width: 220 },
]);

const requestColumns = computed<TableColumnsType>(() => [
  { dataIndex: 'changeKind', key: 'kind', title: $t('friendLinkMine.requests.kind'), width: 120 },
  { dataIndex: 'siteName', key: 'site', title: $t('friendLinkMine.links.site') },
  { dataIndex: 'status', key: 'status', title: $t('friendLinkMine.requests.status'), width: 120 },
  { dataIndex: 'createTime', key: 'createTime', title: $t('friendLinkMine.requests.submitTime'), width: 170 },
  { dataIndex: 'reviewTime', key: 'reviewTime', title: $t('friendLinkMine.requests.reviewTime'), width: 170 },
  { key: 'actions', title: $t('friendLinkMine.requests.actions'), width: 120 },
]);

const dialogTitle = computed(() =>
  dialogMode.value === 'edit'
    ? $t('friendLinkMine.apply.editTitle')
    : $t('friendLinkMine.apply.dialogTitle'),
);
const canSubmitDialog = computed(
  () =>
    !submitting.value &&
    (dialogMode.value === 'edit' ||
      (!captchaLoading.value && !captchaChecking.value && captchaVerified.value)),
);

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const result = await getMyFriendLinks();
    links.value = result.links ?? [];
    requests.value = result.requests ?? [];
    applyEnabled.value = result.applyEnabled !== false;
  } catch {
    message.error($t('friendLinkMine.messages.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function resetDraft(source?: Partial<Record<DraftField, string>>) {
  for (const key of Object.keys(draft) as DraftField[]) {
    draft[key] = source?.[key] ?? '';
  }
}

function openApply() {
  if (!applyEnabled.value) {
    message.warning($t('friendLinkMine.notice.closed'));
    return;
  }
  if (pendingRequest.value) {
    message.warning($t('friendLinkMine.notice.pendingExists'));
    return;
  }
  dialogMode.value = 'apply';
  editingLinkId.value = '';
  resetDraft();
  dialogOpen.value = true;
  void loadCaptcha();
}

// 修改与撤下都不用人机验证：入口已登录，且同一账号只允许有一条待审请求。
function openEdit(row: Record<string, any>) {
  const link = row as FriendLinkApi.FriendLinkItem;
  dialogMode.value = 'edit';
  editingLinkId.value = link.id;
  resetDraft({
    backlinkUrl: '',
    description: link.description ?? '',
    logoUrl: link.logoUrl ?? '',
    siteName: link.siteName,
    siteUrl: link.siteUrl,
  });
  dialogOpen.value = true;
}

async function loadCaptcha() {
  if (!dialogOpen.value || dialogMode.value !== 'apply') return;
  const requestId = ++captchaRequestId;
  captchaLoading.value = true;
  captchaChecking.value = false;
  captchaError.value = '';
  captchaVerified.value = false;
  captchaChallenge.value = null;
  try {
    const challenge = await getCaptchaApi('friend_link_apply');
    if (requestId !== captchaRequestId) return;
    captchaChallenge.value = challenge;
    captchaVerified.value = !isCaptchaEnabled(challenge);
    captchaWidgetKey.value += 1;
  } catch {
    if (requestId === captchaRequestId) {
      captchaError.value = $t('friendLinkMine.captcha.loadFailed');
    }
  } finally {
    if (requestId === captchaRequestId) captchaLoading.value = false;
  }
}

async function onCaptchaSuccess(solution: AuthApi.CaptchaVerifyPayload) {
  const challenge = captchaChallenge.value;
  if (!challenge || captchaChecking.value || !dialogOpen.value) return;
  const requestId = captchaRequestId;
  captchaChecking.value = true;
  captchaError.value = '';
  try {
    await verifyCaptchaApi(challenge, solution);
    if (requestId !== captchaRequestId) return;
    captchaVerified.value = true;
  } catch {
    if (requestId !== captchaRequestId) return;
    captchaError.value = $t('friendLinkMine.captcha.verifyFailed');
    await loadCaptcha();
  } finally {
    if (requestId === captchaRequestId) captchaChecking.value = false;
  }
}

function onCaptchaError() {
  captchaError.value = $t('friendLinkMine.captcha.verifyFailed');
}

function assertDraft(): string {
  if (!draft.siteName.trim()) return $t('friendLinkMine.messages.siteNameRequired');
  if (!draft.siteUrl.trim()) return $t('friendLinkMine.messages.siteUrlRequired');
  if (dialogMode.value !== 'apply') return '';
  const email = draft.contactEmail.trim();
  if (!email) return $t('friendLinkMine.messages.contactEmailRequired');
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
    return $t('friendLinkMine.messages.contactEmailInvalid');
  }
  return '';
}

async function submitDialog() {
  const error = assertDraft();
  if (error) {
    message.warning(error);
    return;
  }
  if (dialogMode.value === 'apply' && !captchaVerified.value) {
    message.warning($t('friendLinkMine.messages.captchaRequired'));
    return;
  }
  submitting.value = true;
  try {
    if (dialogMode.value === 'edit') {
      await submitFriendLinkChange(editingLinkId.value, {
        backlinkUrl: draft.backlinkUrl.trim() || undefined,
        description: draft.description.trim(),
        logoUrl: draft.logoUrl.trim(),
        siteName: draft.siteName.trim(),
        siteUrl: draft.siteUrl.trim(),
      });
      message.success($t('friendLinkMine.messages.changeSubmitted'));
    } else {
      await applyFriendLink({
        backlinkUrl: draft.backlinkUrl.trim() || undefined,
        captchaId: captchaChallenge.value?.captchaId || '',
        contactEmail: draft.contactEmail.trim(),
        contactName: draft.contactName.trim() || undefined,
        contactQq: draft.contactQq.trim() || undefined,
        description: draft.description.trim(),
        language: currentPageLanguage(),
        logoUrl: draft.logoUrl.trim(),
        siteName: draft.siteName.trim(),
        siteUrl: draft.siteUrl.trim(),
      });
      message.success($t('friendLinkMine.messages.submitted'));
    }
    closeDialog();
    await load();
  } catch {
    // 失败原因由请求层统一提示；申请失败时换一道新的验证题，旧题已被后端消费。
    if (dialogMode.value === 'apply') await loadCaptcha();
  } finally {
    submitting.value = false;
  }
}

function requestRemoval(row: Record<string, any>) {
  const link = row as FriendLinkApi.FriendLinkItem;
  Modal.confirm({
    cancelText: $t('common.cancel'),
    content: `${link.siteName} · ${$t('friendLinkMine.notice.removeHint')}`,
    okText: $t('common.confirm'),
    onOk: async () => {
      await submitFriendLinkRemoval(link.id);
      message.success($t('friendLinkMine.messages.removalSubmitted'));
      await load();
    },
    title: $t('friendLinkMine.links.remove'),
  });
}

function withdrawRequest(row: Record<string, any>) {
  const item = row as FriendLinkApi.FriendLinkApplication;
  Modal.confirm({
    cancelText: $t('common.cancel'),
    content: $t('friendLinkMine.requests.withdrawConfirmContent'),
    okText: $t('common.confirm'),
    onOk: async () => {
      await withdrawFriendLinkRequest(item.id);
      message.success($t('friendLinkMine.messages.withdrawn'));
      await load();
    },
    title: $t('friendLinkMine.requests.withdrawConfirmTitle'),
  });
}

function closeDialog() {
  dialogOpen.value = false;
  captchaRequestId += 1;
  captchaVerified.value = false;
  captchaChallenge.value = null;
  editingLinkId.value = '';
}

function currentPageLanguage(): FriendLinkApi.Language {
  const candidates = [
    typeof document === 'undefined' ? '' : document.documentElement.lang,
    preferences.app.locale,
    typeof navigator === 'undefined' ? '' : navigator.language,
  ];
  const language =
    candidates.find((value) => String(value || '').trim()) || 'zh-CN';
  return String(language).trim().toLowerCase().startsWith('en') ? 'en' : 'zh';
}

function changeKindLabel(kind?: FriendLinkApi.ChangeKind) {
  if (kind === 'EDIT') return $t('friendLinkMine.requests.kindEdit');
  if (kind === 'REMOVE') return $t('friendLinkMine.requests.kindRemove');
  return $t('friendLinkMine.requests.kindNew');
}

function statusColor(status?: FriendLinkApi.ApplicationStatus) {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING') return 'processing';
  if (status === 'REJECTED') return 'error';
  return 'default';
}

function statusLabel(status?: FriendLinkApi.ApplicationStatus) {
  switch (status) {
    case 'APPROVED': {
      return $t('friendLinkMine.requests.statusApproved');
    }
    case 'PENDING': {
      return $t('friendLinkMine.requests.statusPending');
    }
    case 'REJECTED': {
      return $t('friendLinkMine.requests.statusRejected');
    }
    case 'WITHDRAWN': {
      return $t('friendLinkMine.requests.statusWithdrawn');
    }
    default: {
      return $t('friendLinkMine.requests.statusUnknown');
    }
  }
}
</script>

<template>
  <Page>
    <div class="flm-page">
      <header class="flm-header">
        <div class="flm-heading">
          <span class="flm-icon"><IconifyIcon icon="mdi:link-box-variant-outline" /></span>
          <div>
            <h1>{{ $t('friendLinkMine.title') }}</h1>
            <p>{{ $t('friendLinkMine.description') }}</p>
          </div>
        </div>
        <div class="flm-actions">
          <Button type="primary" @click="openApply">
            <template #icon><IconifyIcon icon="mdi:link-plus" /></template>
            {{ $t('friendLinkMine.apply.button') }}
          </Button>
          <Button :loading="loading" @click="load">
            <template #icon><RotateCw /></template>
            {{ $t('common.refresh') }}
          </Button>
        </div>
      </header>

      <Alert
        v-if="!applyEnabled"
        :message="$t('friendLinkMine.notice.closed')"
        show-icon
        type="warning"
      />
      <Alert
        v-else-if="pendingRequest"
        :message="$t('friendLinkMine.notice.pendingExists')"
        show-icon
        type="info"
      />

      <Card class="flm-panel" :title="$t('friendLinkMine.links.title')">
        <Table
          :columns="linkColumns"
          :data-source="links"
          :loading="loading"
          :locale="{ emptyText: $t('friendLinkMine.links.empty') }"
          :pagination="false"
          row-key="id"
          :scroll="{ x: 720 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'site'">
              <div class="flm-site">
                <img
                  v-if="record.logoUrl"
                  :alt="record.siteName"
                  class="flm-site-logo"
                  :src="record.logoUrl"
                />
                <span v-else class="flm-site-logo flm-site-logo--empty">
                  {{ record.siteName.slice(0, 1) }}
                </span>
                <span class="flm-site-copy">
                  <strong>{{ record.siteName }}</strong>
                  <a
                    :href="record.siteUrl"
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    >{{ record.siteUrl }}</a
                  >
                </span>
              </div>
            </template>
            <template v-else-if="column.key === 'status'">
              <Tag :color="record.status === 1 ? 'success' : 'default'">
                {{
                  record.status === 1
                    ? $t('friendLinkMine.links.online')
                    : $t('friendLinkMine.links.offline')
                }}
              </Tag>
              <Tag
                v-if="pendingLinkIds.has(String(record.id))"
                color="orange"
              >
                {{ $t('friendLinkMine.links.reviewPending') }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="flm-row-actions">
                <Button
                  :disabled="pendingLinkIds.has(String(record.id))"
                  size="small"
                  @click="openEdit(record)"
                >
                  {{ $t('friendLinkMine.links.edit') }}
                </Button>
                <Button
                  danger
                  :disabled="pendingLinkIds.has(String(record.id))"
                  size="small"
                  @click="requestRemoval(record)"
                >
                  {{ $t('friendLinkMine.links.remove') }}
                </Button>
              </div>
            </template>
          </template>
        </Table>
      </Card>

      <Card class="flm-panel" :title="$t('friendLinkMine.requests.title')">
        <Table
          :columns="requestColumns"
          :data-source="requests"
          :loading="loading"
          :locale="{ emptyText: $t('friendLinkMine.requests.empty') }"
          :pagination="{ pageSize: 10, size: 'small' }"
          row-key="id"
          :scroll="{ x: 860 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'kind'">
              <Tag>{{ changeKindLabel(record.changeKind) }}</Tag>
            </template>
            <template v-else-if="column.key === 'site'">
              <div class="flm-site">
                <span class="flm-site-copy">
                  <strong>{{ record.siteName }}</strong>
                  <a
                    :href="record.siteUrl"
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    >{{ record.siteUrl }}</a
                  >
                </span>
              </div>
            </template>
            <template v-else-if="column.key === 'status'">
              <Tag :color="statusColor(record.status)">
                {{ statusLabel(record.status) }}
              </Tag>
              <Tooltip
                v-if="record.status === 'REJECTED' && record.rejectReason"
                :title="record.rejectReason"
              >
                <span class="flm-reason">{{ record.rejectReason }}</span>
              </Tooltip>
            </template>
            <template v-else-if="column.key === 'actions'">
              <Button
                v-if="record.status === 'PENDING'"
                size="small"
                @click="withdrawRequest(record)"
              >
                {{ $t('friendLinkMine.requests.withdraw') }}
              </Button>
              <span v-else class="flm-muted">—</span>
            </template>
          </template>
        </Table>
      </Card>

      <Modal
        :open="dialogOpen"
        :ok-button-props="{ disabled: !canSubmitDialog }"
        :confirm-loading="submitting"
        :title="dialogTitle"
        :width="640"
        @cancel="closeDialog"
        @ok="submitDialog"
      >
        <Form class="flm-form" layout="vertical" @submit.prevent="submitDialog">
          <Form.Item :label="$t('friendLinkMine.form.siteName')" required>
            <Input v-model:value="draft.siteName" :maxlength="100" />
          </Form.Item>
          <Form.Item :label="$t('friendLinkMine.form.siteUrl')" required>
            <Input
              v-model:value="draft.siteUrl"
              placeholder="https://example.com"
            />
          </Form.Item>
          <div class="flm-form-grid">
            <Form.Item :label="$t('friendLinkMine.form.logoUrl')">
              <Input v-model:value="draft.logoUrl" placeholder="https://..." />
            </Form.Item>
            <Form.Item :label="$t('friendLinkMine.form.backlinkUrl')">
              <Input
                v-model:value="draft.backlinkUrl"
                placeholder="https://..."
              />
            </Form.Item>
          </div>
          <Form.Item :label="$t('friendLinkMine.form.description')">
            <Input.TextArea v-model:value="draft.description" :maxlength="255" :rows="3" />
          </Form.Item>
          <template v-if="dialogMode === 'apply'">
            <div class="flm-form-grid">
              <Form.Item :label="$t('friendLinkMine.form.contactName')">
                <Input v-model:value="draft.contactName" :maxlength="64" />
              </Form.Item>
              <Form.Item :label="$t('friendLinkMine.form.contactQq')">
                <Input v-model:value="draft.contactQq" :maxlength="64" />
              </Form.Item>
            </div>
            <Form.Item :label="$t('friendLinkMine.form.contactEmail')" required>
              <Input v-model:value="draft.contactEmail" :maxlength="128" />
            </Form.Item>
            <div class="flm-captcha">
              <CaptchaWidget
                :key="captchaWidgetKey"
                :challenge="captchaChallenge"
                :disabled="captchaChecking || submitting"
                @error="onCaptchaError"
                @success="onCaptchaSuccess"
              />
              <p v-if="captchaError" class="flm-captcha-error">
                {{ captchaError }}
                <Button link size="small" @click="loadCaptcha">
                  {{ $t('friendLinkMine.captcha.retry') }}
                </Button>
              </p>
            </div>
          </template>
          <p v-else class="flm-form-hint">{{ $t('friendLinkMine.notice.editHint') }}</p>
        </Form>
      </Modal>
    </div>
  </Page>
</template>

<style scoped>
.flm-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.flm-header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 2px 0;
}

.flm-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.flm-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
}

.flm-icon {
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

.flm-icon svg {
  width: 21px;
  height: 21px;
}

.flm-heading h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  line-height: 28px;
  color: hsl(var(--foreground));
}

.flm-heading p {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: hsl(var(--muted-foreground));
}

.flm-panel {
  background: hsl(var(--card));
  border-color: hsl(var(--border));
  border-radius: 8px;
}

.flm-site {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.flm-site-logo {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  object-fit: contain;
  border-radius: 6px;
}

.flm-site-logo--empty {
  font-size: 13px;
  font-weight: 700;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.flm-site-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.flm-site-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.flm-site-copy a {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--primary));
  white-space: nowrap;
}

.flm-row-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.flm-muted {
  margin: 8px 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.flm-reason {
  display: inline-block;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.flm-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.flm-form-hint {
  margin: 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.flm-captcha {
  margin-top: 4px;
}

.flm-captcha-error {
  display: flex;
  gap: 6px;
  align-items: center;
  margin: 6px 0 0;
  font-size: 12px;
  color: hsl(var(--destructive));
}

@media (max-width: 768px) {
  .flm-header {
    align-items: stretch;
    flex-direction: column;
  }

  .flm-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
