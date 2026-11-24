import { createApp, defineComponent, h, nextTick, type App } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { InterfaceApi } from '#/api/interface';

import InterfaceResponsiveList from './InterfaceResponsiveList.vue';

vi.mock('../data', () => ({
  pollingModeText: () => '轮询',
  requestMethodOptions: [],
}));
vi.mock('#/locales', () => ({
  $t: (key: string) =>
    ({
      'common.disabled': '禁用',
      'system.interface.callUnit': '次',
      'system.interface.featuredAction': '精选',
      'system.interface.free': '本地化免费',
      'system.interface.isFeatured': '精选',
      'system.interface.keyword': '关键词',
      'system.interface.keywordPlaceholder': '搜索',
      'system.interface.listTitle': '接口列表',
      'system.interface.operation': '操作',
      'system.interface.pointPrice': '积分价格',
      'system.interface.price': '价格',
      'system.interface.qpsLimit': 'QPS',
      'system.interface.qpsUnlimited': '不限',
      'system.interface.requestMethod': '请求方法',
      'system.interface.requestUrl': '请求地址',
      'system.interface.reset': '重置',
      'system.interface.search': '搜索',
      'system.interface.status': '状态',
      'system.interface.statusNormal': '正常',
      'ui.placeholder.select': '请选择',
    })[key] || key,
}));
vi.mock('@vben/icons', () => ({
  IconifyIcon: defineComponent({
    name: 'IconifyIcon',
    setup() {
      return () => h('i');
    },
  }),
  Plus: defineComponent({
    name: 'Plus',
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

  return {
    Button: passthrough('Button'),
    Dropdown: passthrough('Dropdown'),
    Empty: passthrough('Empty'),
    Input: passthrough('Input'),
    Menu: passthrough('Menu'),
    MenuItem: passthrough('MenuItem'),
    Pagination: passthrough('Pagination'),
    Select: passthrough('Select'),
    Spin: passthrough('Spin'),
    Tag: passthrough('Tag'),
  };
});

const mountedApps: Array<{ app: App; container: HTMLDivElement }> = [];

afterEach(() => {
  for (const { app, container } of mountedApps.splice(0)) {
    app.unmount();
    container.remove();
  }
});

function createItem(
  prices: Pick<InterfaceApi.InterfaceItem, 'pointPrice' | 'price'>,
): InterfaceApi.InterfaceItem {
  return {
    apiCode: 'demo',
    id: '1',
    isFeatured: 0,
    isTop: 0,
    name: 'Demo',
    pointPrice: prices.pointPrice,
    price: prices.price,
    requestMethod: 'GET',
    requestUrl: 'https://example.com',
    status: 1,
  };
}

function mountList(item: InterfaceApi.InterfaceItem) {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(InterfaceResponsiveList, {
    canCreate: false,
    items: [item],
    loading: false,
    page: 1,
    pageSize: 10,
    permissions: {
      billing: false,
      delete: false,
      deliveryPolicy: false,
      doc: false,
      polling: false,
      requestValidation: false,
      update: false,
    },
    total: 1,
  });
  app.mount(container);
  mountedApps.push({ app, container });
  return container;
}

describe('InterfaceResponsiveList pricing', () => {
  it('shows free when both money and point prices are zero', async () => {
    const container = mountList(createItem({ pointPrice: 0, price: 0 }));
    await nextTick();

    const facts = container.querySelectorAll(
      '.responsive-interface-item__facts > div',
    );
    expect(facts[1]?.textContent).toContain('本地化免费');
  });

  it('keeps the existing formats for paid prices', async () => {
    const container = mountList(
      createItem({ pointPrice: 12_345, price: 1.25 }),
    );
    await nextTick();

    const facts = container.querySelectorAll(
      '.responsive-interface-item__facts > div',
    );
    expect(facts[1]?.textContent).toContain('¥1.25');
    expect(facts[2]?.textContent).toContain((12_345).toLocaleString());
  });
});
