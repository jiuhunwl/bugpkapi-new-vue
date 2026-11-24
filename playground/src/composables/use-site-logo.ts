import { shallowRef } from 'vue';

import { getPublicSiteConfig } from '#/api/system/site';

/** 站点商户 Logo（支付二维码中心与支付成功态展示）；公共配置，进程内只取一次。 */
const logoUrl = shallowRef('');
let requested = false;
const logoFailed = shallowRef(false);

export function useSiteLogo() {
  if (!requested) {
    requested = true;
    getPublicSiteConfig()
      .then((config) => {
        logoUrl.value = String(config?.logoUrl ?? '').trim();
        if (!logoUrl.value) {
          logoFailed.value = true;
        }
      })
      .catch(() => {
        // 拿不到 Logo 时二维码/成功态退化为无图标，不阻塞支付流程
        logoFailed.value = true;
      });
  }
  return { logoFailed, logoUrl };
}
