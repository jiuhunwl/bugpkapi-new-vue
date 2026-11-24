import { requestClient } from '#/api/request';

export namespace IpConfigApi {
  export interface Config {
    dataSourceName: string;
    apiUrl: string;
    parseRule: string;
    enabled: number;
    remark?: string;
    updatedAt?: string;
  }

  export interface GeoIPResult {
    city: string;
    country: string;
    ip: string;
    isp?: string;
    latitude?: number;
    longitude?: number;
    provider?: string;
    province: string;
    region?: string;
    resolved: boolean;
    status: 'invalid' | 'private' | 'resolved' | 'unavailable' | 'unknown';
  }

  export interface SourceFieldOption {
    path: string;
    valuePreview: string;
    valueType: 'boolean' | 'number' | 'string';
  }

  export interface SourcePreview {
    city: string;
    country: string;
    isp: string;
    latitude?: number;
    longitude?: number;
    province: string;
  }

  export interface TestSourceParams {
    apiUrl: string;
    fieldMappings: Record<string, string>;
    testIp: string;
  }

  export interface TestSourceResult {
    fields: SourceFieldOption[];
    invalidFields: string[];
    missingPairFields: string[];
    preview: SourcePreview;
  }
}

async function getIpSourceConfig() {
  return requestClient.get<IpConfigApi.Config>('/system/ip-config');
}

async function updateIpSourceConfig(data: IpConfigApi.Config) {
  return requestClient.put<boolean>('/system/ip-config', data);
}

async function getGeoIP() {
  return requestClient.get<IpConfigApi.GeoIPResult>('/geoip');
}

async function testIpSource(data: IpConfigApi.TestSourceParams) {
  return requestClient.post<IpConfigApi.TestSourceResult>(
    '/system/ip-config/test-source',
    data,
  );
}

export { getGeoIP, getIpSourceConfig, testIpSource, updateIpSourceConfig };
