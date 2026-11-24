/* eslint-disable vue/one-component-per-file -- Test-local component doubles intentionally share this file. */

import type { App } from 'vue';

import { createApp, defineComponent, h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { testInterfaceProxyPool } from '#/api/interface';

import { createProxyPoolDraft } from '../proxy-pool';
import ProxyPoolEditor from './ProxyPoolEditor.vue';

vi.mock('#/api/interface', () => ({
  inspectInterfaceProxyPool: vi.fn(),
  testInterfaceProxyPool: vi.fn(),
}));
vi.mock('#/locales', () => ({
  $t: (key: string) => {
    const translations: Record<string, string> = {
      'polling.proxy.clear': '清空代理配置',
      'polling.proxy.clearConfirm': '确认清空代理配置？',
      'polling.proxy.clearPassword': '清除已保存密码',
      'polling.proxy.test': '测试代理',
    };
    return translations[key] || key;
  },
}));
vi.mock('@vben/icons', () => ({
  IconifyIcon: defineComponent({
    name: 'IconifyIcon',
    setup() {
      return () => h('i');
    },
  }),
}));
vi.mock('ant-design-vue', () => {
  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_props, { attrs, slots }) {
        return () => h('div', attrs, slots.default?.());
      },
    });
  const input = (name: string, type: string) =>
    defineComponent({
      name,
      inheritAttrs: false,
      props: { value: { default: '', type: [String, Number] } },
      emits: ['update:value'],
      setup(props, { attrs, emit }) {
        return () =>
          h('input', {
            ...attrs,
            type,
            value: props.value,
            onInput: (event: Event) =>
              emit('update:value', (event.target as HTMLInputElement).value),
          });
      },
    });
  const button = defineComponent({
    name: 'ProxyPoolButtonStub',
    setup(_props, { attrs, slots }) {
      return () => h('button', { ...attrs, type: 'button' }, slots.default?.());
    },
  });
  const form = Object.assign(passthrough('Form'), {
    Item: passthrough('FormItem'),
  });
  const textInput = Object.assign(input('Input', 'text'), {
    Password: input('InputPassword', 'password'),
  });
  const radio = Object.assign(passthrough('Radio'), {
    Button: passthrough('RadioButton'),
    Group: passthrough('RadioGroup'),
  });
  const switchControl = defineComponent({
    name: 'Switch',
    props: { checked: Boolean },
    emits: ['change'],
    setup(props, { emit }) {
      return () =>
        h('button', {
          'data-proxy-switch': '',
          type: 'button',
          onClick: () => emit('change', !props.checked),
        });
    },
  });
  return {
    AutoComplete: input('AutoComplete', 'search'),
    Button: button,
    Form: form,
    Input: textInput,
    InputNumber: input('InputNumber', 'number'),
    message: { error: vi.fn(), success: vi.fn() },
    Modal: { confirm: vi.fn() },
    Radio: radio,
    Select: passthrough('Select'),
    SelectOption: passthrough('SelectOption'),
    Switch: switchControl,
    Tooltip: passthrough('Tooltip'),
  };
});

const mountedApps: Array<{ app: App; container: HTMLDivElement }> = [];

