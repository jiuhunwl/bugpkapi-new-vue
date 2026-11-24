import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import IpConfigPage from './index.vue';

const ipConfigApi = vi.hoisted(() => ({
  getIpSourceConfig: vi.fn(),
  testIpSource: vi.fn(),
  updateIpSourceConfig: vi.fn(),
}));

vi.mock('#/api/system/ip-config', () => ipConfigApi);
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({ accessCodes: [] }),
  useUserStore: () => ({ userRoles: ['admin'] }),
}));
vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Page: defineComponent({
      name: 'Page',
      setup(_props, { slots }) {
        return () => h('main', [slots.extra?.(), slots.default?.()]);
      },
    }),
  };
});
vi.mock('@vben/icons', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    IconifyIcon: defineComponent({
      name: 'IconifyIcon',
      setup() {
        return () => h('i');
      },
    }),
  };
});
vi.mock('#/adapter/form', async () => {
  const { defineComponent, h, reactive } = await import('vue');
  return {
    useVbenForm(options: {
      handleValuesChange?: (values: Record<string, unknown>) => void;
      schema: Array<{
        defaultValue?: unknown;
        fieldName: string;
      }>;
    }) {
      const values = reactive<Record<string, unknown>>({});
      for (const field of options.schema) {
        values[field.fieldName] = field.defaultValue;
      }
      const notifyValuesChange = () =>
        options.handleValuesChange?.({ ...values });
      const Form = defineComponent({
        name: 'IpSourceFormStub',
        setup() {
          return () =>
            h('input', {
              'data-testid': 'api-url',
              onInput: (event: Event) => {
                values.apiUrl = (event.target as HTMLInputElement).value;
                notifyValuesChange();
              },
              value: String(values.apiUrl ?? ''),
            });
        },
      });
      return [
        Form,
        {
          getValues: async () => ({ ...values }),
          setValues: async (nextValues: Record<string, unknown>) => {
            Object.assign(values, nextValues);
            notifyValuesChange();
          },
        },
      ];
    },
  };
});
vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      setup(_props, { attrs, slots }) {
        return () => h(tag, attrs, [slots.extra?.(), slots.default?.()]);
      },
    });
  const modelInput = (name: string, testId?: string) =>
    defineComponent({
      name,
      inheritAttrs: false,
      props: {
        placeholder: String,
        value: String,
      },
      emits: ['update:value'],
      setup(props, { attrs, emit }) {
        return () =>
          h('input', {
            ...attrs,
            'data-testid':
              testId ??
              (props.placeholder === 'ipConfig.mapping.testIpPlaceholder'
                ? 'test-ip'
                : undefined),
            onInput: (event: Event) =>
              emit('update:value', (event.target as HTMLInputElement).value),
            value: props.value ?? '',
          });
      },
    });
  return {
    Alert: passthrough('Alert'),
    AutoComplete: modelInput('AutoComplete'),
    Button: passthrough('Button', 'button'),
    Card: passthrough('Card', 'section'),
    Input: modelInput('Input'),
    message: {
      error: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
    Tag: passthrough('Tag', 'span'),
  };
});

const mountedApps: Array<{ app: App; container: HTMLDivElement }> = [];

function successfulTestResult() {
  return {
    fields: [
      { path: '$.country', valuePreview: 'United States', valueType: 'string' },
    ],
    invalidFields: ['country'],
    missingPairFields: [],
    preview: {
      city: 'Mountain View',
      country: 'United States',
      isp: 'Example ISP',
      latitude: 37.4,
      longitude: -122.1,
      province: 'California',
    },
  };
}

function mountPage() {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(IpConfigPage);
  app.mount(container);
  mountedApps.push({ app, container });
  return container;
}

async function flushUpdates() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
    await nextTick();
  }
}

async function clickTestButton(container: HTMLElement) {
  const button = [...container.querySelectorAll('button')].find((element) =>
    element.textContent?.includes('ipConfig.mapping.testButton'),
  );
  expect(button).toBeDefined();
  button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await flushUpdates();
}

async function setInputValue(
  container: HTMLElement,
  selector: string,
  value: string,
) {
  const input = container.querySelector<HTMLInputElement>(selector);
  expect(input).not.toBeNull();
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flushUpdates();
}

describe('ip source test result freshness', () => {
  beforeEach(() => {
    ipConfigApi.getIpSourceConfig.mockResolvedValue({
      apiUrl: 'https://geo.example.test/{ip}',
      dataSourceName: 'custom',
      enabled: 1,
      parseRule: 'country=$.country',
      remark: '',
    });
    ipConfigApi.testIpSource.mockResolvedValue(successfulTestResult());
    ipConfigApi.updateIpSourceConfig.mockResolvedValue(true);
  });

  afterEach(() => {
    for (const { app, container } of mountedApps.splice(0)) {
      app.unmount();
      container.remove();
    }
    vi.clearAllMocks();
  });

  it.each([
    ['API URL', '[data-testid="api-url"]', 'https://other.test/{ip}'],
    ['test IP', '[data-testid="test-ip"]', '1.1.1.1'],
    ['JSONPath mapping', '.ip-field-mapping-row input', '$.location.country'],
  ])(
    'hides the previous preview and diagnostics when the %s changes',
    async (_label, selector, nextValue) => {
      const container = mountPage();
      await flushUpdates();
      await clickTestButton(container);

      expect(container.querySelector('.ip-source-preview')).not.toBeNull();
      expect(
        container.querySelector('.ip-field-mapping-row.has-error'),
      ).not.toBeNull();

      await setInputValue(container, selector, nextValue);

      expect(container.querySelector('.ip-source-preview')).toBeNull();
      expect(
        container.querySelector('.ip-field-mapping-row.has-error'),
      ).toBeNull();
    },
  );

  it('does not show a response for inputs changed while the test is running', async () => {
    let resolveTest:
      | ((result: ReturnType<typeof successfulTestResult>) => void)
      | undefined;
    ipConfigApi.testIpSource.mockReturnValue(
      new Promise((resolve) => {
        resolveTest = resolve;
      }),
    );
    const container = mountPage();
    await flushUpdates();
    await clickTestButton(container);

    await setInputValue(container, '[data-testid="test-ip"]', '1.1.1.1');
    resolveTest?.(successfulTestResult());
    await flushUpdates();

    expect(container.querySelector('.ip-source-preview')).toBeNull();
    expect(
      container.querySelector('.ip-field-mapping-row.has-error'),
    ).toBeNull();
  });
});
