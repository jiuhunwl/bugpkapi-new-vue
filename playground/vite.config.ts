import type { Plugin } from 'vite';

import process from 'node:process';
import { resolve } from 'node:path';

import { resolveReleaseVersion } from './scripts/release-version.mjs';
import { defineConfig } from '@vben/vite-config';

function playwrightShutdownPlugin(): Plugin {
  const shutdownToken = process.env.PLAYWRIGHT_SHUTDOWN_TOKEN?.trim();
  const disabled =
    process.env.PLAYWRIGHT_INTERNAL_SERVER !== '1' || !shutdownToken;

  return {
    configureServer(server) {
      if (disabled) {
        return;
      }
      server.middlewares.use(
        '/__playwright_shutdown__',
        (request, response) => {
          if (request.method !== 'POST') {
            response.statusCode = 405;
            response.end();
            return;
          }
          const remoteAddress = (request.socket.remoteAddress || '').replace(
            /^::ffff:/,
            '',
          );
          const requestToken = request.headers['x-playwright-shutdown-token'];
          if (
            (remoteAddress !== '::1' && !remoteAddress.startsWith('127.')) ||
            requestToken !== shutdownToken
          ) {
            response.statusCode = 403;
            response.end();
            return;
          }
          response.statusCode = 204;
          response.end();
          setTimeout(() => {
            void server.close().finally(() => process.exit(0));
          }, 0);
        },
      );
    },
    name: 'bugpk-playwright-shutdown',
  };
}

export default defineConfig(async (config) => {
  if (config?.command === 'build') {
    // 在共享 Vite 配置 loadEnv 之前设置，统一 About、metadata 和缓存 namespace。
    process.env.VITE_APP_VERSION = resolveReleaseVersion({
      command: 'build',
      env: process.env,
    });
  }

  // 开发代理后端（可用 VITE_PROXY_TARGET / VITE_BACKEND_URL 环境变量覆盖）
  // 默认指向本机后端；如需连接共享的联调后端，启动时显式指定：
  //   VITE_PROXY_TARGET=http://<host>:8080 pnpm dev:play
  const backendTarget =
    process.env.VITE_PROXY_TARGET ||
    process.env.VITE_BACKEND_URL ||
    'http://127.0.0.1:8080';
  const testShutdownPlugin = playwrightShutdownPlugin();
  const outputDirectory = process.env.BUGPK_FRONTEND_OUT_DIR?.trim();

  return {
    application: {},
    vite: {
      build: outputDirectory
        ? {
            outDir: resolve(process.cwd(), outputDirectory),
          }
        : undefined,
      plugins: [testShutdownPlugin],
      server: {
        proxy: {
          '^/system-api(?:/|$)': {
            changeOrigin: true,
            target: backendTarget,
            ws: true,
          },
          '^/api(?:/|$)': {
            changeOrigin: true,
            target: backendTarget,
            ws: true,
          },
        },
      },
    },
  };
});
