import type { Page } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';

async function mockTickets(
  page: Page,
  mode: 'admin' | 'user',
  readOnly = false,
  legacy = false,
) {
  let loggedIn = false;
  const listPath = mode === 'admin' ? '/admin/tickets' : '/console/tickets';
  const requests: Array<{
    method: string;
    path: string;
    query: URLSearchParams;
  }> = [];
  const tickets = Array.from({ length: 45 }, (_, i) => ({
    id: String(i + 1),
    ticketNo: 'T-' + (i + 1),
    subject: 'Ticket ' + (i + 1),
    status: 'OPEN',
    priority: 'NORMAL',
    category: 'API',
    language: 'zh',
    userId: '7',
    username: 'fixture-user',
    displayName: 'Fixture User',
    lastMessagePreview: 'Preview only',
    lastMessageAt: '2026-10-01 10:00:00',
    createdAt: '2026-10-01 09:00:00',
    updatedAt: '2026-10-01 10:00:00',
    messageCount: 1,
    unreadCount: 1,
    lastReplyBy: 'STAFF',
    tags: [],
    slaStatus: 'FIRST_RESPONSE_PENDING',
    firstResponseOverdue: false,
    resolutionOverdue: false,
  }));
  const messages = new Map<string, Array<Record<string, unknown>>>();
  function detail(id: string) {
    const ticket = tickets.find((t) => t.id === id)!;
    return {
      ticket,
      messages: messages.get(id) ?? [
        {
          id: 'message-' + id,
          content: 'Conversation for ticket ' + id,
          senderId: '1',
          senderName: 'Support',
          senderType: 'STAFF',
          internalNote: false,
          createdAt: '2026-10-01 10:00:00',
        },
      ],
      attachments: [],
      activities: [],
    };
  }
  await page.route('**/system-api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    requests.push({
      method: request.method(),
      path: pathname,
      query: url.searchParams,
    });
    let data: unknown = [];
    if (pathname === '/system-api/auth/refresh') {
      if (!loggedIn) {
        await route.fulfill({
          status: 401,
          json: { code: -1, message: '未登录', data: null, error: '未登录' },
        });
        return;
      }
      await route.fulfill({
        contentType: 'text/plain',
        body: 'ticket-fixture-token',
      });
      return;
    } else if (pathname === '/system-api/site/config')
      data = { siteName: 'BugPk-Api' };
    else if (pathname === '/system-api/auth/captcha')
      data = {
        captchaId: 'ticket-flow',
        challenge: 'abcdef0123456789',
        difficulty: 1,
        provider: 'pow',
        scene: 'login',
      };
    else if (pathname.endsWith('/verify')) data = true;
    else if (pathname === '/system-api/auth/login') {
      loggedIn = true;
      data = { accessToken: 'ticket-fixture-token' };
    } else if (pathname === '/system-api/user/info')
      data = {
        userId: '7',
        username: mode,
        roles: [mode],
        homePath: listPath,
        realName: 'Ticket Tester',
      };
    else if (pathname === '/system-api/auth/codes')
      data = readOnly
        ? ['ticket:' + mode + ':list']
        : [
            'ticket:' + mode + ':list',
            'ticket:' + mode + ':reply',
            'ticket:' + mode + ':close',
            'ticket:' + mode + ':attachment',
            ...(mode === 'admin'
              ? [
                  'ticket:admin:update',
                  'ticket:admin:note',
                  'ticket:admin:quick-reply',
                ]
              : ['ticket:user:create']),
          ];
    else if (pathname === '/system-api/menu/all')
      data = [
        {
          id: '195',
          pid: '0',
          name: legacy
            ? 'TicketCenter'
            : mode === 'admin'
              ? 'AdminTicketManagement'
              : 'UserTicketCenter',
          path: legacy ? '/tickets' : listPath,
          component: legacy ? '/ticket/index' : '/ticket/' + mode,
          type: 'menu',
          status: 1,
          authCode: 'ticket:' + mode + ':list',
          meta: {
            title: mode === 'admin' ? 'ticket.adminTitle' : 'ticket.title',
          },
        },
      ];
    else if (pathname === '/system-api/tickets/stream') {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: 'event: ready\ndata: {}\n\n',
      });
      return;
    } else if (pathname === '/system-api/tickets/attachment-policy') {
      data = { maxBytes: 3 * 1024 * 1024, allowedExtensions: ['.txt', '.png'] };
    } else if (/^\/system-api\/tickets\/\d+\/attachments$/.test(pathname) && request.method() === 'POST') {
      data = { id: 'uploaded-fixture' };
    } else if (pathname === '/system-api/tickets') {
      const current = Number(url.searchParams.get('page') || 1);
      const size = Number(url.searchParams.get('pageSize') || 20);
      data = {
        items: tickets.slice((current - 1) * size, current * size),
        total: tickets.length,
        summary: {
          all: 45,
          open: 45,
          processing: 0,
          waitingUser: 0,
          resolved: 0,
          closed: 0,
          unread: tickets.reduce((n, t) => n + t.unreadCount, 0),
        },
      };
    } else if (/^\/system-api\/tickets\/\d+$/.test(pathname))
      data = detail(pathname.split('/').at(-1)!);
    else if (/\/tickets\/\d+\/read$/.test(pathname)) {
      const id = pathname.split('/').at(-2)!;
      tickets.find((t) => t.id === id)!.unreadCount = 0;
      data = true;
    } else if (/\/tickets\/\d+\/messages$/.test(pathname)) {
      const id = pathname.split('/').at(-2)!;
      const item = detail(id);
      messages.set(id, [
        ...item.messages,
        {
          id: 'reply-' + id,
          content: request.postDataJSON().content,
          senderId: '7',
          senderName: 'Ticket Tester',
          senderType: mode === 'admin' ? 'STAFF' : 'USER',
          internalNote: false,
          createdAt: '2026-10-01 11:00:00',
        },
      ]);
      data = detail(id);
    } else if (pathname === '/system-api/auth/register/config') data = {};
    await route.fulfill({
      json: { code: 0, data, error: null, message: 'ok' },
    });
  });
  await authLogin(page, listPath);
  await expect(page.locator('.ticket-list-route')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Ticket 1', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Ticket 1', exact: true }),
  ).toBeInViewport();
  if ((page.viewportSize()?.width ?? 1024) < 640) {
    await expect
      .poll(() =>
        page
          .locator('.ticket-list-page__grid .vxe-table--body-wrapper')
          .first()
          .evaluate((element) => element.clientHeight),
      )
      .toBeGreaterThan(80);
  }
  return { requests, listPath };
}

