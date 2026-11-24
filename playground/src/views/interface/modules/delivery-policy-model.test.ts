import type { App } from 'vue';

import type { InterfaceApi } from '#/api/interface';

import { createApp, defineComponent, h, nextTick } from 'vue';

import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DeliveryPolicy from './delivery-policy.vue';

const api = vi.hoisted(() => ({
  getGlobalDeliveryPolicy: vi.fn(),
  getInterfaceDeliveryPolicy: vi.fn(),
  getResponseAdvertisementOptions: vi.fn(),
  updateGlobalDeliveryPolicy: vi.fn(),
  updateInterfaceDeliveryPolicy: vi.fn(),
}));
const drawer = vi.hoisted(() => ({
  options: {} as {
    onConfirm: () => Promise<void>;
    onOpenChange: (open: boolean) => Promise<void>;
  },
  target: { id: '101', scope: 'INTERFACE' as 'GLOBAL' | 'INTERFACE' },
}));

vi.mock('#/api/interface', () => api);
vi.mock('#/locales', () => ({
  $t: (key: string, values: unknown[] = []) => [key, ...values].join(' '),
}));
vi.mock('@vben/icons', () => ({ IconifyIcon: () => null, Plus: () => null }));
// Only replace the app-owned drawer lifecycle; InputNumber/Switch stay real.
vi.mock('@vben/common-ui', () => ({
  useVbenDrawer: (options: typeof drawer.options) => {
    drawer.options = options;
    return [
      defineComponent({
        setup(_props, { slots }) {
          return () => h('div', slots.default?.());
        },
      }),
      {
        close: vi.fn(),
        getData: () => drawer.target,
        lock: vi.fn(),
        unlock: vi.fn(),
      },
    ];
  },
}));

const mounted: Array<{ app: App; container: HTMLDivElement }> = [];

function policy(
  overrides: Partial<InterfaceApi.DeliveryPolicy> = {},
): InterfaceApi.DeliveryPolicy {
  return {
    cacheDefaultTtlSeconds: 0,
    cacheEnabled: 0,
    cachePolicyOverride: 0,
    cacheRules: [],
    effectiveRequestTimeoutMs: 12_000,
    id: '101',
    name: 'Timeout API',
    requestTimeoutMs: 0,
    requestTimeoutOverride: 0,
    responseAdEnabled: 0,
    responseAdField: '_advertisement',
    responseAdId: '0',
    responseAdPolicyOverride: 0,
    ...overrides,
  };
}

async function openPolicy(
  local = policy(),
  scope: 'GLOBAL' | 'INTERFACE' = 'INTERFACE',
) {
  api.getInterfaceDeliveryPolicy.mockResolvedValue(local);
  drawer.target = { id: '101', scope };
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(DeliveryPolicy);
  app.mount(container);
  mounted.push({ app, container });
  await drawer.options.onOpenChange(true);
  await nextTick();
  const panel = container.querySelector('.policy-panel')!;
  const input = panel.querySelector<HTMLInputElement>(
    'input[aria-label="deliveryPolicy.timeout.value"]',
  )!;
  const toggle = container.querySelectorAll<HTMLButtonElement>(
    '.policy-priority [role="switch"]',
  )[2];
  return { container, input, panel, toggle };
}

async function enterTimeout(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getGlobalDeliveryPolicy.mockResolvedValue(
    policy({
      id: '0',
      requestTimeoutMs: 12_000,
      requestTimeoutOverride: 1,
      scope: 'GLOBAL',
    }),
  );
  api.getResponseAdvertisementOptions.mockResolvedValue([]);
  vi.spyOn(message, 'error').mockImplementation(() => undefined as never);
  vi.spyOn(message, 'success').mockImplementation(() => undefined as never);
});

afterEach(() => {
  for (const { app, container } of mounted.splice(0)) {
    app.unmount();
    container.remove();
  }
  vi.restoreAllMocks();
});

import { requestTimeoutValueForSave } from './delivery-policy-model';

describe('delivery policy timeout persistence', () => {
  it('preserves a valid local timeout while the interface inherits global policy', () => {
    expect(
      requestTimeoutValueForSave({
        inherited: true,
        displayedValue: 15_000,
        storedLocalValue: 4_200,
      }),
    ).toBe(4_200);
  });

  it('uses the edited value when the local override is enabled', () => {
    expect(
      requestTimeoutValueForSave({
        inherited: false,
        displayedValue: 8_000,
        storedLocalValue: 4_200,
      }),
    ).toBe(8_000);
  });

  it('writes the inherit marker when no valid local value exists', () => {
    expect(
      requestTimeoutValueForSave({
        inherited: true,
        displayedValue: 15_000,
        storedLocalValue: 0,
      }),
    ).toBe(0);
  });
});

