import { requestClient } from '#/api/request';

export namespace HomeNoticeConfigApi {
  export interface Config {
    content: string;
    enabled: 0 | 1;
    /** 滚动文案承载在它所属的公告行上，回滚定位用。 */
    noticeId?: string;
    updateTime?: null | string;
  }
}

async function getHomeNoticeConfig() {
  return requestClient.get<HomeNoticeConfigApi.Config>(
    '/notice/admin/home-config',
  );
}

async function updateHomeNoticeConfig(data: HomeNoticeConfigApi.Config) {
  return requestClient.put('/notice/admin/home-config', data);
}

export { getHomeNoticeConfig, updateHomeNoticeConfig };
