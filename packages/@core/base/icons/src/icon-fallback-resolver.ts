/**
 * 图标兜底解析器
 *
 * 背景：项目禁用了 Iconify 运行时网络加载，未注册的图标名不会渲染任何内容。
 * 但图标名有很大一部分来自运行时数据（数据库菜单 icon、赞赏方式 icon、角色 meta.icon
 * 等），这些值只做了「格式合法」校验（见 donation/model.ts 的 iconPattern），并不保证
 * 已在本地注册。结果就是换个图标集前缀、或写了个 lucide 里的近义名，就静默变成空白。
 *
 * 这里在「已注册」与「空白」之间补一层语义解析：
 *   1. 跨图标集同名映射：mdi:account → lucide:user 之类，不同前缀同一语义直接换到已注册名；
 *   2. 词干归一：去掉 -outline/-fill/-solid 等风格后缀、去掉 mdi 常见的 -variant 尾巴；
 *   3. 关键词兜底：按名字里的语义关键词落到一个通用图标。
 *
 * 只有这三步全都命中不了，才返回 undefined —— 也就是真正「无从推断」的情况，此时不渲染图标。
 */

/** 风格后缀：不同图标集用来区分线性/面性的尾巴，与语义无关 */
const STYLE_SUFFIXES = [
  '-outline',
  '-outlined',
  '-filled',
  '-fill',
  '-solid',
  '-twotone',
  '-two-tone',
  '-round',
  '-rounded',
  '-sharp',
  '-duotone',
  '-bold',
  '-light',
  '-thin',
  '-regular',
  '-variant',
  '-alt',
  '-o',
];

/**
 * 跨图标集语义映射：key 为「去掉前缀与风格后缀后的词干」，value 为已注册的 lucide 名。
 * 只收录确实会出现在菜单/业务数据里的词，避免变成第二份图标表。
 */
const STEM_TO_LUCIDE: Record<string, string> = {
  account: 'user',
  'account-circle': 'user-round',
  'account-cog': 'user-cog',
  'account-group': 'users',
  'account-multiple': 'users',
  'account-plus': 'user-plus',
  'account-search': 'user-round-search',
  'account-supervisor': 'users',
  advertisement: 'megaphone',
  alert: 'triangle-alert',
  'alert-circle': 'circle-alert',
  'alert-octagon': 'triangle-alert',
  api: 'braces',
  apps: 'layout-grid',
  bank: 'landmark',
  bell: 'megaphone',
  book: 'file-text',
  'book-open': 'file-text',
  'book-open-text': 'file-text',
  bullhorn: 'megaphone',
  'button-cursor': 'hand',
  cash: 'circle-dollar-sign',
  'cash-multiple': 'coins',
  'cash-plus': 'circle-dollar-sign',
  cellphone: 'smartphone',
  'cellphone-cog': 'smartphone',
  'chart-bar': 'chart-area',
  'chart-line': 'chart-line',
  'chart-pie': 'chart-area',
  'clipboard-text': 'clipboard-list',
  'clipboard-text-clock': 'clipboard-list',
  'cloud-key': 'key-round',
  'code-braces': 'braces',
  'code-braces-box': 'code-2',
  'code-json': 'file-json-2',
  cog: 'settings',
  connection: 'network',
  container: 'boxes',
  'container-services': 'boxes',
  content: 'file-text',
  'credit-card': 'credit-card',
  'credit-card-settings': 'credit-card',
  dashboard: 'layout-dashboard',
  'data-center': 'database',
  database: 'database',
  'database-plus': 'database-zap',
  'delete-clock': 'trash-2',
  desktop: 'monitor-cog',
  document: 'file-text',
  'dots-horizontal': 'ellipsis',
  email: 'mail',
  'email-cog': 'mail',
  'file-document': 'file-text',
  finance: 'wallet',
  folder: 'archive',
  github: 'code-2',
  'hexagon-vertical-solid': 'box',
  home: 'house',
  information: 'info',
  'ip-network': 'network',
  key: 'key-round',
  'key-chain': 'key-round',
  'keyboard-esc': 'keyboard',
  lock: 'lock-keyhole',
  login: 'log-in',
  'login-variant': 'log-in',
  menu: 'menu',
  monitor: 'monitor-cog',
  'package-variant': 'package-open',
  'page-previous': 'chevron-left',
  'receipt-clock': 'receipt-text',
  'receipt-text-clock': 'receipt-text',
  security: 'shield-check',
  server: 'database',
  'shield-key': 'shield-check',
  shopping: 'shopping-bag',
  settings: 'settings',
  tools: 'settings-2',
  'view-dashboard': 'layout-dashboard',
  'view-grid': 'layout-grid',
  'view-list': 'list',
  wallet: 'wallet',
  web: 'globe-2',
  'web-sync': 'refresh-cw',
  workspace: 'layout-dashboard',
};

