import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import OperationLogPage from './index.vue';
const api = vi.hoisted(() => ({
  list: vi.fn(),
  mine: vi.fn(),
  overview: vi.fn(),
  region: vi.fn(),
  error: vi.fn(),
}));
const routeQuery = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery.current }),
}));
vi.mock('#/api/core/operation-log', () => ({
  getOperationLogListApi: api.list,
  getMyOperationLogListApi: api.mine,
  getOperationLogOverviewApi: api.overview,
  resolveOperationLogRegionApi: api.region,
}));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/icons', () => ({
  IconifyIcon: { render: () => null },
  RotateCw: { render: () => null },
}));
vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Page: defineComponent({
      props: ['title'],
      setup:
        (props, { slots }) =>
        () =>
          h('main', [h('h1', props.title), slots.default?.()]),
    }),
  };
});
vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  const simple = (tag = 'div') =>
    defineComponent({
      setup:
        (_, { attrs, slots }) =>
        () =>
          h(tag, attrs, [slots.default?.(), slots.action?.()]),
    });
  return {
    Alert: defineComponent({
      props: ['message'],
      setup:
        (props, { slots }) =>
        () =>
          h('aside', { role: 'alert' }, [props.message, slots.action?.()]),
    }),
    Button: simple('button'),
    Card: simple(),
    Empty: simple(),
    Modal: defineComponent({
      props: ['open', 'title'],
      setup:
        (props, { slots }) =>
        () =>
          props.open
            ? h('section', { role: 'dialog' }, [slots.default?.()])
            : null,
    }),
    Select: simple(),
    Tag: simple(),
    Tooltip: simple(),
    Input: defineComponent({
      props: ['value', 'placeholder'],
      emits: ['update:value'],
      setup:
        (props, { emit }) =>
        () =>
          h('input', {
            placeholder: props.placeholder,
            value: props.value,
            onInput: (event: Event) =>
              emit('update:value', (event.target as HTMLInputElement).value),
          }),
    }),
    Pagination: simple(),
    Table: defineComponent({
      props: ['dataSource'],
      setup:
        (props, { slots }) =>
        () =>
          h('div', [
            h('pre', JSON.stringify(props.dataSource)),
            ...(props.dataSource ?? []).map((record: unknown) =>
              slots.bodyCell?.({ column: { key: 'ops' }, record }),
            ),
          ]),
    }),
    message: { error: api.error, success: vi.fn(), warning: vi.fn() },
  };
});
let cleanup: () => void;
function mount(personal = false) {
  const el = document.createElement('div');
  document.body.append(el);
  const app = createApp(OperationLogPage, { personal });
  app.mount(el);
  cleanup = () => {
    app.unmount();
    el.remove();
  };
  return el;
}

