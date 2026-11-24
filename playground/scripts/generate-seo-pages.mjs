/**
 * generate-seo-pages.mjs
 * 构建后为公开页面生成 SEO 友好的静态 HTML 快照。
 *
 * 背景：本项目是纯 SPA（Vue3 + vite），搜索引擎爬虫不执行 JS，
 * 直接抓 index.html 只能拿到空壳。本脚本在 vite build 后，
 * 基于构建产物 index.html，为每个公开页面生成一份独立的 HTML：
 *   - 复制 SPA 的完整结构（div#app + 打包后的 js/css 引用，功能不受影响）
 *   - 替换为每个页面自己的 <title>/<meta description>/<link canonical>
 *   - 注入页面级 JSON-LD（WebPage）
 * 输出到 dist 的对应路径（如 dist/apis/index.html），
 * 配合 Nginx try_files 回退，搜索引擎可读、浏览器访问仍走 SPA。
 *
 * 用法：vite build 之后执行（已并入 package.json 的 build 脚本）。
 * 注意：页面内容本身由接口动态加载，此方案保证「标题/描述/结构化数据」
 * 可被收录；完整 SSR 需引入 vite-ssg，工作量大且与当前复杂 monorepo 集成风险高。
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const playgroundRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = resolve(
  playgroundRoot,
  process.env.BUGPK_FRONTEND_OUT_DIR?.trim() || 'dist',
);
const indexHtmlPath = join(distDir, 'index.html');

// 站点基础地址（与 .env.production 的 VITE_APP_SITE_URL 保持一致，部署时修改）
const SITE_URL = (
  process.env.VITE_APP_SITE_URL || 'https://api.example.com'
).replace(/\/+$/, '');

// 公开页面配置：path -> { title, description }
const PUBLIC_PAGES = [
  {
    path: '/',
    title: 'BugPk-Api - 开放 API 服务与接口交易平台',
    description:
      'BugPk-Api open API service platform，提供接口调用、计费、市场与文档服务。',
  },
  {
    path: '/apis',
    title: '接口列表 - BugPk-Api',
    description:
      '浏览 BugPk-Api 平台的全部开放接口，查看文档、价格与调用方式。',
    canonicalPath: '/apilist',
    noindex: true,
  },
  {
    path: '/apilist',
    title: 'API 市场 - BugPk-Api',
    description: 'BugPk-Api API 市场：精选优质开放接口，一键接入、按量计费。',
  },
  {
    path: '/links',
    title: '友情链接 - BugPk-Api',
    description: 'BugPk-Api 友情链接列表，欢迎交换友链。',
  },
  {
    path: '/donate',
    title: '捐赠 - BugPk-Api',
    description: '支持 BugPk-Api 开源项目，捐赠以帮助项目持续发展。',
  },
  {
    path: '/privacy-policy',
    title: '隐私政策 - BugPk-Api',
    description:
      'BugPk-Api 隐私政策，说明账号、API 调用、日志、支付、安全验证与第三方服务相关信息的处理方式。',
  },
  {
    path: '/terms-of-service',
    title: '用户协议与免责声明 - BugPk-Api',
    description:
      'BugPk-Api 用户协议与免责声明，约定 API Key、计费支付、第三方接口、开源许可和责任边界。',
  },
  {
    path: '/payment-agreement',
    title: '支付与赞助协议 - BugPk-Api',
    description:
      'BugPk-Api 支付与赞助协议：说明赞助的自愿性质（支付属于赞助支持、不属于交易）、服务额度使用规则、退款与第三方费用扣除标准、免责声明与责任边界。',
  },
];

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeJsonForHtml(s) {
  return s
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

async function main() {
  let indexHtml;
  try {
    indexHtml = await readFile(indexHtmlPath, 'utf8');
  } catch {
    console.error('[seo] 未找到 dist/index.html，请先执行 vite build');
    process.exit(1);
  }

  for (const page of PUBLIC_PAGES) {
    // 1) 生成每个页面的 HTML：替换 title/description/canonical/JSON-LD
    const title = escapeXml(page.title);
    const desc = escapeXml(page.description);
    const url = SITE_URL + (page.canonicalPath || (page.path === '/' ? '/' : page.path));
    const canonicalUrl = escapeXml(url);
    const jsonLd = page.noindex
      ? ''
      : escapeJsonForHtml(
          JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: page.title,
            url,
            description: page.description,
          }),
        );

    let html = indexHtml;
    // 替换 <title>...</title> 内容
    html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    // 替换 meta description（vite 已把 %VITE_APP_DESCRIPTION% 渲染成实际值，此处直接覆盖；
    // 注意 vite 压缩后标签为 <meta name="description" content="..."> 无自闭合斜杠）
    html = html.replace(
      /<meta name="description" content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${desc}">`,
    );
    html = html.replace(
      /<meta name="robots" content="[^"]*"\s*\/?>/,
      `<meta name="robots" content="${page.noindex ? 'noindex, follow' : 'index, follow'}">`,
    );
    // 替换 canonical
    html = html.replace(
      /<link rel="canonical" href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${canonicalUrl}">`,
    );
    // 替换 og:url（社交分享指向具体页面）
    html = html.replace(
      /<meta property="og:url" content="[^"]*"\s*\/?>/,
      `<meta property="og:url" content="${canonicalUrl}">`,
    );
    // 替换 og:title / twitter:title（指向页面标题）
    html = html.replace(
      /<meta property="og:title" content="[^"]*"\s*\/?>/,
      `<meta property="og:title" content="${title}">`,
    );
    html = html.replace(
      /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
      `<meta name="twitter:title" content="${title}">`,
    );
    if (jsonLd) {
      // 注入页面级 JSON-LD（放在 </head> 前）
      html = html.replace(
        '</head>',
        `    <script type="application/ld+json">${jsonLd}</script>\n  </head>`,
      );
    }
    if (page.path === '/apis') {
      html = html.replace(
        '</head>',
        `    <script>location.replace('/apilist' + location.search + location.hash)</script>\n  </head>`,
      );
    }

    // 2) 写到 dist/<path>/index.html（首页写到 dist/index.html，其余建子目录）
    const outPath =
      page.path === '/'
        ? indexHtmlPath
        : join(distDir, page.path, 'index.html');
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, html, 'utf8');
    console.log(`[seo] 已生成 ${page.path} -> ${outPath}`);
  }
  console.log('[seo] 公开页面 SEO HTML 生成完成');
}

main().catch((err) => {
  console.error('[seo] 生成失败:', err);
  process.exit(1);
});
