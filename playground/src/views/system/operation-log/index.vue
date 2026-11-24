<script lang="ts" setup>
import type {
  OperationLogItem,
  OperationLogListParams,
  OperationLogStats,
} from '#/api/core/operation-log';

import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon, RotateCw } from '@vben/icons';

import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  message,
  Modal,
  Pagination,
  Select,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import {
  getMyOperationLogListApi,
  getOperationLogListApi,
  getOperationLogOverviewApi,
  resolveOperationLogRegionApi,
} from '#/api/core/operation-log';
import { $t } from '#/locales';

const props = withDefaults(defineProps<{ personal?: boolean }>(), {
  personal: false,
});
const listError = shallowRef(false);
let listRequest = 0;

const loading = shallowRef(false);
const overviewLoading = shallowRef(false);
const rows = ref<OperationLogItem[]>([]);
const total = ref(0);
const overview = ref<OperationLogStats>();

/** 详情弹窗里当前查看的记录；为 undefined 表示未打开。 */
const detailRecord = ref<OperationLogItem>();

const query = reactive<OperationLogListParams>({
  page: 1,
  pageSize: 20,
});

/**
 * 运营告警会带着筛选条件深链到本页（如 action=login&status=false）。
 * 首次进入时把这些参数落到本地查询对象上，保证告警点进来即可看到目标记录，
 * 而不是先看到全量列表再手动筛一遍。
 */
function readQueryText(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim();
  return text || undefined;
}

function readQueryStatus(value: unknown): boolean | undefined {
  const raw = readQueryText(value);
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return undefined;
}

function applyRouteFilters() {
  // useRoute() 在未挂载 Router 的单元测试里返回 undefined，这里保持可降级。
  const route = useRoute() as unknown as
    | undefined
    | { query?: Record<string, unknown> };
  const source = route?.query ?? {};
  query.action = readQueryText(source.action);
  query.clientIp = readQueryText(source.clientIp);
  query.keyword = readQueryText(source.keyword);
  query.module = readQueryText(source.module);
  query.status = readQueryStatus(source.status);
  query.username = readQueryText(source.username);
}

applyRouteFilters();

/**
 * 模块与动作的翻译 key。
 *
 * 后端返回稳定短码（写入后不改），展示层负责本地化——这样将来新增语言
 * 不需要动数据库，也不会因为文案调整而重写历史记录。
 */
const MODULE_LABELS: Record<string, string> = {
  auth: 'system.operationLog.modules.auth',
  content: 'system.operationLog.modules.content',
  interface: 'system.operationLog.modules.interface',
  key: 'system.operationLog.modules.key',
  package: 'system.operationLog.modules.package',
  payment: 'system.operationLog.modules.payment',
  permission: 'system.operationLog.modules.permission',
  risk: 'system.operationLog.modules.risk',
  system: 'system.operationLog.modules.system',
  ticket: 'system.operationLog.modules.ticket',
  user: 'system.operationLog.modules.user',
};

const ACTION_LABELS: Record<string, string> = {
  'adjust-asset': 'system.operationLog.actionLabels.adjustAsset',
  config: 'system.operationLog.actionLabels.config',
  create: 'system.operationLog.actionLabels.create',
  delete: 'system.operationLog.actionLabels.delete',
  export: 'system.operationLog.actionLabels.export',
  login: 'system.operationLog.actionLabels.login',
  logout: 'system.operationLog.actionLabels.logout',
  password: 'system.operationLog.actionLabels.password',
  review: 'system.operationLog.actionLabels.review',
  status: 'system.operationLog.actionLabels.status',
  update: 'system.operationLog.actionLabels.update',
};

const moduleOptions = computed(() =>
  Object.entries(MODULE_LABELS).map(([value, key]) => ({
    label: $t(key),
    value,
  })),
);

const actionOptions = computed(() =>
  Object.entries(ACTION_LABELS).map(([value, key]) => ({
    label: $t(key),
    value,
  })),
);

const statusOptions = computed(() => [
  { label: $t('system.operationLog.status.success'), value: 'true' },
  { label: $t('system.operationLog.status.failed'), value: 'false' },
]);

function moduleLabel(value: string) {
  const key = value ? MODULE_LABELS[value] : undefined;
  return key ? $t(key) : (value ?? '—');
}

function actionLabel(value: string) {
  const key = value ? ACTION_LABELS[value] : undefined;
  return key ? $t(key) : (value ?? '—');
}

