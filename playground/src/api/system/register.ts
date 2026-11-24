import { requestClient } from '#/api/request';

export namespace RegisterConfigApi {
  export interface OpenConfig {
    defaultRoleId: number | string;
    defaultRoleName: string;
    defaultRoleQps: number;
    defaultUserQps: number;
    registerEnabled: 0 | 1;
    registerGiftPoints: number;
    registerIpHourLimit: number;
    registerIpDayLimit: number;
    registerIpMaxAccounts: number;
    newAccountDayLimit: number;
    registerDeviceDayLimit: number;
    registerIpPrefixDayLimit: number;
    registerRiskEnabled: 0 | 1;
    registerRiskShadowMode: 0 | 1;
    registerRiskQuarantineScore: number;
    registerRiskRejectScore: number;
    oauthRegisterEnabled: 0 | 1;
    oauthRegisterModeDefault: 'auto' | 'confirm' | 'off';
    oauthRegisterIpHourLimit: number;
    oauthRegisterIpDayLimit: number;
    oauthRegisterIpMaxAccounts: number;
    oauthRequireVerifiedEmail: 0 | 1;
    verificationCodeIpDayLimit: number;
    verificationCodeIpHourLimit: number;
    verificationCodeIpMinuteLimit: number;
  }

  /** Registration email domain policy: bare lower-case domains. */
  export interface EmailDomainRules {
    blacklist: string[];
    whitelist: string[];
  }

  export interface EmailConfig {
    authCode: string;
    enabled: 0 | 1;
    senderEmail: string;
    senderName: string;
    smtpPort: number;
    smtpServer: string;
    smtpTLS: boolean;
    testEmail?: string;
  }

  export interface MobileConfig {
    accessKeyId: string;
    accessKeySecret: string;
    enabled: 0 | 1;
    endpoint: string;
    provider: 'aliyun';
    region: string;
    signName: string;
    templateId: string;
    testMobile?: string;
  }

  export interface QqLoginConfig {
    appId: string;
    appKey: string;
    enabled: 0 | 1;
    frontendBaseUrl: string;
    redirectUri: string;
    suggestedRedirectUri?: string;
  }
}

async function getRegisterOpenConfig() {
  return requestClient.get<RegisterConfigApi.OpenConfig>(
    '/system/register/open-config',
  );
}

async function updateRegisterOpenConfig(data: RegisterConfigApi.OpenConfig) {
  return requestClient.put('/system/register/open-config', data);
}

async function getEmailDomainRules() {
  return requestClient.get<RegisterConfigApi.EmailDomainRules>(
    '/system/register/email-domains',
  );
}

async function updateEmailDomainRules(
  data: RegisterConfigApi.EmailDomainRules,
) {
  return requestClient.put('/system/register/email-domains', data);
}

async function getRegisterEmailConfig() {
  return requestClient.get<RegisterConfigApi.EmailConfig>(
    '/system/register/email-config',
  );
}

async function updateRegisterEmailConfig(data: RegisterConfigApi.EmailConfig) {
  return requestClient.put('/system/register/email-config', data);
}

async function testRegisterEmailConfig(data: RegisterConfigApi.EmailConfig) {
  return requestClient.post('/system/register/email-config/test', data);
}

async function getRegisterMobileConfig() {
  return requestClient.get<RegisterConfigApi.MobileConfig>(
    '/system/register/mobile-config',
  );
}

async function updateRegisterMobileConfig(
  data: RegisterConfigApi.MobileConfig,
) {
  return requestClient.put('/system/register/mobile-config', data);
}

async function testRegisterMobileConfig(data: RegisterConfigApi.MobileConfig) {
  return requestClient.post('/system/register/mobile-config/test', data);
}

async function getQqLoginConfig() {
  return requestClient.get<RegisterConfigApi.QqLoginConfig>(
    '/system/login/qq-config',
  );
}

async function updateQqLoginConfig(data: RegisterConfigApi.QqLoginConfig) {
  return requestClient.put('/system/login/qq-config', data);
}

export {
  getEmailDomainRules,
  getQqLoginConfig,
  getRegisterEmailConfig,
  getRegisterMobileConfig,
  getRegisterOpenConfig,
  testRegisterEmailConfig,
  testRegisterMobileConfig,
  updateEmailDomainRules,
  updateQqLoginConfig,
  updateRegisterEmailConfig,
  updateRegisterMobileConfig,
  updateRegisterOpenConfig,
};
