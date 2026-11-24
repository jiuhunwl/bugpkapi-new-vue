import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { waitForAppVisible } from './network';

const captchaPassedPattern = /验证通过|Verified/i;

export async function authLogin(
  page: Page,
  expectedHomePath = '/console/workspace',
) {
  const adminUsername = process.env.E2E_ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      'E2E_ADMIN_PASSWORD must be set to run authenticated E2E tests',
    );
  }

  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await waitForAppVisible(page);

  const usernameInput = page.locator("input[name='username']");
  await expect(usernameInput).toBeVisible({ timeout: 15_000 });
  await usernameInput.fill(adminUsername);
  await page.locator("input[name='password']").fill(adminPassword);

  const sliderCaptcha = page.locator("div[name='captcha']");
  const sliderCaptchaAction = page.locator("div[name='captcha-action']");
  await expect(sliderCaptcha).toBeVisible();
  await expect(sliderCaptchaAction).toBeVisible();

  const captchaVerifyResponse = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === 'POST' &&
        /^\/system-api\/auth\/captcha\/[^/]+\/verify$/.test(url.pathname)
      );
    },
    { timeout: 15_000 },
  );
  await solveSliderCaptcha(page);
  const verifyResponse = await captchaVerifyResponse;
  expect(verifyResponse.ok()).toBe(true);
  const verifyBody = await verifyResponse.json();
  expect(verifyBody?.code).toBe(0);
  await expect(sliderCaptcha).toContainText(captchaPassedPattern);

  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/system-api/auth/login',
  );
  await page.getByRole('button', { name: /登录|login/i }).click();

  const body = await (await loginResponse).json();
  expect(body?.code).toBe(0);
  const accessToken = String(body?.data?.accessToken ?? '').trim();
  expect(accessToken).not.toBe('');

  await expect(page).toHaveURL(pathPattern(expectedHomePath), {
    timeout: 10_000,
  });
  await expect
    .poll(
      () =>
        page
          .locator('#app')
          .evaluate((app) => (app.textContent ?? '').trim().length),
      { message: 'authenticated application should render its protected view' },
    )
    .toBeGreaterThan(20);
  return accessToken;
}

function pathPattern(path: string) {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}(?:\\?|$)`);
}

async function solveSliderCaptcha(page: Page) {
  const sliderCaptcha = page.locator("div[name='captcha']");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (captchaPassedPattern.test(await sliderCaptcha.innerText())) {
      return;
    }

    const solvedByMouse = await dragSliderCaptchaWithMouse(page);
    if (solvedByMouse) {
      return;
    }

    const solvedByDomEvents = await sliderCaptcha.evaluate((captcha) => {
      const action = captcha.querySelector<HTMLElement>(
        "div[name='captcha-action']",
      );
      if (!action) {
        return false;
      }

      const wrapperRect = captcha.getBoundingClientRect();
      const actionRect = action.getBoundingClientRect();
      const startX = wrapperRect.left + actionRect.width / 2;
      const startY = wrapperRect.top + wrapperRect.height / 2;
      const endX = wrapperRect.right - 1;
      const stepCount = 28;

      const mouseEvent = (type: string, clientX: number) =>
        new MouseEvent(type, {
          bubbles: true,
          button: 0,
          buttons: type === 'mouseup' ? 0 : 1,
          cancelable: true,
          clientX,
          clientY: startY,
          screenX: clientX,
          screenY: startY,
          view: window,
        });

      action.dispatchEvent(mouseEvent('mousedown', startX));
      for (let index = 1; index <= stepCount; index += 1) {
        const clientX = startX + ((endX - startX) * index) / stepCount;
        captcha.dispatchEvent(mouseEvent('mousemove', clientX));
      }
      captcha.dispatchEvent(mouseEvent('mouseup', endX));
      return true;
    });

    if (solvedByDomEvents) {
      try {
        await expect(sliderCaptcha).toContainText(captchaPassedPattern, {
          timeout: 3000,
        });
        return;
      } catch {
        // The component may reset after a rejected verification. Retry with
        // the newly issued challenge instead of failing on the first attempt.
      }
    }
  }

  await expect(sliderCaptcha).toContainText(captchaPassedPattern);
}

async function dragSliderCaptchaWithMouse(page: Page) {
  const sliderCaptcha = page.locator("div[name='captcha']");
  const sliderCaptchaAction = page.locator("div[name='captcha-action']");
  const sliderBox = await sliderCaptcha.boundingBox();
  const actionBox = await sliderCaptchaAction.boundingBox();
  if (!sliderBox || !actionBox) {
    throw new Error('Captcha slider is not visible');
  }

  const startX = actionBox.x + actionBox.width / 2;
  const startY = actionBox.y + actionBox.height / 2;
  const targetX = sliderBox.x + sliderBox.width - 1;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 8, startY, { steps: 4 });
  await page.mouse.move(targetX, startY, { steps: 48 });
  await page.mouse.up();

  try {
    await expect(sliderCaptcha).toContainText(captchaPassedPattern, {
      timeout: 1500,
    });
    return true;
  } catch {
    return false;
  }
}