/**
 * 关键词兜底：词干映射没命中时，按名字里出现的语义关键词落到通用图标。
 * 顺序有意义 —— 越具体的词放前面，避免被泛化词吃掉。
 */
const KEYWORD_FALLBACKS: [RegExp, string][] = [
  [/dashboard|workspace|overview/, 'layout-dashboard'],
  [/user|account|member|people|person/, 'user'],
  [/role|permission|auth|priv/, 'shield-check'],
  [/key|token|secret|credential/, 'key-round'],
  [/shield|security|risk|protect|guard/, 'shield-check'],
  [/money|cash|coin|pay|price|fee|bill|invoice|order/, 'circle-dollar-sign'],
  [/wallet|balance|fund/, 'wallet'],
  [/chart|statistic|analytic|report|metric|trend/, 'chart-area'],
  [/mail|email|message|chat|comment|notice|notify/, 'message-square'],
  [/ticket|support|service|help/, 'headset'],
  [/database|storage|data|table|record/, 'database'],
  // api / code 要先于 network 判定：api-gateway-proxy 语义重心在 api
  [/api|code|json|script|develop/, 'braces'],
  [/network|ip|dns|route|gateway|proxy/, 'network'],
  [/file|doc|document|article|page|text/, 'file-text'],
  [/list|menu|catalog|category/, 'list'],
  [/setting|config|cog|option|prefer|tool/, 'settings'],
  [/time|clock|date|calendar|schedule|cron/, 'clock-3'],
  [/link|url|chain|connect/, 'link'],
  [/upload|import/, 'upload'],
  [/download|export/, 'download'],
  [/search|find|query|filter/, 'search'],
  [/delete|remove|trash|clean/, 'trash-2'],
  [/edit|write|pen|modify/, 'notebook-pen'],
  [/add|plus|create|new/, 'plus'],
  [/log|history|audit|activity|event/, 'history'],
  [/home|index|site|web|global|world/, 'globe-2'],
  [/shop|store|market|product|goods/, 'store'],
  [/box|package|module|component|plugin|app/, 'box'],
  [/image|photo|picture|avatar|media/, 'image'],
  [/phone|mobile|cellphone|sms/, 'smartphone'],
  [/warn|alert|error|fail|danger/, 'triangle-alert'],
  [/success|check|done|complete|pass/, 'circle-check'],
  [/info|about|detail|desc/, 'info'],
];

/** 去掉图标集前缀，返回裸名 */
function stripPrefix(icon: string) {
  const i = icon.indexOf(':');
  return i === -1 ? icon : icon.slice(i + 1);
}

/** 去掉风格后缀，得到语义词干 */
function toStem(bare: string) {
  let stem = bare;
  // 反复剥离，处理 account-circle-outline 这类叠加后缀
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of STYLE_SUFFIXES) {
      if (stem.length > suffix.length && stem.endsWith(suffix)) {
        stem = stem.slice(0, -suffix.length);
        changed = true;
      }
    }
  }
  return stem;
}

/**
 * 为未注册的图标名推断一个已注册的 lucide 名。
 *
 * @param icon 原始图标名，如 `mdi:account-cog-outline`
 * @param isRegistered 判断某个候选名是否已注册（由调用方注入，避免循环依赖）
 * @returns 可用的已注册图标名；无从推断时返回 undefined
 */
function resolveFallbackName(
  icon: string,
  isRegistered: (candidate: string) => boolean,
): string | undefined {
  if (!icon || !icon.includes(':')) {
    return undefined;
  }
  const bare = stripPrefix(icon).toLowerCase();
  if (!bare) {
    return undefined;
  }

  const candidates: string[] = [];
  const push = (name: string) => {
    const full = `lucide:${name}`;
    if (name && !candidates.includes(full)) {
      candidates.push(full);
    }
  };

  // 1. 同名直取：mdi:database → lucide:database
  push(bare);

  // 2. 词干归一后再试，并查语义映射表
  const stem = toStem(bare);
  if (stem !== bare) {
    push(stem);
  }
  const mappedBare = STEM_TO_LUCIDE[bare];
  if (mappedBare) {
    push(mappedBare);
  }
  const mappedStem = STEM_TO_LUCIDE[stem];
  if (mappedStem) {
    push(mappedStem);
  }

  for (const candidate of candidates) {
    if (isRegistered(candidate)) {
      return candidate;
    }
  }

  // 3. 关键词兜底
  for (const [pattern, name] of KEYWORD_FALLBACKS) {
    if (pattern.test(bare)) {
      const full = `lucide:${name}`;
      if (isRegistered(full)) {
        return full;
      }
    }
  }

  return undefined;
}

export { resolveFallbackName, STEM_TO_LUCIDE, toStem };