for (const mode of ['admin', 'user'] as const) {
  test(
    mode + ' list opens a standalone conversation and restores filters/page',
    async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => {
        if (!/ResizeObserver/i.test(error.message))
          pageErrors.push(error.message);
      });
      const { requests, listPath } = await mockTickets(page, mode);
      await page.screenshot({
        path: testInfo.outputPath(mode + '-list-initial.png'),
        fullPage: true,
      });
      expect(
        requests.filter((r) =>
          /^\/system-api\/tickets\/\d+(?:\/read)?$/.test(r.path),
        ),
      ).toHaveLength(0);
      await expect(page.locator('.ticket-detail')).toHaveCount(0);
      expect(
        requests.filter((r) => r.path === '/system-api/tickets'),
      ).toHaveLength(1);
      if ((page.viewportSize()?.width ?? 0) >= 1024) {
        await expect
          .poll(() =>
            page
              .locator('.ticket-list-page__grid .vxe-table--body-wrapper')
              .first()
              .evaluate((element) => element.clientHeight),
          )
          .toBeGreaterThan(120);
      }
      await page.locator('input[name="keyword"]').fill('Ticket');
      await page.getByRole('button', { name: /^搜\s*索$/ }).click();
      await expect
        .poll(() =>
          requests
            .filter((r) => r.path === '/system-api/tickets')
            .at(-1)
            ?.query.get('keyword'),
        )
        .toBe('Ticket');
      await page.locator('.vxe-pager--next-btn').click();
      await expect(
        page.getByRole('link', { name: 'Ticket 21', exact: true }),
      ).toBeVisible();
      await page
        .locator('.vxe-body--row')
        .filter({
          has: page.getByRole('link', { name: 'Ticket 21', exact: true }),
        })
        .getByText('T-21', { exact: true })
        .click();
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toBe(listPath + '/21');
      await expect(
        page.getByText('Conversation for ticket 21', { exact: true }),
      ).toBeVisible();
      expect(
        requests.filter(
          (r) => r.path === '/system-api/tickets/21' && r.method === 'GET',
        ),
      ).toHaveLength(1);
      if (mode === 'admin') {
        await expect(
          page.locator('.ticket-detail__res-tabs button'),
        ).toHaveCount(3);
        await expect(page.locator('.ticket-detail__meta-strip')).toBeVisible();
        const adminToggle = page.locator('.meta-admin-toggle');
        if (await adminToggle.isVisible()) {
          await adminToggle.click();
          await expect(page.locator('.ticket-detail__admin-bar')).toBeVisible();
        }
      }
      await expect
        .poll(
          () =>
            requests.filter((r) => r.path === '/system-api/tickets/21/read')
              .length,
        )
        .toBe(1);
      await page
        .locator('.ticket-composer textarea')
        .fill('Reply from the standalone page');
      await page.getByRole('button', { name: '发送回复', exact: true }).click();
      await expect(
        page.getByText('Reply from the standalone page', { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(mode + '-detail.png'),
        fullPage: true,
      });
      await page
        .getByRole('button', { name: '返回工单列表', exact: true })
        .first()
        .click();
      await expect(
        page.getByRole('link', { name: 'Ticket 21', exact: true }),
      ).toBeVisible();
      await expect(page.locator('input[name="keyword"]')).toHaveValue('Ticket');
      expect(new URL(page.url()).searchParams.get('page')).toBe('2');
      const reads = requests.filter((r) => r.path.endsWith('/read')).length;
      await expect(page.locator('.ticket-detail')).toHaveCount(0);
      expect(requests.filter((r) => r.path.endsWith('/read'))).toHaveLength(
        reads,
      );
      await page.screenshot({
        path: testInfo.outputPath(mode + '-list.png'),
        fullPage: true,
      });
      await page.getByRole('link', { name: 'Ticket 21', exact: true }).click();
      await page.reload();
      await expect(
        page.getByText('Conversation for ticket 21', { exact: true }),
      ).toBeVisible();
      await page.goBack();
      expect(pageErrors).toEqual([]);
      await expect(
        page.getByRole('link', { name: 'Ticket 21', exact: true }),
      ).toBeVisible();
      // Restored advanced filters must reach the API, not just remain in the URL.
      const advanced = new URLSearchParams({
        keyword: 'Ticket',
        status: 'OPEN',
        priority: 'NORMAL',
        category: 'API',
        page: '1',
        pageSize: '10',
      });
      await page.goto(listPath + '?' + advanced.toString());
      await expect(
        page.getByRole('link', { name: 'Ticket 1', exact: true }),
      ).toBeVisible();
      await page.getByRole('link', { name: 'Ticket 1', exact: true }).click();
      await expect(
        page.getByText('Conversation for ticket 1', { exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: '返回工单列表', exact: true })
        .first()
        .click();
      await expect(
        page.getByRole('link', { name: 'Ticket 1', exact: true }),
      ).toBeVisible();
      expect(
        Object.fromEntries(
          requests.filter((r) => r.path === '/system-api/tickets').at(-1)!
            .query,
        ),
      ).toMatchObject(Object.fromEntries(advanced));
      expect(pageErrors).toEqual([]);
    },
  );
}

