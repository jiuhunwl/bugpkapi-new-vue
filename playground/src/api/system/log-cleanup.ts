import { requestClient } from '#/api/request';

export namespace UserLogCleanupApi {
  export interface AdminCleanupResult {
    batchLimit: number;
    deleted: number;
    hasMore: boolean;
  }

  export interface BackendConfig {
    autoHideEnabled?: 0 | 1;
    lastCleanupAt?: string;
    retentionDays: number;
  }

  export interface Config {
    enabled: 0 | 1;
    lastRunTime?: null | string;
    retentionDays: number;
  }
}

async function getUserLogCleanupConfig() {
  const config = await requestClient.get<UserLogCleanupApi.BackendConfig>(
    '/user/call-log-cleanup-config',
  );
  return {
    enabled: (config.autoHideEnabled ?? 0) === 1 ? 1 : 0,
    lastRunTime: config.lastCleanupAt ?? '',
    retentionDays: Number(config.retentionDays ?? 90),
  } satisfies UserLogCleanupApi.Config;
}

async function updateUserLogCleanupConfig(data: UserLogCleanupApi.Config) {
  return requestClient.put('/user/call-log-cleanup-config', {
    autoHideEnabled: data.enabled,
    retentionDays: data.retentionDays,
  });
}

async function cleanupCallLogs(before: string) {
  const result = await requestClient.delete<UserLogCleanupApi.AdminCleanupResult>(
    '/interface/call-log/cleanup',
    { params: { before } },
  );
  return {
    batchLimit: Number(result.batchLimit ?? 0),
    deleted: Number(result.deleted ?? 0),
    hasMore: result.hasMore === true,
  } satisfies UserLogCleanupApi.AdminCleanupResult;
}

export {
  cleanupCallLogs,
  getUserLogCleanupConfig,
  updateUserLogCleanupConfig,
};
