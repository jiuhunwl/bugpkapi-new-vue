import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import SliderCaptcha from '../index.vue';

function defineWidth(element: Element, width: number) {
  Object.defineProperty(element, 'offsetWidth', {
    configurable: true,
    value: width,
  });
}

async function dispatchTouch(
  element: Element,
  type: string,
  touches: Array<{ pageX: number }>,
  changedTouches = touches,
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    changedTouches: { value: changedTouches },
    touches: { value: touches },
  });
  element.dispatchEvent(event);
  await nextTick();
}

describe('slider captcha', () => {
  it('uses the changed touch coordinate when the finger is released', async () => {
    const wrapper = mount(SliderCaptcha);
    const root = wrapper.find('[name="captcha-action"]').element
      .parentElement as HTMLElement;
    const rootWrapper = wrapper.findComponent(SliderCaptcha).find('div');
    const action = wrapper.find('[name="captcha-action"]');
    defineWidth(root, 220);
    defineWidth(action.element, 40);

    await dispatchTouch(action.element, 'touchstart', [{ pageX: 20 }]);
    await dispatchTouch(rootWrapper.element, 'touchmove', [{ pageX: 190 }]);
    await dispatchTouch(
      rootWrapper.element,
      'touchend',
      [],
      [{ pageX: 220 }],
    );

    expect(wrapper.emitted('success')).toHaveLength(1);
  });

  it('uses monotonic time and emits success once for duplicate end events', async () => {
    const now = vi
      .spyOn(globalThis.performance, 'now')
      .mockReturnValue(1_000);
    const wrapper = mount(SliderCaptcha);
    const root = wrapper.find('[name="captcha-action"]').element
      .parentElement as HTMLElement;
    const rootWrapper = wrapper.findComponent(SliderCaptcha).find('div');
    const action = wrapper.find('[name="captcha-action"]');
    defineWidth(root, 220);
    defineWidth(action.element, 40);

    await action.trigger('mousedown', { pageX: 20 });
    now.mockReturnValue(2_250);
    await rootWrapper.trigger('mouseup', { pageX: 220 });
    await rootWrapper.trigger('mouseleave', { pageX: 220 });

    expect(wrapper.emitted('success')).toEqual([[{ isPassing: true, time: '1.3' }]]);
    now.mockRestore();
  });
});