test('legacy menu uses the list and read-only users cannot create or reply', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const { requests } = await mockTickets(page, 'user', true, true);
  await expect(
    page.getByRole('button', { name: '新建工单', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'Ticket 1', exact: true }).click();
  await expect(
    page.getByText('Conversation for ticket 1', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.ticket-composer textarea')).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '发送回复', exact: true }),
  ).toBeDisabled();
  expect(
    requests.filter((r) => r.method === 'POST' && r.path.endsWith('/messages')),
  ).toHaveLength(0);
});

test('list failure shows retry and unknown counts instead of stale statistics', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await mockTickets(page, 'user');
  await page.route('**/system-api/tickets?**', (route) =>
    route.fulfill({ status: 503, json: { code: 1, message: 'unavailable' } }),
  );
  await page.reload();
  await expect(page.locator('.ticket-list-error')).toBeVisible();
  await expect(page.locator('.ticket-summary strong')).toHaveText([
    '—',
    '—',
    '—',
    '—',
  ]);
});

test('ticket colors inherit primary token without changing page width', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await mockTickets(page, 'user');
  await expect(page.locator('.ticket-subject-meta').first()).toContainText(
    'T-1',
  );
  const navigation = page.locator('.ticket-list-route');
  const before = await navigation.evaluate((element) => element.clientWidth);
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--primary', '160 70% 35%');
    document.documentElement.classList.add('dark');
  });
  await expect(page.locator('.ticket-summary .is-unread strong')).toHaveCSS(
    'color',
    'rgb(27, 152, 110)',
  );
  expect(await navigation.evaluate((element) => element.clientWidth)).toBe(
    before,
  );
  await page.screenshot({
    path: testInfo.outputPath('ticket-theme-dark.png'),
    fullPage: true,
  });
});


