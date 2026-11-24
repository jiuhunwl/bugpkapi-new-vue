import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace NoticeApi {
  export interface NoticeItem {
    contentHtml?: string;
    createTime?: string;
    creatorName?: string;
    expireTime?: string;
    id: string;
    isHomeTicker?: 0 | 1;
    isPopup?: 0 | 1;
    isTop: 0 | 1;
    publishTime?: string;
    status?: 0 | 1;
    summary?: string;
    title: string;
    updateTime?: string;
  }

  export interface NoticeListParams extends Recordable<any> {
    isHomeTicker?: 0 | 1;
    isPopup?: 0 | 1;
    isTop?: 0 | 1;
    keyword?: string;
    page?: number;
    pageSize?: number;
    status?: 0 | 1;
  }

  export interface SaveNoticePayload {
    contentHtml: string;
    expireTime?: string;
    isHomeTicker?: 0 | 1;
    isPopup: 0 | 1;
    isTop: 0 | 1;
    status: 0 | 1;
    title: string;
  }

  export interface NoticePageResult {
    items: NoticeItem[];
    total: number;
  }

  /**
   * 弹窗公告一次只投递前若干条，total 是后端统计的全部投放条数。
   */
  export interface PopupNoticeResult {
    items: NoticeItem[];
    total: number;
  }
}

type NoticePageBackendResult = Partial<NoticeApi.NoticePageResult> & {
  list?: NoticeApi.NoticeItem[];
  records?: NoticeApi.NoticeItem[];
};

function normalizeNoticePageResult(
  result?: NoticePageBackendResult,
): NoticeApi.NoticePageResult {
  const items = result?.items ?? result?.list ?? result?.records ?? [];
  const total = Number(result?.total ?? items.length);
  return {
    items,
    total: Number.isFinite(total) ? total : items.length,
  };
}

async function getAdminNoticeList(params: NoticeApi.NoticeListParams) {
  const result = await requestClient.get<NoticePageBackendResult>(
    '/notice/admin/list',
    { params },
  );
  return normalizeNoticePageResult(result);
}

async function getAdminNoticeDetail(id: string) {
  return requestClient.get<NoticeApi.NoticeItem>(`/notice/admin/${id}`);
}

async function createNotice(data: NoticeApi.SaveNoticePayload) {
  return requestClient.post('/notice/admin', data);
}

async function updateNotice(id: string, data: NoticeApi.SaveNoticePayload) {
  return requestClient.put(`/notice/admin/${id}`, data);
}

async function deleteNotice(id: string) {
  return requestClient.delete(`/notice/admin/${id}`);
}

async function updateNoticeStatus(id: string, status: 0 | 1) {
  return requestClient.put(`/notice/admin/${id}/status`, { status });
}

async function updateNoticeTop(id: string, isTop: 0 | 1) {
  return requestClient.put(`/notice/admin/${id}/top`, { isTop });
}

async function updateNoticePopup(id: string, isPopup: 0 | 1) {
  return requestClient.put(`/notice/admin/${id}/popup`, { isPopup });
}

async function getUserNoticeList(params: NoticeApi.NoticeListParams) {
  const result = await requestClient.get<NoticePageBackendResult>(
    '/notice/user/list',
    { params },
  );
  return normalizeNoticePageResult(result);
}

async function getUserNoticeDetail(id: string) {
  return requestClient.get<NoticeApi.NoticeItem>(`/notice/user/${id}`);
}

async function getUserPopupNotices() {
  const result = await requestClient.get<Partial<NoticeApi.PopupNoticeResult>>(
    '/notice/user/popup',
  );
  const items = result?.items ?? [];
  return {
    items,
    total: Number(result?.total ?? items.length),
  } satisfies NoticeApi.PopupNoticeResult;
}

async function uploadNoticeImage(file: File) {
  const data = await requestClient.upload<{ url: string }>(
    '/upload/notice-image',
    { file },
  );
  return data.url;
}

export {
  createNotice,
  deleteNotice,
  getAdminNoticeDetail,
  getAdminNoticeList,
  getUserNoticeDetail,
  getUserNoticeList,
  getUserPopupNotices,
  updateNotice,
  updateNoticePopup,
  updateNoticeStatus,
  updateNoticeTop,
  uploadNoticeImage,
};
