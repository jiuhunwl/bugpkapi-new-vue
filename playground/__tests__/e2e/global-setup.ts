import { chromium } from '@playwright/test';

/**
 * Vite dev 冷启动窗口期内，路由懒加载组件的动态 import 偶发永挂
 * （页面停在启动 splash，#app 未挂载；生产构建不存在该问题）。
 * globalSetup 用真实浏览器逐页预热——等待每页完成挂载——确保
 * 模块图与依赖预构建全部就绪后再开始执行测试。
 */
const warmupPaths = ['/', '/terms-of-service', '/apilist', '/links', '/donate', '/auth/login'];

async function waitForServer(baseURL: string) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${baseURL}/`);
      if (response.ok) return;
    } catch {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`dev server not ready at ${baseURL}`);
}

export default async function globalSetup() {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ||
    `http://${process.env.PLAYWRIGHT_HOST || '127.0.0.1'}:${
      process.env.PLAYWRIGHT_PORT || process.env.VITE_PORT || 5555
    }`;
  await waitForServer(baseURL);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const path of warmupPaths) {
      await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
      await page
        .waitForFunction(
          () => Boolean((document.querySelector('#app') as any)?.__vue_app__),
          { timeout: 30_000 },
        )
        .catch(() => {
          // 预热失败不阻塞测试：单个页面挂起时由测试自身的重试兜底
        });
    }
    await page.close();
  } finally {
    await browser.close();
  }
}