/** 失败记录用红色，成功保持默认，避免整表着色干扰阅读。 */
function statusColor(status: boolean) {
  return status ? 'success' : 'error';
}

function statusText(status: boolean) {
  return status
    ? $t('system.operationLog.status.success')
    : $t('system.operationLog.status.failed');
}

async function loadOverview() {
  if (props.personal) return;
  overviewLoading.value = true;
  try {
    overview.value = await getOperationLogOverviewApi();
  } catch {
    // 概览失败不影响列表：卡片区显示占位，不弹错误打断排查流程。
    overview.value = undefined;
  } finally {
    overviewLoading.value = false;
  }
}

async function loadList() {
  const request = ++listRequest;
  loading.value = true;
  listError.value = false;
  detailRecord.value = undefined;
  try {
    const fetchList = props.personal
      ? getMyOperationLogListApi
      : getOperationLogListApi;
    const result = await fetchList({ ...query });
    if (request !== listRequest) return;
    rows.value = result.items ?? [];
    total.value = result.total ?? 0;
  } catch {
    if (request !== listRequest) return;
    // requestClient reports the request error once; retain a visible retry state.
    rows.value = [];
    total.value = 0;
    listError.value = true;
  } finally {
    if (request === listRequest) loading.value = false;
  }
}

async function refreshAll() {
  await Promise.all([loadOverview(), loadList()]);
}

function handleSearch() {
  query.page = 1;
  void loadList();
}

function handleReset() {
  query.action = undefined;
  query.clientIp = undefined;
  query.keyword = undefined;
  query.module = undefined;
  query.status = undefined;
  query.username = undefined;
  query.page = 1;
  void loadList();
}

function handlePageChange(page: number, pageSize: number) {
  query.page = page;
  query.pageSize = pageSize;
  void loadList();
}

/** 打开详情弹窗。每次打开都重置地区解析状态，避免串到上一条记录。 */
function openDetail(record: OperationLogItem) {
  resetRegionState();
  detailRecord.value = record;
}

/** 关闭详情弹窗，同时丢弃本次解析状态。 */
function closeDetail() {
  resetRegionState();
  detailRecord.value = undefined;
}

function handleStatusChange(value: unknown) {
  if (value === undefined || value === null || value === '') {
    query.status = undefined;
    return;
  }
  query.status = String(value) === 'true';
}

/**
 * 复制客户端 IP。审计场景经常需要把 IP 贴到别处检索，
 * 手动选中在窄表格里很容易拖错，这里提供一键复制。
 */
async function copyIp(ip?: string) {
  if (!ip) return;
  try {
    await navigator.clipboard.writeText(ip);
    message.success($t('system.operationLog.ipCopied'));
  } catch {
    message.warning($t('system.operationLog.copyFailed'));
  }
}

/** 详情弹窗里的地区解析状态。 */
const regionLoading = shallowRef(false);
/** 该记录的完整地区串（国家 省 市），空串表示尚未解析出结果。 */
const resolvedRegion = ref('');
/** 解析后是否确认「该 IP 无地区数据」，用于区分「未解析」与「解析不到」。 */
const regionUnavailable = shallowRef(false);

/**
 * 当前详情记录已落库的地区串。
 *
 * 从记录快照计算而不是直接读单个字段，这样「列表已带地区」与「刚刚解析出
 * 结果后回写」两条路径共用同一种展示格式。
 */
const detailRegionFromRecord = computed(() => {
  const record = detailRecord.value;
  if (!record) return '';
  return [record.country, record.province, record.city]
    .filter(Boolean)
    .join(' ');
});

/** 优先展示本次解析结果，否则回退到记录自带的地区。 */
const regionDisplay = computed(
  () => resolvedRegion.value || detailRegionFromRecord.value,
);

/**
 * 地区为空时「—」占位符的解释文案。
 *
 * 三种情形区分开：个人视图没有解析入口（也看不到 IP），解析过但上游确实无
 * 数据，以及尚未解析（管理员可直接点按钮）。含糊地说「未知」会让人以为
 * 系统坏了而不是数据本身缺失。
 */
const regionEmptyHint = computed(() => {
  if (props.personal) {
    return $t('system.operationLog.detail.regionUnavailable');
  }
  return regionUnavailable.value
    ? $t('system.operationLog.detail.regionUnavailable')
    : $t('system.operationLog.detail.regionHint');
});

function resetRegionState() {
  regionLoading.value = false;
  resolvedRegion.value = '';
  regionUnavailable.value = false;
}

