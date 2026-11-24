import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DocsCodeBlock from './DocsCodeBlock.vue';
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/icons', () => ({
  IconifyIcon: defineComponent({ setup: () => () => h('i') }),
}));
const cleanup: Array<() => void> = [];
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn());
  vi.restoreAllMocks();
});
function mount(code: string) {
  const el = document.createElement('div');
  document.body.append(el);
  const app = createApp(DocsCodeBlock, {
    code,
    title: 'JSON response',
    language: 'JSON',
  });
  app.mount(el);
  cleanup.push(() => {
    app.unmount();
    el.remove();
  });
  return el;
}
describe('documentation code block', () => {
  it('renders code as text, never markup', () => {
    const el = mount('<img src=x onerror=alert(1)>');
    expect(el.querySelector('pre')?.textContent).toBe(
      '<img src=x onerror=alert(1)>',
    );
    expect(el.querySelector('img')).toBeNull();
  });
  it('copies the full unmodified payload and announces success', async () => {
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const code = '{\n  "data": "&<value>"\n}';
    const el = mount(code);
    el.querySelector('button')!.click();
    await nextTick();
    await nextTick();
    expect(copy).toHaveBeenCalledWith(code);
    expect(el.textContent).toContain('page.public.marketDocs.design.copied');
  });
  it('handles denied clipboard permission without an unhandled rejection', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new Error('denied'),
    );
    const el = mount('code');
    el.querySelector('button')!.click();
    await nextTick();
    await nextTick();
    expect(
      el.querySelector('.docs-code-block__feedback')?.textContent,
    ).toContain('copyFailed');
  });
  it('does not offer to copy an empty sample', () => {
    const el = mount('');
    expect(el.querySelector('button')!.disabled).toBe(true);
  });
});