/** 按文案查找按钮；找不到时返回 null（调用方可断言「不存在」）。 */
function findButton(el: HTMLElement, text: string) {
  return (
    [...el.querySelectorAll('button')].find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

/** 按文案点击按钮并断言其存在，避免测试里扩散非空断言。 */
function clickButton(el: HTMLElement, text: string) {
  const button = findButton(el, text);
  if (!button) {
    throw new Error(`button not found: ${text}`);
  }
  button.click();
}
beforeEach(() => {
  vi.clearAllMocks();
  routeQuery.current = {};
  api.list.mockResolvedValue({
    items: [{ id: '1', username: 'admin', summary: 'admin-only' }],
    total: 1,
  });
  api.mine.mockResolvedValue({
    items: [{ id: '2', username: 'alice', summary: 'my-login' }],
    total: 1,
  });
  api.overview.mockResolvedValue({
    totalCount: 1,
    todayCount: 1,
    failureCount: 0,
    loginCount: 1,
    activeUsers: 1,
  });
});
afterEach(() => cleanup?.());
it('applies alert deep-link filters before the first list request', async () => {
  routeQuery.current = { action: 'login', module: 'user', status: 'false' };
  const el = mount();
  await vi.waitFor(() => expect(api.list).toHaveBeenCalledOnce());
  expect(api.list).toHaveBeenCalledWith(
    expect.objectContaining({
      action: 'login',
      module: 'user',
      page: 1,
      status: false,
    }),
  );
  await nextTick();
  expect(el.textContent).toContain('admin-only');
});

it('personal view only loads the caller-scoped endpoint, without admin statistics or actor search', async () => {
  const el = mount(true);
  await vi.waitFor(() => expect(api.mine).toHaveBeenCalledOnce());
  await nextTick();
  expect(api.list).not.toHaveBeenCalled();
  expect(api.overview).not.toHaveBeenCalled();
  expect(el.textContent).toContain('system.operationLog.personalTitle');
  expect(el.textContent).toContain('my-login');
  expect(el.textContent).not.toContain('admin-only');
  expect(
    el.querySelector(
      'input[placeholder="system.operationLog.filters.usernamePlaceholder"]',
    ),
  ).toBeNull();
});
it('system view still uses the administrator list and administrator overview', async () => {
  const el = mount();
  await vi.waitFor(() => expect(el.textContent).toContain('admin-only'));
  expect(api.list).toHaveBeenCalledOnce();
  expect(api.overview).toHaveBeenCalledOnce();
  expect(api.mine).not.toHaveBeenCalled();
});
it('shows an inline retryable error without a second global error toast', async () => {
  api.list.mockRejectedValueOnce(new Error('unavailable'));
  const el = mount();
  await vi.waitFor(() =>
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'system.operationLog.loadFailed',
    ),
  );
  expect(api.error).not.toHaveBeenCalled();
  const retry = [...el.querySelectorAll('button')].find(
    (button) => button.textContent === 'system.operationLog.actions.refresh',
  );
  expect(retry).toBeTruthy();
  retry!.click();
  await vi.waitFor(() => expect(el.textContent).toContain('admin-only'));
  expect(el.textContent).not.toContain('system.operationLog.loadFailed');
});

it('does not replace a newer query with a slower old response', async () => {
  let finish!: (page: unknown) => void;
  api.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const el = mount();
  await vi.waitFor(() => expect(api.list).toHaveBeenCalledOnce());
  const search = [...el.querySelectorAll('button')].find(
    (button) => button.textContent === 'system.operationLog.actions.search',
  );
  search!.click();
  await vi.waitFor(() => expect(el.textContent).toContain('admin-only'));
  finish({
    items: [{ id: '3', username: 'old', summary: 'outdated-result' }],
    total: 1,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
  expect(el.textContent).toContain('admin-only');
  expect(el.textContent).not.toContain('outdated-result');
});

it('shows the saved operation target in details even though request paths are templates', async () => {
  api.mine.mockResolvedValueOnce({
    items: [
      {
        id: '2',
        username: 'alice',
        module: 'key',
        action: 'update',
        summary: '修改密钥',
        targetId: '701',
        method: 'PUT',
        path: '/system-api/key/:id',
        status: true,
      },
    ],
    total: 1,
  });
  const el = mount(true);
  await vi.waitFor(() => expect(el.textContent).toContain('修改密钥'));
  // 打开详情前没有弹窗；点击后以对话框形式出现并包含目标 ID。
  expect(el.querySelector('[role="dialog"]')).toBeNull();
  const detail = [...el.querySelectorAll('button')].find(
    (button) => button.textContent === 'system.operationLog.actions.detail',
  );
  detail!.click();
  await nextTick();
  const dialog = el.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(dialog?.querySelector('.operation-log__detail-grid')?.textContent).toContain(
    '701',
  );
});

it('shows an empty region with a resolve action only for administrators', async () => {
  api.list.mockResolvedValueOnce({
    items: [{ id: '5', username: 'admin', summary: 'admin-op' }],
    total: 1,
  });
  const el = mount();
  await vi.waitFor(() => expect(el.textContent).toContain('admin-op'));
  clickButton(el, 'system.operationLog.actions.detail');
  await nextTick();
  const region = el.querySelector('.operation-log__region');
  expect(region).not.toBeNull();
  // 空地区显示占位符 + 解析按钮。
  expect(findButton(el, 'system.operationLog.detail.resolveRegion')).toBeTruthy();
});

it('renders the resolved region after clicking resolve', async () => {
  api.region.mockResolvedValueOnce({
    clientIp: '8.8.8.8',
    country: '中国',
    province: '广东',
    city: '深圳',
  });
  api.list.mockResolvedValueOnce({
    items: [{ id: '5', username: 'admin', summary: 'admin-op' }],
    total: 1,
  });
  const el = mount();
  await vi.waitFor(() => expect(el.textContent).toContain('admin-op'));
  clickButton(el, 'system.operationLog.actions.detail');
  await nextTick();
  clickButton(el, 'system.operationLog.detail.resolveRegion');
  await vi.waitFor(() => expect(api.region).toHaveBeenCalledWith('5'));
  await vi.waitFor(() =>
    expect(el.querySelector('.operation-log__region')?.textContent).toContain(
      '中国 广东 深圳',
    ),
  );
});

it('does not offer region resolution in the personal view', async () => {
  api.mine.mockResolvedValueOnce({
    items: [{ id: '2', username: 'alice', summary: 'my-op' }],
    total: 1,
  });
  const el = mount(true);
  await vi.waitFor(() => expect(el.textContent).toContain('my-op'));
  clickButton(el, 'system.operationLog.actions.detail');
  await nextTick();
  expect(findButton(el, 'system.operationLog.detail.resolveRegion')).toBeNull();
});
