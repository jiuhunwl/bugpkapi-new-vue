import { requestClient } from '#/api/request';

export namespace ImageHostConfigApi {
  export interface Config {
    authCode: string;
    baseUrl: string;
    enabled: number;
    folder: string;
    maxBytes: number;
    provider: string;
    uploadChannel: string;
    uploadPath: string;
  }

  export interface UploadResult {
    provider: string;
    url: string;
  }
}

export function getImageHostConfigApi(signal?: AbortSignal) {
  return requestClient.get<ImageHostConfigApi.Config>(
    '/system/image-host-config',
    { signal },
  );
}

export function saveImageHostConfigApi(data: ImageHostConfigApi.Config) {
  return requestClient.put<boolean>('/system/image-host-config', data);
}

export function testImageHostConfigApi(data: ImageHostConfigApi.Config) {
  return requestClient.post<ImageHostConfigApi.UploadResult>(
    '/system/image-host-config/test',
    data,
    { timeout: 30_000 },
  );
}