/**
 * 按需解析当前记录的地区。
 *
 * 该操作会写库（服务端回填地区列），因此只在用户显式点击时触发；
 * 服务端采用「三列皆空才写」的条件更新，重复点击不会覆盖已有结果。
 */
async function resolveRegion() {
  const record = detailRecord.value;
  if (!record || regionLoading.value) return;
  regionLoading.value = true;
  regionUnavailable.value = false;
  try {
    const result = await resolveOperationLogRegionApi(record.id);
    const text = [result.country, result.province, result.city]
      .filter(Boolean)
      .join(' ');
    resolvedRegion.value = text;
    if (text) {
      // 同步回写当前行，关闭弹窗后列表无需重新拉取即可显示新地区。
      record.country = result.country;
      record.province = result.province;
      record.city = result.city;
      message.success($t('system.operationLog.detail.regionResolved'));
    } else {
      regionUnavailable.value = true;
      message.warning($t('system.operationLog.detail.regionUnavailable'));
    }
  } catch {
    // requestClient 已统一提示网络/服务端错误，这里只恢复按钮可用性。
    message.warning($t('system.operationLog.detail.regionFailed'));
  } finally {
    regionLoading.value = false;
  }
}

const summaryCards = computed(() => {
  const value = overview.value;
  return [
    {
      label: $t('system.operationLog.stats.total'),
      tone: 'default',
      value: value?.totalCount ?? 0,
    },
    {
      label: $t('system.operationLog.stats.today'),
      tone: 'primary',
      value: value?.todayCount ?? 0,
    },
    {
      label: $t('system.operationLog.stats.login'),
      tone: 'default',
      value: value?.loginCount ?? 0,
    },
    {
      label: $t('system.operationLog.stats.failure'),
      tone: (value?.failureCount ?? 0) > 0 ? 'danger' : 'default',
      value: value?.failureCount ?? 0,
    },
    {
      label: $t('system.operationLog.stats.activeUsers'),
      tone: 'default',
      value: value?.activeUsers ?? 0,
    },
  ];
});

const columns = computed(() => [
  {
    key: 'createdAt',
    title: $t('system.operationLog.columns.time'),
    width: 170,
  },
  {
    key: 'username',
    title: $t('system.operationLog.columns.operator'),
    width: 150,
  },
  {
    key: 'module',
    title: $t('system.operationLog.columns.module'),
    width: 120,
  },
  {
    key: 'action',
    title: $t('system.operationLog.columns.action'),
    width: 110,
  },
  { key: 'summary', title: $t('system.operationLog.columns.summary') },
  {
    dataIndex: 'status',
    key: 'status',
    title: $t('system.operationLog.columns.result'),
    width: 100,
  },
  {
    key: 'clientIp',
    title: $t('system.operationLog.columns.clientIp'),
    width: 150,
  },
  {
    key: 'elapsedMs',
    title: $t('system.operationLog.columns.elapsed'),
    width: 90,
  },
  { key: 'ops', title: $t('system.operationLog.columns.ops'), width: 80 },
]);

onMounted(refreshAll);
</script>

