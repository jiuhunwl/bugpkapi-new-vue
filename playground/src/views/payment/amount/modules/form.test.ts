import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AmountForm from './form.vue';

const state = vi.hoisted(() => ({
  options: {} as {
    onConfirm: () => Promise<void>;
    onOpenChange: (open: boolean) => Promise<void>;
  },
  data: undefined as Record<string, unknown> | undefined,
  values: {} as Record<string, unknown>,
  validate: vi.fn(),
  close: vi.fn(),
  lock: vi.fn(),
  unlock: vi.fn(),
  created: vi.fn(),
  updated: vi.fn(),
  success: vi.fn(),
}));
vi.mock('#/api/system/payment', () => ({
  createRechargeAmount: state.created,
  updateRechargeAmount: state.updated,
}));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('ant-design-vue', () => ({ message: { success: state.success } }));
vi.mock('#/adapter/form', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    useVbenForm: () => [
      defineComponent(() => () => h('form')),
      {
        validate: state.validate,
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
          close: state.close,
          lock: state.lock,
          unlock: state.unlock,
        },
      ];
    },
  };
});

let unmount: (() => void) | undefined;
let refreshed: ReturnType<typeof vi.fn>;
async function openForm(editing = false) {
  state.data = editing
    ? { id: '11', amount: '20.00', giftAmount: '2.00', sortNo: 2, status: 1 }
    : undefined;
  refreshed = vi.fn();
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(AmountForm, { onSuccess: refreshed });
  app.mount(container);
  unmount = () => {
    app.unmount();
    container.remove();
  };
  await state.options.onOpenChange(true);
  await nextTick();
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.validate.mockResolvedValue({ valid: true });
  state.created.mockResolvedValue(undefined);
  state.updated.mockResolvedValue(undefined);
});
afterEach(() => {
  unmount?.();
});

describe('recharge amount save feedback', () => {
  it.each([false, true])(
    'shows one success message after %s edit mode saves',
    async (editing) => {
      await openForm(editing);
      state.values.giftAmount = '3.00';
      await state.options.onConfirm();
      expect(editing ? state.updated : state.created).toHaveBeenCalledOnce();
      expect(editing ? state.created : state.updated).not.toHaveBeenCalled();
      expect(state.success).toHaveBeenCalledExactlyOnceWith(
        editing ? 'operationFeedback.updated' : 'operationFeedback.created',
      );
      expect(refreshed).toHaveBeenCalledOnce();
      expect(state.close).toHaveBeenCalledOnce();
      expect(state.unlock).toHaveBeenCalledOnce();
    },
  );

  it('waits for the request without claiming success or closing early', async () => {
    await openForm(true);
    const request = deferred();
    state.updated.mockReturnValueOnce(request.promise);
    let finished = false;
    const submission = state.options.onConfirm().then(() => {
      finished = true;
    });
    await vi.waitFor(() => expect(state.updated).toHaveBeenCalledOnce());
    expect(finished).toBe(false);
    expect(state.lock).toHaveBeenCalledOnce();
    expect(state.unlock).not.toHaveBeenCalled();
    expect(state.success).not.toHaveBeenCalled();
    expect(state.close).not.toHaveBeenCalled();
    request.resolve();
    await submission;
    expect(state.unlock).toHaveBeenCalledOnce();
    expect(state.close).toHaveBeenCalledOnce();
  });

  it('prevents duplicate requests including while asynchronous validation is running', async () => {
    await openForm();
    const validation = deferred();
    state.validate.mockImplementationOnce(async () => {
      await validation.promise;
      return { valid: true };
    });
    const first = state.options.onConfirm();
    const second = state.options.onConfirm();
    validation.resolve();
    await Promise.all([first, second]);
    expect(state.validate).toHaveBeenCalledOnce();
    expect(state.created).toHaveBeenCalledOnce();
    expect(state.success).toHaveBeenCalledOnce();
  });

  it('keeps entered values after a rejected save and allows retry without false success', async () => {
    await openForm(true);
    state.values.giftAmount = '8.00';
    state.updated.mockRejectedValueOnce(new Error('network unavailable'));
    await state.options.onConfirm();
    expect(state.values.giftAmount).toBe('8.00');
    expect(state.success).not.toHaveBeenCalled();
    expect(state.close).not.toHaveBeenCalled();
    expect(refreshed).not.toHaveBeenCalled();
    expect(state.unlock).toHaveBeenCalledOnce();
    await state.options.onConfirm();
    expect(state.updated).toHaveBeenLastCalledWith('11', {
      amount: '20.00',
      giftAmount: '8.00',
      sortNo: 2,
      status: 1,
    });
    expect(state.success).toHaveBeenCalledOnce();
    expect(state.close).toHaveBeenCalledOnce();
  });

  it('does not save invalid input and releases the submit lock', async () => {
    await openForm();
    state.validate.mockResolvedValueOnce({ valid: false });
    await state.options.onConfirm();
    expect(state.created).not.toHaveBeenCalled();
    expect(state.success).not.toHaveBeenCalled();
    expect(state.close).not.toHaveBeenCalled();
    await state.options.onConfirm();
    expect(state.created).toHaveBeenCalledOnce();
  });
});
