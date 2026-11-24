import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace FriendLinkApi {
  export type LinkStatus = 0 | 1;
  export type ApplicationStatus =
    | 'APPROVED'
    | 'PENDING'
    | 'REJECTED'
    | 'WITHDRAWN';
  export type ChangeKind = 'EDIT' | 'NEW' | 'REMOVE';
  export type Language = 'en' | 'zh';

  export interface FriendLinkItem {
    applicantEmail?: string;
    applicantName?: string;
    createTime?: string;
    description?: string;
    id: string;
    language?: Language;
    logoUrl?: string;
    normalizedSiteUrl?: string;
    siteName: string;
    siteUrl: string;
    sortNo?: number;
    status: LinkStatus;
    updateTime?: string;
    userId?: string;
  }

  export interface FriendLinkApplication {
    backlinkUrl?: string;
    changeKind?: ChangeKind;
    contactEmail: string;
    contactName: string;
    contactQq?: string;
    createTime?: string;
    description?: string;
    id: string;
    language: Language;
    linkId?: string;
    logoUrl?: string;
    normalizedSiteUrl?: string;
    rejectReason?: string;
    reasonTemplate?: string;
    reviewerName?: string;
    sendEmail: boolean;
    reviewTime?: string;
    siteName: string;
    siteUrl: string;
    status: ApplicationStatus;
    updateTime?: string;
    userId?: string;
    username?: string;
  }

  export interface FriendLinkConfig {
    applyEnabled: 0 | 1;
    applyNotice?: string;
    id?: string;
    updateTime?: string;
  }

  export interface SiteInfo {
    contactEmail?: string;
    description?: string;
    logoUrl?: string;
    siteName: string;
    siteUrl?: string;
  }

  export interface PublicMeta {
    config: FriendLinkConfig;
    siteInfo: SiteInfo;
  }

  export interface ApplyStatus {
    createTime?: string;
    status?: ApplicationStatus;
    submitted: boolean;
  }

  export interface LinkListParams extends Recordable<any> {
    keyword?: string;
    page?: number;
    pageSize?: number;
    status?: LinkStatus;
  }

  export interface ApplicationListParams extends Recordable<any> {
    keyword?: string;
    page?: number;
    pageSize?: number;
    status?: ApplicationStatus;
  }

  export interface SaveLinkPayload {
    description?: string;
    logoUrl?: string;
    siteName: string;
    siteUrl: string;
    sortNo?: number;
    status: LinkStatus;
  }

  export interface ApplyPayload {
    backlinkUrl?: string;
    captchaId: string;
    contactEmail: string;
    contactName?: string;
    contactQq?: string;
    description?: string;
    language: Language;
    logoUrl?: string;
    siteName: string;
    siteUrl: string;
  }

  export interface ReviewPayload {
    reason?: string;
    reasonTemplate?: string;
    sendEmail: boolean;
  }

  /** 自助面板：自己已上线的友链 + 自己发起过的变更请求。 */
  export interface MyFriendLinks {
    applyEnabled: boolean;
    links: FriendLinkItem[];
    requests: FriendLinkApplication[];
  }

  /** 用户对自己友链提出的修改内容，审核通过后才落到线上列表。 */
  export interface LinkChangePayload {
    backlinkUrl?: string;
    description?: string;
    logoUrl?: string;
    siteName: string;
    siteUrl: string;
  }
}

async function getPublicFriendLinks() {
  const result = await requestClient.get<{
    items: FriendLinkApi.FriendLinkItem[];
    total: number;
  }>('/friend-links/public/list');
  return result.items ?? [];
}

async function getPublicFriendLinkMeta() {
  return requestClient.get<FriendLinkApi.PublicMeta>(
    '/friend-links/public/meta',
  );
}

async function applyFriendLink(data: FriendLinkApi.ApplyPayload) {
  return requestClient.post('/friend-links/apply', data);
}

async function getFriendLinkApplyStatus() {
  return requestClient.get<FriendLinkApi.ApplyStatus>(
    '/friend-links/apply/status',
  );
}

async function getAdminFriendLinkList(params: FriendLinkApi.LinkListParams) {
  return requestClient.get<{
    items: FriendLinkApi.FriendLinkItem[];
    total: number;
  }>('/friend-links/admin/list', { params });
}

async function getAdminFriendLinkDetail(id: string) {
  return requestClient.get<FriendLinkApi.FriendLinkItem>(
    `/friend-links/admin/${id}`,
  );
}

async function createFriendLink(data: FriendLinkApi.SaveLinkPayload) {
  return requestClient.post('/friend-links/admin', data);
}

async function updateFriendLink(
  id: string,
  data: FriendLinkApi.SaveLinkPayload,
) {
  return requestClient.put(`/friend-links/admin/${id}`, data);
}

async function deleteFriendLink(id: string, data: FriendLinkApi.ReviewPayload) {
  return requestClient.delete(`/friend-links/admin/${id}`, { data });
}

async function updateFriendLinkStatus(
  id: string,
  status: FriendLinkApi.LinkStatus,
) {
  return requestClient.put(`/friend-links/admin/${id}/status`, { status });
}

async function getAdminFriendLinkApplications(
  params: FriendLinkApi.ApplicationListParams,
) {
  return requestClient.get<{
    items: FriendLinkApi.FriendLinkApplication[];
    total: number;
  }>('/friend-links/admin/applications', { params });
}

async function approveFriendLinkApplication(
  id: string,
  data: FriendLinkApi.ReviewPayload,
) {
  return requestClient.put(
    `/friend-links/admin/applications/${id}/approve`,
    data,
  );
}

async function rejectFriendLinkApplication(
  id: string,
  data: FriendLinkApi.ReviewPayload,
) {
  return requestClient.put(
    `/friend-links/admin/applications/${id}/reject`,
    data,
  );
}

async function getAdminFriendLinkConfig() {
  return requestClient.get<FriendLinkApi.FriendLinkConfig>(
    '/friend-links/admin/config',
  );
}

async function getMyFriendLinks() {
  return requestClient.get<FriendLinkApi.MyFriendLinks>('/friend-links/self/list');
}

async function submitFriendLinkChange(
  id: string,
  data: FriendLinkApi.LinkChangePayload,
) {
  return requestClient.put(`/friend-links/self/links/${id}`, data);
}

async function submitFriendLinkRemoval(id: string) {
  return requestClient.delete(`/friend-links/self/links/${id}`);
}

async function withdrawFriendLinkRequest(id: string) {
  return requestClient.delete(`/friend-links/self/requests/${id}`);
}

async function updateAdminFriendLinkConfig(
  data: Pick<FriendLinkApi.FriendLinkConfig, 'applyEnabled' | 'applyNotice'>,
) {
  return requestClient.put('/friend-links/admin/config', data);
}

export {
  applyFriendLink,
  approveFriendLinkApplication,
  createFriendLink,
  deleteFriendLink,
  getAdminFriendLinkApplications,
  getAdminFriendLinkConfig,
  getAdminFriendLinkDetail,
  getAdminFriendLinkList,
  getFriendLinkApplyStatus,
  getMyFriendLinks,
  getPublicFriendLinkMeta,
  getPublicFriendLinks,
  rejectFriendLinkApplication,
  submitFriendLinkChange,
  submitFriendLinkRemoval,
  updateAdminFriendLinkConfig,
  updateFriendLink,
  updateFriendLinkStatus,
  withdrawFriendLinkRequest,
};
