import { requestClient } from '#/api/request';

export namespace CustomCodeApi {
  export interface Config {
    cssCode: string;
    enabled: 0 | 1;
    jsCode: string;
    updateTime?: string;
  }
}

async function getCustomCodeConfig() {
  return requestClient.get<CustomCodeApi.Config>('/system/custom-code');
}

async function updateCustomCodeConfig(data: CustomCodeApi.Config) {
  return requestClient.put('/system/custom-code', data);
}

export { getCustomCodeConfig, updateCustomCodeConfig };
