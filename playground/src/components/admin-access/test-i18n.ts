import type { App } from 'vue';

import { i18n } from '@vben/locales';

// 组件用 $t / useI18n 渲染文案，单元测试直接 createApp 挂载时必须自己装上 i18n，
// 并把真实语言包灌进同一个实例，否则 $t 只会回显 key。
const zhModules = import.meta.glob('../../locales/langs/zh-CN/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, object>;

const zhMessages: Record<string, unknown> = {};
for (const [filePath, pack] of Object.entries(zhModules)) {
  const namespace = filePath.split('/').pop()?.replace('.json', '');
  if (namespace) {
    zhMessages[namespace] = pack;
  }
}

i18n.global.setLocaleMessage('zh-CN', zhMessages);
(i18n.global.locale as { value: string }).value = 'zh-CN';

export function installTestI18n(app: App) {
  app.use(i18n);
  return app;
}
