import type { InterfaceApi } from '#/api/interface';

import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InterfaceForm from './form.vue';

const state = vi.hoisted(() => ({
  options: {} as {
    onConfirm: () => Promise<void>;
    onOpenChange: (open: boolean) => Promise<void>;
  },
  data: undefined as InterfaceApi.InterfaceItem | undefined,
  values: {} as Record<string, unknown>,
  updated: vi.fn(),
  created: vi.fn(),
}));
vi.mock('#/api/interface', () => ({
  createInterface: state.created,
  updateInterface: state.updated,
  uploadInterfaceAvatar: vi.fn(),
}));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('ant-design-vue', () => ({ message: { success: vi.fn() } }));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({ accessCodes: [] }),
  useUserStore: () => ({ userRoles: ['admin'] }),
}));
vi.mock('../data', () => ({ useFormSchema: () => [] }));
vi.mock('#/adapter/form', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    useVbenForm: () => [
      defineComponent(() => () => h('form')),
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
vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    useVbenDrawer: (options: typeof state.options) => {
      state.options = options;
      return [
        defineComponent({
          setup:
            (_, { slots }) =>
            () =>
              h('section', slots.default?.()),
        }),
        {
          getData: () => state.data,
          close: vi.fn(),
          lock: vi.fn(),
          unlock: vi.fn(),
        },
      ];
    },
  };
});

let unmount: (() => void) | undefined;
async function openForm(editing = true) {
  // A list snapshot can predate enabling checks in the separate polling drawer.
  state.data = editing
    ? {
        id: '7',
        apiCode: 'video',
        name: 'Video',
        isFeatured: 0,
        isTop: 0,
        price: 0,
        pointPrice: 0,
        status: 1,
        requestMethod: 'GET',
        requestUrl: 'https://primary.example/api',
        pollingEnabled: 1,
        pollingMode: 'PRIMARY',
        pollingCheckEnabled: 0,
        pollingCheckField: 'code',
        pollingCheckExpected: '200',
        pollingStopCode: '404',
        upstreamConfigs: [
          {
            url: 'https://backup.example/api',
            pollingCheckEnabled: 0,
            pollingCheckField: 'code',
            pollingCheckExpected: '200',
            responseFieldMappings: [{ source: 'oldPayload', target: 'data' }],
          },
        ],
      }
    : undefined;
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(InterfaceForm);
  app.mount(container);
  unmount = () => {
    app.unmount();
    container.remove();
  };
  await state.options.onOpenChange(true);
  await nextTick();
}

beforeEach(() => {
  vi.clearAllMocks();
  state.updated.mockResolvedValue(undefined);
  state.created.mockResolvedValue(undefined);
});
afterEach(() => {
  unmount?.();
});

function expectNoHiddenChecks(payload: InterfaceApi.SaveInterface) {
  for (const key of [
    'pollingCheckEnabled',
    'pollingCheckField',
    'pollingCheckExpected',
    'pollingStopCode',
    'responseFieldMappings',
  ]) {
    expect(payload).not.toHaveProperty(key);
  }
}

describe('general interface form does not overwrite polling-drawer settings', () => {
  it.each(['name', 'remark', 'requestUrl'])(
    'does not resubmit polling settings when only %s changes',
    async (field) => {
      await openForm();
      state.values[field] =
        field === 'requestUrl' ? 'https://new-primary.example/api' : 'Updated';
      await state.options.onConfirm();
      expect(state.updated).toHaveBeenCalledOnce();
      const [id, payload] = state.updated.mock.calls[0]!;
      expect(id).toBe('7');
      expect(payload[field]).toBe(state.values[field]);
      expectNoHiddenChecks(payload);
      for (const key of [
        'pollingEnabled',
        'pollingMode',
        'upstreamConfigs',
        'upstreamUrls',
      ]) {
        expect(payload).not.toHaveProperty(key);
      }
    },
  );

  it('sends only the changed URLs, never stale per-node checks or mappings', async () => {
    await openForm();
    state.values.upstreamUrlsText =
      'https://backup.example/api\nhttps://new.example/api';
    await state.options.onConfirm();
    const payload = state.updated.mock.calls[0]![1];
    expectNoHiddenChecks(payload);
    expect(payload.upstreamConfigs).toEqual([
      { url: 'https://backup.example/api' },
      { url: 'https://new.example/api' },
    ]);
    expect(payload.upstreamUrls).toEqual([
      'https://backup.example/api',
      'https://new.example/api',
    ]);
    expect(payload).toMatchObject({
      pollingEnabled: 1,
      pollingMode: 'PRIMARY',
    });
  });

  it('still allows explicitly disabling polling without clearing the backup list or checks', async () => {
    await openForm();
    state.values.pollingEnabled = false;
    await state.options.onConfirm();
    const payload = state.updated.mock.calls[0]![1];
    expect(payload).toMatchObject({ pollingEnabled: 0, pollingMode: 'SINGLE' });
    expectNoHiddenChecks(payload);
    expect(payload).not.toHaveProperty('upstreamConfigs');
    expect(payload).not.toHaveProperty('upstreamUrls');
  });

  it('still submits polling settings for a new interface', async () => {
    await openForm(false);
    state.values.pollingEnabled = true;
    state.values.pollingMode = 'ROUND_ROBIN';
    state.values.upstreamUrlsText = 'https://new.example/api';
    await state.options.onConfirm();
    expect(state.created).toHaveBeenCalledOnce();
    expect(state.created.mock.calls[0]![0]).toMatchObject({
      pollingEnabled: 1,
      pollingMode: 'ROUND_ROBIN',
      upstreamConfigs: [{ url: 'https://new.example/api' }],
      upstreamUrls: ['https://new.example/api'],
    });
  });
});
