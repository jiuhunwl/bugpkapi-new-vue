import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const directory = dirname(fileURLToPath(import.meta.url));

/** 取某个选择器的声明块内容，使断言与属性书写顺序无关。 */
function cssBlock(source: string, selectorPattern: string): string {
  return source.match(new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
}

/** 兼容 overflow-y: auto 与 stylelint 合并后的 overflow: hidden auto 两种写法。 */
const scrollsVertically = /overflow(-y)?:\s*(hidden\s+auto|auto);/;

describe('ticket workbench scroll layout', () => {
  it('keeps the administrator entry on the list and gives the standalone detail a shrinking Page root', () => {
    const admin = readFileSync(resolve(directory, 'admin.vue'), 'utf8');
    const detail = readFileSync(resolve(directory, 'detail.vue'), 'utf8');
    expect(admin).toContain("'./admin-list.vue'");
    expect(detail).toContain(
      'content-class="flex min-h-0 flex-col overflow-hidden"',
    );
    expect(detail).toContain('class="ticket-detail-route"');
  });

  it('uses one compact workbench without the redundant statistics overview', () => {
    const page = readFileSync(resolve(directory, 'index.vue'), 'utf8');

    expect(page).toMatch(/<Page\s+auto-content-height/);
    expect(page).toMatch(
      /content-class="flex min-h-0 flex-col overflow-hidden"/,
    );
    expect(page).toMatch(
      /<main\s+class="ticket-page__workspace"[\s\S]*?<TicketListPanel/,
    );
    expect(page).not.toContain('TicketAdminOverview');
    expect(page).not.toMatch(/<Tag[\s\S]*?ticket\.summary\.(open|unread)/);
  });

  it('pins workspace grid row height to container (root cause of list-not-scroll & detail-squeezed)', () => {
    const page = readFileSync(resolve(directory, 'index.vue'), 'utf8');

    // 关键修复断言：grid 行高必须锁定为容器高度（minmax(0, 1fr)），
    // 否则默认 auto 会让行高跟随内容，列表 overflow-y:auto 永不触发 → 无法滚动，
    // 对话区也被拉成内容高度并被 workspace 的 overflow:hidden 裁切 → 被挤压。
    expect(page).toMatch(/grid-template(-rows)?:[^;]*minmax\(0,\s*1fr\)/);
    // 所有断点都必须显式声明 rows，防止媒体查询覆盖后退化回 auto
    const allWorkspaceBlocks = page.match(
      /\.ticket-page__workspace\s*\{[^}]*\}/g,
    );
    expect(allWorkspaceBlocks).toBeTruthy();
    for (const block of allWorkspaceBlocks!) {
      expect(block).toMatch(/minmax\(0,\s*1fr\)/);
    }
  });

  it('keeps the ticket list body as the only list scroll owner', () => {
    const list = readFileSync(
      resolve(directory, 'components/TicketListPanel.vue'),
      'utf8',
    );

    const panel = cssBlock(list, '\\.ticket-list-panel');
    expect(panel).toContain('display: flex');
    expect(panel).toContain('flex: 1 1 auto');
    expect(panel).toContain('min-height: 0');
    expect(panel).toContain('overflow: hidden');
    // 滚动 owner 必须是我们自建的 .ticket-list-panel__body：
    // Ant 的 Spin 把 attrs 里的 class 落在外层包装 div 上，真正的
    // .ant-spin-nested-loading 并不带这个 class，所以
    // `.ticket-list-panel__spin :deep(.ant-spin-nested-loading)`
    // 永远匹配不到，会让 wrapper 保持 flex:0 1 auto + min-height:auto
    // 长到内容高度 → 列表无法滚动。此断言防止回退到那种写法。
    expect(list).toMatch(/<div class="ticket-list-panel__body">\s*<Spin/);
    const body = cssBlock(list, '\\.ticket-list-panel__body');
    expect(body).toContain('display: flex');
    expect(body).toContain('flex: 1 1 auto');
    expect(body).toContain('min-height: 0');
    expect(body).toContain('overflow: hidden');

    const spinContainer = cssBlock(
      list,
      '\\.ticket-list-panel__body\\s+:deep\\(\\.ant-spin-container\\)',
    );
    expect(spinContainer).toContain('min-height: 0');
    expect(spinContainer).toMatch(scrollsVertically);
  });

  it('makes the detail thread the only scroll owner and pins the composer below it', () => {
    const detail = readFileSync(
      resolve(directory, 'components/TicketDetail.vue'),
      'utf8',
    );

    expect(detail).toMatch(
      /<div class="ticket-detail__spin">\s*<div class="ticket-detail__spin-component">\s*<Spin/,
    );
    const spinWrapper = cssBlock(
      detail,
      '\\.ticket-detail__spin-component\\s+:deep\\(\\.ant-spin-nested-loading\\)',
    );
    expect(spinWrapper).toContain('display: flex');
    expect(spinWrapper).toContain('min-height: 0');
    const spinContainer = cssBlock(
      detail,
      '\\.ticket-detail__spin-component\\s+:deep\\(\\.ant-spin-container\\)',
    );
    expect(spinContainer).toContain('display: flex');
    expect(spinContainer).toContain('min-height: 0');
    // 对话线程是唯一滚动 owner（历史缺陷：整页共用一个滚动区，消息一多
    // 发送框被推出可视区 → “挤压发送框”）。发送框必须紧贴在滚动区之后，
    // 作为独立钉底区域存在，而不是滚动区的一部分。
    expect(cssBlock(detail, '\\.ticket-detail__thread')).toMatch(
      scrollsVertically,
    );
    expect(detail).toMatch(
      /ref="threadEl"[\s\S]*?<\/div>\s*<div class="ticket-detail__composer">/,
    );
  });
});