describe('delivery policy timeout editor', () => {
  it('keeps the last valid local timeout when an invalid draft is disabled', async () => {
    const { input, toggle } = await openPolicy(
      policy({
        requestTimeoutMs: 60_000,
        requestTimeoutOverride: 1,
      }),
    );
    await enterTimeout(input, '99');
    toggle!.click();
    await nextTick();
    await drawer.options.onConfirm();
    expect(api.updateInterfaceDeliveryPolicy).toHaveBeenCalledWith(
      '101',
      expect.objectContaining({
        requestTimeoutMs: 60_000,
        requestTimeoutOverride: 0,
      }),
    );
    toggle!.click();
    await nextTick();
    expect(input.value).toBe('60000');
  });

  it('rejects a local 99 ms draft instead of saving an unintended timeout', async () => {
    const { input } = await openPolicy(
      policy({
        requestTimeoutMs: 60_000,
        requestTimeoutOverride: 1,
      }),
    );
    await enterTimeout(input, '99');
    await drawer.options.onConfirm();
    expect(message.error).toHaveBeenCalledWith(
      'deliveryPolicy.messages.invalidInterfaceTimeout',
    );
    expect(api.updateInterfaceDeliveryPolicy).not.toHaveBeenCalled();
  });

  it('displays the global timeout while preserving a disabled local override', async () => {
    const { input, panel } = await openPolicy(
      policy({ requestTimeoutMs: 60_000 }),
    );
    expect(input.disabled).toBe(true);
    expect(input.value).toBe('12000');
    expect(panel.textContent).toContain(
      'deliveryPolicy.timeout.effective 12000',
    );
    await drawer.options.onConfirm();
    expect(api.updateInterfaceDeliveryPolicy).toHaveBeenCalledWith(
      '101',
      expect.objectContaining({
        requestTimeoutMs: 60_000,
        requestTimeoutOverride: 0,
      }),
    );
  });

  it('keeps an edited override through off/on toggles without saving the global display', async () => {
    const { input, toggle } = await openPolicy(
      policy({
        requestTimeoutMs: 60_000,
        requestTimeoutOverride: 1,
      }),
    );
    await enterTimeout(input, '45000');
    toggle!.click();
    await nextTick();
    expect(input.disabled).toBe(true);
    expect(input.value).toBe('12000');
    await drawer.options.onConfirm();
    expect(api.updateInterfaceDeliveryPolicy).toHaveBeenLastCalledWith(
      '101',
      expect.objectContaining({
        requestTimeoutMs: 45_000,
        requestTimeoutOverride: 0,
      }),
    );
    toggle!.click();
    await nextTick();
    expect(input.disabled).toBe(false);
    expect(input.value).toBe('45000');
  });

  it('does not promote a saved zero into a local override on reopen and save', async () => {
    await openPolicy(policy({ requestTimeoutOverride: 1 }));
    await drawer.options.onConfirm();
    expect(api.updateInterfaceDeliveryPolicy).toHaveBeenCalledWith(
      '101',
      expect.objectContaining({
        requestTimeoutMs: 0,
        requestTimeoutOverride: 1,
      }),
    );
  });

  it('allows an explicit zero to follow the actual global value rather than 15000', async () => {
    const { input, panel, toggle } = await openPolicy(
      policy({
        requestTimeoutMs: 60_000,
        requestTimeoutOverride: 1,
      }),
    );
    await enterTimeout(input, '0');
    expect(panel.textContent).toContain(
      'deliveryPolicy.timeout.effective 12000',
    );
    await drawer.options.onConfirm();
    expect(api.updateInterfaceDeliveryPolicy).toHaveBeenCalledWith(
      '101',
      expect.objectContaining({
        requestTimeoutMs: 0,
        requestTimeoutOverride: 1,
      }),
    );
    toggle!.click();
    await nextTick();
    toggle!.click();
    await nextTick();
    expect(input.value).toBe('0');
  });

  it('keeps an unconfigured interface at zero when saving inherited settings', async () => {
    await openPolicy();
    await drawer.options.onConfirm();
    expect(api.updateInterfaceDeliveryPolicy).toHaveBeenCalledWith(
      '101',
      expect.objectContaining({
        requestTimeoutMs: 0,
        requestTimeoutOverride: 0,
      }),
    );
  });

  it('refreshes inherited display from the latest global policy on reopening', async () => {
    const { input, toggle } = await openPolicy(
      policy({ requestTimeoutMs: 60_000 }),
    );
    await drawer.options.onOpenChange(false);
    api.getGlobalDeliveryPolicy.mockResolvedValue(
      policy({
        requestTimeoutMs: 30_000,
        effectiveRequestTimeoutMs: 30_000,
      }),
    );
    await drawer.options.onOpenChange(true);
    await nextTick();
    expect(input.value).toBe('30000');
    toggle!.click();
    await nextTick();
    expect(input.value).toBe('60000');
  });

  it.each([100, 60_000, 120_000])(
    'saves explicit %i ms without a global clamp',
    async (value) => {
      const { input, panel } = await openPolicy(
        policy({ requestTimeoutOverride: 1 }),
      );
      await enterTimeout(input, String(value));
      expect(panel.textContent).toContain(
        'deliveryPolicy.timeout.effective ' + value,
      );
      await drawer.options.onConfirm();
      expect(api.updateInterfaceDeliveryPolicy).toHaveBeenCalledWith(
        '101',
        expect.objectContaining({
          requestTimeoutMs: value,
          requestTimeoutOverride: 1,
        }),
      );
    },
  );

  it.each([100, 120_000])(
    'saves global boundary %i ms using the global API',
    async (value) => {
      const { input } = await openPolicy(policy(), 'GLOBAL');
      expect(input.disabled).toBe(false);
      await enterTimeout(input, String(value));
      await drawer.options.onConfirm();
      expect(api.updateGlobalDeliveryPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestTimeoutMs: value,
          requestTimeoutOverride: 1,
        }),
      );
      expect(api.updateInterfaceDeliveryPolicy).not.toHaveBeenCalled();
    },
  );

  it('does not save a blank global timeout as the interface inherit marker', async () => {
    const { input } = await openPolicy(policy(), 'GLOBAL');
    await enterTimeout(input, '');
    await drawer.options.onConfirm();
    expect(message.error).toHaveBeenCalled();
    expect(api.updateGlobalDeliveryPolicy).not.toHaveBeenCalled();
  });
});