test('attachment policy rejects invalid files before sending and accepts the exact limit', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const { requests } = await mockTickets(page, 'user');
  await page.getByRole('link', { name: 'Ticket 1', exact: true }).click();
  const panel = page.locator('.ticket-attachments');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.ticket-attachments__hint')).toContainText('3 MiB');
  const upload = panel.locator('.ticket-attachments__header button');
  await expect(upload).toBeEnabled();
  const uploadRequests = () => requests.filter((r) => r.method === 'POST' && r.path.endsWith('/attachments'));
  for (const file of [
    { name: 'large.txt', mimeType: 'text/plain', buffer: Buffer.alloc(3 * 1024 * 1024 + 1, 'a') },
    { name: 'script.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('test') },
    { name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) },
  ]) {
    const chooserPromise = page.waitForEvent('filechooser');
    await upload.click();
    await (await chooserPromise).setFiles(file);
    await expect(page.locator('.ant-message-error').last()).toContainText(file.name);
    expect(uploadRequests()).toHaveLength(0);
  }
  const chooserPromise = page.waitForEvent('filechooser');
  await upload.click();
  await (await chooserPromise).setFiles({ name: 'exact.TXT', mimeType: 'text/plain', buffer: Buffer.alloc(3 * 1024 * 1024, 'a') });
  await expect.poll(() => uploadRequests().length).toBe(1);
  await expect(upload).toBeEnabled();
  await expect.poll(() => requests.filter((r) => r.method === 'GET' && r.path === '/system-api/tickets/1').length).toBe(2);
  await page.screenshot({ path: testInfo.outputPath('ticket-attachment-policy.png'), fullPage: true });
});

test('attachment policy failure disables uploads and exposes a working retry', async ({ page }) => {
  test.setTimeout(90_000);
  const { requests } = await mockTickets(page, 'user');
  let attempts = 0;
  await page.route('**/system-api/tickets/attachment-policy', async (route) => {
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 503, json: { code: -1, message: 'fixture unavailable', data: null } });
    else await route.fulfill({ json: { code: 0, data: { maxBytes: 2 * 1024 * 1024, allowedExtensions: ['.txt'] }, message: 'ok', error: null } });
  });
  await page.getByRole('link', { name: 'Ticket 1', exact: true }).click();
  const panel = page.locator('.ticket-attachments');
  const upload = panel.locator('.ticket-attachments__header button');
  await expect(panel.locator('[role="alert"]')).toBeVisible();
  await expect(upload).toBeDisabled();
  expect(requests.filter((r) => r.method === 'POST' && r.path.endsWith('/attachments'))).toHaveLength(0);
  await panel.locator('[role="alert"] button').click();
  await expect(upload).toBeEnabled();
  await expect(panel.locator('.ticket-attachments__hint')).toContainText('2 MiB');
  await expect(panel.locator('[role="alert"]')).toHaveCount(0);
  expect(attempts).toBe(2);
});
