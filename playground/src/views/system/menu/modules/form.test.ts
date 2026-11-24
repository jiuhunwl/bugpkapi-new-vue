import { createApp } from 'vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MenuForm from './form.vue';
const state = vi.hoisted(() => ({
  options: {} as {
    onConfirm: () => Promise<void>;
    onOpenChange: (open: boolean) => void;
  },
  data: undefined as Record<string, unknown> | undefined,
  values: {} as Record<string, unknown>,
  create: vi.fn(),
  update: vi.fn(),
  success: vi.fn(),
  close: vi.fn(),
  unlock: vi.fn(),
}));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/locales', () => ({ $te: () => true }));
vi.mock('@vben/icons', () => ({ IconifyIcon: { render: () => null } }));
vi.mock('@vben/utils', () => ({ getPopupContainer: () => document.body }));
vi.mock('@vueuse/core', () => ({
  breakpointsTailwind: {},
  useBreakpoints: () => ({ greaterOrEqual: () => ({ value: true }) }),
}));
vi.mock('#/router/routes', () => ({ componentKeys: [] }));
vi.mock('#/api/system/role', () => ({
  getRoleList: vi.fn().mockResolvedValue({ items: [] }),
}));
vi.mock('../data', () => ({ getMenuTypeOptions: () => [] }));
vi.mock('ant-design-vue', () => ({ message: { success: state.success } }));
vi.mock('#/api/system/menu', () => ({
  SystemMenuApi: { BadgeVariants: [], BadgeTypes: [] },
  createMenu: state.create,
  updateMenu: state.update,
  getMenuList: vi.fn(),
  isMenuNameExists: vi.fn(),
  isMenuPathExists: vi.fn(),
}));
vi.mock('#/adapter/form', () => {
  const rule: any = new Proxy(() => rule, { get: () => rule });
  return {
    z: rule,
    useVbenForm: () => [
      { render: () => null },
      {
        validate: async () => ({ valid: true }),
        getValues: async () => ({ ...state.values }),
        resetForm: () => {
          state.values = {};
        },
        setValues: (values: Record<string, unknown>) => {
          state.values = { ...values };
        },
      },
    ],
  };
});
vi.mock('@vben/common-ui', () => ({
  useVbenDrawer: (options: typeof state.options) => {
    state.options = options;
    return [
      { render: () => null },
      {
        getData: () => state.data,
        lock: vi.fn(),
        unlock: state.unlock,
        close: state.close,
      },
    ];
  },
}));
let unmount: () => void;
beforeEach(() => {
  vi.clearAllMocks();
  state.create.mockResolvedValue(undefined);
  state.update.mockResolvedValue(undefined);
  const el = document.createElement('div');
  const app = createApp(MenuForm);
  app.mount(el);
  unmount = () => app.unmount();
});
afterEach(() => unmount?.());

it('reports a saved menu only after the update succeeds', async () => {
  state.data = {
    id: '42',
    name: 'Existing',
    type: 'menu',
    meta: { title: 'Existing' },
  };
  state.options.onOpenChange(true);
  await state.options.onConfirm();
  expect(state.update).toHaveBeenCalledOnce();
  expect(state.success).toHaveBeenCalledOnce();
  expect(state.close).toHaveBeenCalledOnce();
});
it('creates a new menu after editing without reusing the previous menu ID', async () => {
  state.data = {
    id: '42',
    name: 'Existing',
    type: 'menu',
    meta: { title: 'Existing' },
  };
  state.options.onOpenChange(true);
  state.options.onOpenChange(false);
  state.data = undefined;
  state.options.onOpenChange(true);
  state.values = { name: 'NewMenu', type: 'menu', meta: { title: 'New menu' } };
  await state.options.onConfirm();
  expect(state.create).toHaveBeenCalledOnce();
  expect(state.update).not.toHaveBeenCalled();
  expect(state.success).toHaveBeenCalledExactlyOnceWith(
    'operationFeedback.created',
  );
});
it('leaves a failed menu save open and retryable', async () => {
  state.data = undefined;
  state.options.onOpenChange(true);
  state.values = { name: 'NewMenu', type: 'menu', meta: { title: 'New menu' } };
  state.create.mockRejectedValueOnce(new Error('save failed'));
  await state.options.onConfirm();
  expect(state.success).not.toHaveBeenCalled();
  expect(state.close).not.toHaveBeenCalled();
  expect(state.unlock).toHaveBeenCalledOnce();
  await state.options.onConfirm();
  expect(state.create).toHaveBeenCalledTimes(2);
  expect(state.success).toHaveBeenCalledOnce();
});
