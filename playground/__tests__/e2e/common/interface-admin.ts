import type { Page } from '@playwright/test';

import type { InterfaceApi } from '../../../src/api/interface';

import { authLogin } from './auth';
import { waitForAppVisible } from './network';

export async function mockInterfaceAdmin(page: Page) {
  const item: InterfaceApi.InterfaceItem = {
    apiCode: 'domain_pool_test', id: '801', isFeatured: 0, isTop: 0,
    name: '域名子池测试接口', remark: '接口编辑契约测试', pointPrice: 0, price: 0, qpsLimit: 0,
    requestMethod: 'GET', requestUrl: 'https://primary.example/api', status: 1,
    pollingEnabled: 1, pollingMode: 'PRIMARY', pollingCheckEnabled: 1,
    pollingCheckField: 'meta.code', pollingCheckExpected: '0', pollingStopCode: '40401',
    responseCleaningEnabled: 1,
    upstreamUrls: ['https://backup.example/api'],
    upstreamConfigs: [{
      url: 'https://backup.example/api', pollingCheckEnabled: 1,
      pollingCheckField: 'result.code', pollingCheckExpected: 'ok',
      responseFieldMappings: [{ source: 'payload', target: 'data' }],
    }],
  };
  const state = {
    item,
    polling: { ...item } as Partial<InterfaceApi.PollingConfig>,
    pollingSaves: [] as InterfaceApi.SavePollingConfig[],
    interfaceSaves: [] as InterfaceApi.SaveInterface[],
    failNextPollingSave: false,
    failNextPollingLoad: false,
  };
  await page.route('**/system-api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    let data: unknown = true;
    if (pathname === '/system-api/auth/refresh') {
      await route.fulfill({ status: 401, json: { code: -1, data: null, error: '未登录', message: '未登录' } });
      return;
    }
    if (pathname === '/system-api/site/config') {
      data = { logoUrl: '', siteName: 'BugPk-Api' };
    } else if (pathname === '/system-api/auth/captcha') {
      data = { captchaId: 'interface-admin-captcha', challenge: 'abcdef0123456789', difficulty: 1, provider: 'pow', scene: 'login' };
    } else if (pathname === '/system-api/auth/login') {
      data = { accessToken: 'interface-admin-test-token' };
    } else if (pathname === '/system-api/user/info') {
      data = { avatar: '', desc: '', homePath: '/console/interface/list', realName: 'Interface Admin', roles: ['admin'], userId: '1', username: 'admin' };
    } else if (pathname === '/system-api/auth/codes') {
      data = ['interface:list', 'interface:update', 'interface:polling', 'interface:delivery-policy'];
    } else if (pathname === '/system-api/menu/all') {
      data = [{ component: '/interface/list', id: '801', meta: { title: '接口管理', icon: 'lucide:network' }, name: 'InterfaceAdmin', path: '/console/interface/list', pid: '0', status: 1, type: 'menu' }];
    } else if (pathname === '/system-api/interface/list') {
      data = { items: [state.item], total: 1 };
    } else if (pathname === '/system-api/interface/801/polling') {
      if (request.method() === 'PUT') {
        if (state.failNextPollingSave) {
          state.failNextPollingSave = false;
          await route.fulfill({ status: 400, json: { code: 400, data: null, error: '默认域名子轮询路由必须存在且启用', message: '默认域名子轮询路由必须存在且启用' } });
          return;
        }
        const payload = request.postDataJSON() as InterfaceApi.SavePollingConfig;
        state.pollingSaves.push(payload);
        state.polling = { ...state.polling, ...payload };
        Object.assign(state.item, payload);
      } else {
        if (state.failNextPollingLoad) {
          state.failNextPollingLoad = false;
          await route.fulfill({ status: 500, json: { code: 500, data: null, error: '轮询配置加载失败', message: '轮询配置加载失败' } });
          return;
        }
        data = state.polling;
      }
    } else if (pathname === '/system-api/interface/801' && request.method() === 'PUT') {
      const payload = request.postDataJSON() as InterfaceApi.SaveInterface;
      state.interfaceSaves.push(payload);
      state.polling = { ...state.polling, ...payload };
      Object.assign(state.item, payload);
    } else if (pathname === '/system-api/notice/user/list') {
      data = { items: [], total: 0 };
    } else if (pathname === '/system-api/notice/user/popup') {
      data = [];
    } else if (pathname === '/system-api/auth/register/config') {
      data = {};
    }
    await route.fulfill({ json: { code: 0, data, error: null, message: 'ok' } });
  });
  return state;
}

export async function loginInterfaceAdmin(page: Page) {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await waitForAppVisible(page);
  // Compile this large lazy console view before measuring authentication's
  // redirect; no production login timing is changed by this test-only warmup.
  let optimizedDependencyChanged = false;
  const onResponse = (response: import('@playwright/test').Response) => {
    if (response.status() === 504 && response.url().includes('/node_modules/.vite/deps/')) {
      optimizedDependencyChanged = true;
    }
  };
  page.on('response', onResponse);
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await page.evaluate(async () => {
          const modulePath = '/src/views/interface/list.vue';
          await import(modulePath);
        });
        break;
      } catch (error) {
        // Vite's first discovery can replace a dependency hash mid-load (504
        // Outdated Optimize Dep). Reload once; never retry real import errors.
        if (!optimizedDependencyChanged || attempt > 0) throw error;
        optimizedDependencyChanged = false;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForAppVisible(page);
      }
    }
  } finally {
    page.off('response', onResponse);
  }
  await authLogin(page, '/console/interface/list');
}