afterEach(() => {
  for (const { app, container } of mountedApps.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe('ProxyPoolEditor password credentials', () => {
  it('lets an administrator explicitly clear an already configured password', async () => {
    let latest = createProxyPoolDraft({
      enabled: 1,
      host: 'proxy.example.com',
      passwordConfigured: true,
      port: 8080,
      source: 'FIXED',
    });
    const root = defineComponent({
      setup() {
        const model = ref(latest);
        return () =>
          h(ProxyPoolEditor, {
            modelValue: model.value,
            'onUpdate:modelValue': (value) => {
              latest = value;
              model.value = value;
            },
          });
      },
    });
    const container = document.createElement('div');
    document.body.append(container);
    const app = createApp(root);
    app.mount(container);
    mountedApps.push({ app, container });
    await nextTick();

    const clearButton = [...container.querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === '清除已保存密码',
    );
    expect(clearButton).toBeDefined();
    clearButton?.click();
    await nextTick();

    expect(latest.password).toBe('');
    expect(latest.passwordConfigured).toBe(false);
    expect(container.textContent).not.toContain('清除已保存密码');
  });

  it('keeps a disabled proxy configuration visible and restores editing when enabled', async () => {
    let latest = createProxyPoolDraft({
      enabled: 0,
      host: 'proxy.example.com',
      port: 8080,
      source: 'FIXED',
    });
    const root = defineComponent({
      setup() {
        const model = ref(latest);
        return () =>
          h(ProxyPoolEditor, {
            modelValue: model.value,
            'onUpdate:modelValue': (value) => {
              latest = value;
              model.value = value;
            },
          });
      },
    });
    const container = document.createElement('div');
    document.body.append(container);
    const app = createApp(root);
    app.mount(container);
    mountedApps.push({ app, container });
    await nextTick();

    const fieldset = container.querySelector('fieldset');
    expect(fieldset).not.toBeNull();
    expect(fieldset?.disabled).toBe(true);
    expect(container.querySelector('input')?.value).toBe('proxy.example.com');

    container.querySelector<HTMLButtonElement>('[data-proxy-switch]')?.click();
    await nextTick();

    expect(latest.enabled).toBe(1);
    expect(latest.host).toBe('proxy.example.com');
    expect(container.querySelector('fieldset')?.disabled).toBe(false);
  });

  it('clears all proxy fields only after confirmation', async () => {
    const { Modal } = await import('ant-design-vue');
    let latest = createProxyPoolDraft({
      apiHeaders: [{ name: 'Authorization', value: 'Bearer token' }],
      apiUrl: 'https://pool.example.com/next',
      enabled: 1,
      passwordConfigured: true,
      source: 'API',
    });
    const root = defineComponent({
      setup() {
        const model = ref(latest);
        return () =>
          h(ProxyPoolEditor, {
            modelValue: model.value,
            'onUpdate:modelValue': (value) => {
              latest = value;
              model.value = value;
            },
          });
      },
    });
    const container = document.createElement('div');
    document.body.append(container);
    const app = createApp(root);
    app.mount(container);
    mountedApps.push({ app, container });
    await nextTick();

    const clearButton = [...container.querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === '清空代理配置',
    );
    clearButton?.click();
    await nextTick();
    expect(latest.apiUrl).toBe('https://pool.example.com/next');

    const confirmation = vi.mocked(Modal.confirm).mock.calls.at(-1)?.[0];
    expect(confirmation).toBeDefined();
    await confirmation?.onOk?.();
    await nextTick();

    expect(latest).toEqual(createProxyPoolDraft());
  });

  it.each(['FIXED', 'API'] as const)(
    'tests a disabled %s proxy without enabling or saving it',
    async (source) => {
      vi.mocked(testInterfaceProxyPool).mockResolvedValueOnce({
        elapsedMs: 12,
        exitIp: '8.8.8.8',
        protocol: 'HTTP',
        proxyAddress: 'http://proxy.example.com:8080',
        statusCode: 200,
        success: true,
      });
      let latest = createProxyPoolDraft({
        apiUrl: source === 'API' ? 'https://pool.example.com/next' : '',
        enabled: 0,
        host: source === 'FIXED' ? 'proxy.example.com' : '',
        port: source === 'FIXED' ? 8080 : 0,
        source,
      });
      const root = defineComponent({
        setup() {
          const model = ref(latest);
          return () =>
            h(ProxyPoolEditor, {
              modelValue: model.value,
              'onUpdate:modelValue': (value) => {
                latest = value;
                model.value = value;
              },
            });
        },
      });
      const container = document.createElement('div');
      document.body.append(container);
      const app = createApp(root);
      app.mount(container);
      mountedApps.push({ app, container });
      await nextTick();

      const testButton = [...container.querySelectorAll('button')].find(
        (item) => item.textContent?.trim() === '测试代理',
      );
      expect(testButton).toBeDefined();
      testButton?.click();
      await vi.waitFor(() => {
        expect(testInterfaceProxyPool).toHaveBeenCalled();
        expect(container.textContent).toContain('8.8.8.8');
      });

      const [, testedConfig] = vi.mocked(testInterfaceProxyPool).mock.calls.at(-1) || [];
      expect(testedConfig).toMatchObject({ enabled: 0, source });
      expect(latest.enabled).toBe(0);
    },
  );
});
