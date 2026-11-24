import { baseRequestClient, requestClient } from '#/api/request';

export namespace OAuthApi {
  export type OAuthMode = 'bind' | 'login';

  export interface Provider {
    displayName: string;
    driver: string;
    iconKey: string;
    providerKey: string;
    registerMode: 'auto' | 'confirm' | 'inherit' | 'off';
  }

  export interface AuthorizeParams {
    mode?: OAuthMode;
    returnPath?: string;
  }

  export interface AuthorizeResult {
    url: string;
  }

  export interface LoginResult {
    accessToken: string;
    redirect?: string;
  }

  export interface CompleteInfo {
    avatar?: string;
    displayName: string;
    email?: string;
    emailVerified: boolean;
    iconKey: string;
    nickname?: string;
    provider: string;
    requiresVerifiedEmail: boolean;
    suggestedUsername: string;
  }

  export interface CompleteParams {
    confirmPassword: string;
    email?: string;
    emailCode?: string;
    password: string;
    ticket: string;
    username: string;
    website?: string;
  }

  export interface BindingProvider {
    avatar?: string;
    bound: boolean;
    boundAt?: string;
    displayName: string;
    enabled: boolean;
    iconKey: string;
    lastLoginAt?: string;
    nickname?: string;
    providerKey: string;
  }

  export interface Bindings {
    hasPassword: boolean;
    providers: BindingProvider[];
  }

  export interface UnbindParams {
    emailCode?: string;
    password?: string;
  }

  export interface AdminGlobalConfig {
    frontendBaseUrl: string;
  }

  export interface AdminProvider {
    authorizationEndpoint: string;
    callbackPath: string;
    clientId: string;
    clientSecretMasked: string;
    defaultRoleId: string;
    displayName: string;
    driver: string;
    enabled: boolean;
    extraConfig: string;
    hasClientSecret: boolean;
    iconKey: string;
    issuer: string;
    jwksUri: string;
    linkByEmail: boolean;
    minAccountAgeDays: number;
    minTrustLevel: number;
    providerGroup: string;
    providerKey: string;
    redirectUri: string;
    registerGiftPoints: number;
    registerIpHourLimit: number;
    registerIpDayLimit: number;
    registerIpMaxAccounts: number;
    registerMode: 'auto' | 'confirm' | 'inherit' | 'off';
    requireActive: boolean;
    requireVerifiedEmail: boolean;
    requireVerifiedEmailMode: number;
    rejectSilenced: boolean;
    scopes: string;
    sortNo: number;
    tokenEndpoint: string;
    userinfoEndpoint: string;
  }

  export interface AdminConfig {
    global: AdminGlobalConfig;
    providers: AdminProvider[];
  }

  export interface ProviderSaveParams {
    authorizationEndpoint?: string;
    clearClientSecret?: boolean;
    clientId?: string;
    clientSecret?: string;
    defaultRoleId?: string;
    displayName: string;
    driver: string;
    enabled: boolean;
    extraConfig?: string;
    iconKey: string;
    issuer?: string;
    jwksUri?: string;
    linkByEmail?: boolean;
    minAccountAgeDays?: number;
    minTrustLevel?: number;
    providerGroup?: string;
    providerKey?: string;
    redirectUri: string;
    registerGiftPoints?: number;
    registerIpHourLimit?: number;
    registerIpDayLimit?: number;
    registerIpMaxAccounts?: number;
    registerMode: 'auto' | 'confirm' | 'inherit' | 'off';
    requireActive?: boolean;
    requireVerifiedEmail?: boolean;
    requireVerifiedEmailMode?: number;
    rejectSilenced?: boolean;
    scopes?: string;
    sortNo?: number;
    tokenEndpoint?: string;
    userinfoEndpoint?: string;
  }

  export interface ProviderTestResult {
    authorizeUrl: string;
  }
}

export function getOAuthProvidersApi() {
  return requestClient.get<OAuthApi.Provider[]>('/auth/oauth/providers');
}

export function authorizeOAuthApi(
  provider: string,
  params: OAuthApi.AuthorizeParams = {},
) {
  return requestClient.post<OAuthApi.AuthorizeResult>(
    `/auth/oauth/${encodeURIComponent(provider)}/authorize`,
    { mode: 'login', ...params },
    { withCredentials: true },
  );
}

function unwrapEnvelope<T>(response: any): T {
  const body = response?.data;
  if (body && typeof body === 'object' && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}

export async function exchangeOAuthTicketApi(ticket: string) {
  const response = await baseRequestClient.post(
    '/auth/oauth/exchange',
    { ticket },
    { withCredentials: true },
  );
  return unwrapEnvelope<OAuthApi.LoginResult>(response);
}

export async function getOAuthCompleteInfoApi(ticket: string) {
  const response = await baseRequestClient.get('/auth/oauth/complete', {
    params: { ticket },
    withCredentials: true,
  });
  return unwrapEnvelope<OAuthApi.CompleteInfo>(response);
}

export async function completeOAuthApi(params: OAuthApi.CompleteParams) {
  const response = await baseRequestClient.post(
    '/auth/oauth/complete',
    params,
    { withCredentials: true },
  );
  return unwrapEnvelope<OAuthApi.LoginResult>(response);
}

export function getOAuthBindingsApi() {
  return requestClient.get<OAuthApi.Bindings>('/user/oauth-bindings');
}

export function authorizeOAuthBindApi(provider: string) {
  return requestClient.post<OAuthApi.AuthorizeResult>(
    `/user/oauth-bindings/${encodeURIComponent(provider)}/authorize`,
    null,
    { withCredentials: true },
  );
}

export function unbindOAuthApi(
  provider: string,
  params: OAuthApi.UnbindParams,
) {
  return requestClient.post<boolean>(
    `/user/oauth-bindings/${encodeURIComponent(provider)}/unbind`,
    params,
  );
}

export function getOAuthAdminConfigApi() {
  return requestClient.get<OAuthApi.AdminConfig>('/system/login/oauth-config');
}

export function saveOAuthAdminGlobalApi(
  config: OAuthApi.AdminGlobalConfig,
) {
  return requestClient.put<OAuthApi.AdminGlobalConfig>(
    '/system/login/oauth-config',
    config,
  );
}

export function createOAuthProviderApi(
  params: OAuthApi.ProviderSaveParams,
) {
  return requestClient.post<OAuthApi.AdminProvider>(
    '/system/login/oauth-config/providers',
    params,
  );
}

export function updateOAuthProviderApi(
  provider: string,
  params: OAuthApi.ProviderSaveParams,
) {
  return requestClient.put<OAuthApi.AdminProvider>(
    `/system/login/oauth-config/providers/${encodeURIComponent(provider)}`,
    params,
  );
}

export function testOAuthProviderApi(provider: string) {
  return requestClient.post<OAuthApi.ProviderTestResult>(
    `/system/login/oauth-config/providers/${encodeURIComponent(provider)}/test`,
    null,
  );
}
