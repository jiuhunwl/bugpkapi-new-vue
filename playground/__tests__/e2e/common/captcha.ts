import type { Locator, Page } from '@playwright/test';

import { expect } from '@playwright/test';

export async function completePowCaptcha(page: Page, root: Locator) {
  const action = root.locator("[name='captcha-action']").first();
  await expect(action).toBeVisible();
  const wrapper = action.locator('xpath=..');
  const actionBox = await action.boundingBox();
  const wrapperBox = await wrapper.boundingBox();
  if (!actionBox || !wrapperBox) {
    throw new Error('Captcha slider layout is unavailable');
  }

  const startX = actionBox.x + actionBox.width / 2;
  const y = actionBox.y + actionBox.height / 2;
  // The captcha can be rendered inside an animating modal. During the scale
  // transition, boundingBox() reports the transient visual width rather than
  // the widget's layout width, so dragging to that edge may stop too early.
  // The component clamps the pointer position to its real track width.
  const endX = startX + 1000;
  await action.dispatchEvent('mousedown', {
    button: 0,
    buttons: 1,
    clientX: startX,
    clientY: y,
    pageX: startX,
    pageY: y,
  });
  await wrapper.dispatchEvent('mousemove', {
    button: 0,
    buttons: 1,
    clientX: endX,
    clientY: y,
    pageX: endX,
    pageY: y,
  });
  await wrapper.dispatchEvent('mouseup', {
    button: 0,
    buttons: 0,
    clientX: endX,
    clientY: y,
    pageX: endX,
    pageY: y,
  });
  await expect(root).toContainText(/验证通过|Passed|Success/i);
}