<template>
  <Page
    :title="
      $t(
        personal
          ? 'system.operationLog.personalTitle'
          : 'system.operationLog.title',
      )
    "
  >
    <div class="operation-log">
      <p class="text-sm text-muted-foreground">
        {{
          $t(
            personal
              ? 'system.operationLog.personalScope'
              : 'system.operationLog.adminScope',
          )
        }}
      </p>
      <div v-if="!personal" class="operation-log__stats">
        <Card
          v-for="card in summaryCards"
          :key="card.label"
          :loading="overviewLoading"
          size="small"
          class="operation-log__stat"
          :class="`operation-log__stat--${card.tone}`"
        >
          <span class="operation-log__stat-label">{{ card.label }}</span>
          <strong class="operation-log__stat-value">
            {{ card.value?.toLocaleString('zh-CN') ?? '—' }}
          </strong>
        </Card>
      </div>

      <Alert
        v-if="listError"
        type="error"
        show-icon
        :message="$t('system.operationLog.loadFailed')"
      >
        <template #action
          ><Button :loading="loading" @click="loadList">{{
            $t('system.operationLog.actions.refresh')
          }}</Button></template
        >
      </Alert>
      <Card class="operation-log__panel">
        <div class="operation-log__filters">
          <Input
            v-model:value="query.keyword"
            :placeholder="$t('system.operationLog.filters.keywordPlaceholder')"
            allow-clear
            class="operation-log__filter"
            @press-enter="handleSearch"
          />
          <Input
            v-if="!personal"
            v-model:value="query.username"
            :placeholder="$t('system.operationLog.filters.usernamePlaceholder')"
            allow-clear
            class="operation-log__filter"
            @press-enter="handleSearch"
          />
          <Select
            v-model:value="query.module"
            :options="moduleOptions"
            :placeholder="$t('system.operationLog.filters.modulePlaceholder')"
            allow-clear
            class="operation-log__filter"
          />
          <Select
            v-model:value="query.action"
            :options="actionOptions"
            :placeholder="$t('system.operationLog.filters.actionPlaceholder')"
            allow-clear
            class="operation-log__filter"
          />
          <Select
            :value="
              query.status === undefined ? undefined : String(query.status)
            "
            :options="statusOptions"
            :placeholder="$t('system.operationLog.filters.statusPlaceholder')"
            allow-clear
            class="operation-log__filter"
            @change="handleStatusChange"
          />
          <Input
            v-model:value="query.clientIp"
            :placeholder="$t('system.operationLog.filters.ipPlaceholder')"
            allow-clear
            class="operation-log__filter"
            @press-enter="handleSearch"
          />
          <div class="operation-log__filter-actions">
            <Button type="primary" @click="handleSearch">
              {{ $t('system.operationLog.actions.search') }}
            </Button>
            <Button @click="handleReset">
              {{ $t('system.operationLog.actions.reset') }}
            </Button>
            <Tooltip :title="$t('system.operationLog.actions.refresh')">
              <Button :loading="loading" @click="refreshAll">
                <template #icon><RotateCw /></template>
              </Button>
            </Tooltip>
          </div>
        </div>

        <Table
          :columns="columns"
          :data-source="rows"
          :loading="loading"
          :pagination="false"
          :scroll="{ x: 1280 }"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'createdAt'">
              <span class="operation-log__mono">{{ record.createdAt }}</span>
            </template>
            <template v-else-if="column.key === 'username'">
              <div class="operation-log__operator">
                <IconifyIcon icon="lucide:user-round" />
                <span>{{
                  record.username ||
                  $t('system.operationLog.anonymousUser', [record.userId])
                }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'module'">
              <Tag>{{ moduleLabel(record.module) }}</Tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <span>{{ actionLabel(record.action) }}</span>
            </template>
            <template v-else-if="column.key === 'summary'">
              <div class="operation-log__summary">
                <span>{{ record.summary || '—' }}</span>
                <small v-if="record.errorMessage" class="operation-log__error">
                  {{ record.errorMessage }}
                </small>
              </div>
            </template>
            <template v-else-if="column.key === 'status'">
              <Tag :color="statusColor(record.status)">
                {{ statusText(record.status) }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'clientIp'">
              <button
                v-if="record.clientIp"
                class="operation-log__ip"
                type="button"
                @click="copyIp(record.clientIp)"
              >
                <span class="operation-log__mono">{{ record.clientIp }}</span>
                <IconifyIcon icon="lucide:copy" />
              </button>
              <span v-else>—</span>
            </template>
            <template v-else-if="column.key === 'elapsedMs'">
              <span class="operation-log__mono">{{ record.elapsedMs }} ms</span>
            </template>
            <template v-else-if="column.key === 'ops'">
              <Button
                size="small"
                type="link"
                @click="openDetail(record as OperationLogItem)"
              >
                {{ $t('system.operationLog.actions.detail') }}
              </Button>
            </template>
          </template>
        </Table>

        <div class="operation-log__pager">
          <Pagination
            :current="query.page"
            :page-size="query.pageSize"
            :total="total"
            :show-size-changer="true"
            :page-size-options="['20', '50', '100']"
            :show-total="
              (value: number) => $t('system.operationLog.totalItems', [value])
            "
            @change="handlePageChange"
          />
        </div>
      </Card>
    </div>

    <Modal
      :open="!!detailRecord"
      :title="$t('system.operationLog.detailTitle')"
      :footer="null"
      :width="760"
      :get-container="false"
      destroy-on-close
      @cancel="closeDetail"
    >
      <dl v-if="detailRecord" class="operation-log__detail-grid">
        <div>
          <dt>{{ $t('system.operationLog.columns.time') }}</dt>
          <dd class="operation-log__mono">{{ detailRecord.createdAt }}</dd>
        </div>
        <div>
          <dt>{{ $t('system.operationLog.columns.operator') }}</dt>
          <dd>{{
            detailRecord.username ||
            $t('system.operationLog.anonymousUser', [detailRecord.userId])
          }}</dd>
        </div>
        <div>
          <dt>{{ $t('system.operationLog.columns.module') }}</dt>
          <dd>
            {{ moduleLabel(detailRecord.module) }} /
            {{ actionLabel(detailRecord.action) }}
          </dd>
        </div>
        <div>
          <dt>{{ $t('system.operationLog.columns.result') }}</dt>
          <dd>
            <Tag :color="statusColor(detailRecord.status)">
              {{ statusText(detailRecord.status) }} ({{
                detailRecord.statusCode
              }})
            </Tag>
          </dd>
        </div>
        <div v-if="detailRecord.targetId">
          <dt>{{ $t('system.operationLog.targetId') }}</dt>
          <dd class="operation-log__mono">{{ detailRecord.targetId }}</dd>
        </div>
        <div>
          <dt>{{ $t('system.operationLog.detail.request') }}</dt>
          <dd class="operation-log__mono">
            {{ detailRecord.method }} {{ detailRecord.path }}
          </dd>
        </div>
        <div>
          <dt>{{ $t('system.operationLog.columns.clientIp') }}</dt>
          <dd class="operation-log__mono">
            {{ detailRecord.clientIp || '—' }}
          </dd>
        </div>
        <div>
          <dt>{{ $t('system.operationLog.detail.location') }}</dt>
          <dd class="operation-log__region">
            <span v-if="regionDisplay">{{ regionDisplay }}</span>
            <template v-else>
              <Tooltip :title="regionEmptyHint">
                <span class="operation-log__mono">—</span>
              </Tooltip>
              <Button
                v-if="!props.personal"
                :loading="regionLoading"
                size="small"
                type="link"
                @click="resolveRegion"
              >
                {{
                  regionLoading
                    ? $t('system.operationLog.detail.resolvingRegion')
                    : $t('system.operationLog.detail.resolveRegion')
                }}
              </Button>
            </template>
          </dd>
        </div>
        <div>
          <dt>{{ $t('system.operationLog.detail.userAgent') }}</dt>
          <dd class="operation-log__wrap">
            {{ detailRecord.userAgent || '—' }}
          </dd>
        </div>
        <div v-if="detailRecord.errorMessage">
          <dt>{{ $t('system.operationLog.detail.error') }}</dt>
          <dd class="operation-log__error">{{ detailRecord.errorMessage }}</dd>
        </div>
        <div v-if="detailRecord.detail" class="operation-log__detail-full">
          <dt>{{ $t('system.operationLog.detail.payload') }}</dt>
          <dd class="operation-log__mono operation-log__wrap">
            {{ detailRecord.detail }}
          </dd>
        </div>
      </dl>
    </Modal>

    <Empty
      v-if="!loading && !listError && !rows.length && !detailRecord"
      class="operation-log__empty"
      :description="$t('system.operationLog.empty')"
    />
  </Page>
</template>

<style scoped>
.operation-log {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  gap: 16px;
}

.operation-log__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.operation-log__stat {
  border-radius: 12px;
}

.operation-log__stat-label {
  display: block;
  color: rgb(100 116 139);
  font-size: 12px;
}

.operation-log__stat-value {
  display: block;
  margin-top: 6px;
  font-size: 22px;
  line-height: 1.2;
}

.operation-log__stat--primary .operation-log__stat-value {
  color: #2563eb;
}

.operation-log__stat--danger .operation-log__stat-value {
  color: #dc2626;
}

.operation-log__panel {
  min-width: 0;
  border-radius: 14px;
}

.operation-log__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.operation-log__filter {
  width: 180px;
}

.operation-log__filter-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.operation-log__mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.operation-log__operator {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.operation-log__summary {
  display: grid;
  gap: 2px;
}

.operation-log__error {
  color: #dc2626;
  font-size: 12px;
}

.operation-log__ip {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.operation-log__ip:hover {
  color: #2563eb;
}

/* 地区值可能为空（历史记录未解析），让「—」与解析按钮在同一行对齐。 */
.operation-log__region {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.operation-log__pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.operation-log__detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}

.operation-log__detail-grid dt {
  color: rgb(100 116 139);
  font-size: 12px;
}

.operation-log__detail-grid dd {
  margin: 4px 0 0;
  font-size: 13px;
}

.operation-log__detail-full {
  grid-column: 1 / -1;
}

.operation-log__wrap {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.operation-log__empty {
  margin-top: 24px;
}
</style>
