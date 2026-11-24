import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CallLogQueryFooter from './CallLogQueryFooter.vue';

vi.mock('#/locales', () => ({
  $t: (key: string, args: unknown[] = []) =>
    key + (args.length ? ':' + args.join(',') : ''),
}));
vi.mock('@vben/icons', () => ({
  IconifyIcon: defineComponent({ setup: () => () => h('i') }),
}));
vi.mock('ant-design-vue', () => ({
  Button: defineComponent({
    props: ['disabled', 'loading'],
    setup:
      (p, { slots }) =>
      () =>
        h(
          'button',
          { disabled: p.disabled, 'data-loading': p.loading },
          slots.default?.(),
        ),
  }),
  Tooltip: defineComponent({
    setup:
      (_p, { slots }) =>
      () =>
        h('span', slots.default?.()),
  }),
  Spin: defineComponent({ setup: () => () => h('span', { 'data-spin': '' }) }),
  Select: defineComponent({
    props: ['value', 'disabled', 'options'],
    emits: ['change'],
    setup:
      (p, { emit }) =>
      () =>
        h(
          'select',
          {
            value: p.value,
            disabled: p.disabled,
            onChange: (e: Event) =>
              emit('change', (e.target as HTMLSelectElement).value),
          },
          p.options.map((o: { value: number; label: string }) =>
            h('option', { value: o.value }, o.label),
          ),
        ),
  }),
}));
const disposers: Array<() => void> = [];
afterEach(() => disposers.splice(0).forEach((fn) => fn()));
function mount(overrides = {}) {
  const props = reactive({
    total: null as number | null,
    countLoading: false,
    countError: false,
    fastMode: true,
    loading: false,
    hasLoaded: true,
    currentPage: 1,
    pageSize: 20,
    hasNext: true,
    ...overrides,
  });
  const events = { count: vi.fn(), page: vi.fn(), size: vi.fn() };
  const el = document.createElement('div');
  document.body.append(el);
  const app = createApp({
    render: () =>
      h(CallLogQueryFooter, {
        ...props,
        onCount: events.count,
        onPage: events.page,
        onPageSize: events.size,
      }),
  });
  app.mount(el);
  disposers.push(() => {
    app.unmount();
    el.remove();
  });
  const button = (key: string) =>
    [...el.querySelectorAll('button')].find(
      (b) =>
        b.textContent?.includes(key) ||
        b.getAttribute('aria-label')?.includes(key),
    )!;
  return { el, props, events, button };
}
describe('call-log count footer', () => {
  it('renders grouped inline counts and distinguishes zero from unknown', async () => {
    const { el, props } = mount({ total: 526856 });
    expect(el.querySelector('strong')?.textContent).toBe('526,856');
    props.total = 0;
    await nextTick();
    expect(el.querySelector('strong')?.textContent).toBe('0');
    expect(el.textContent).not.toContain('fastQueryTotalUnknown');
  });
  it('does not fabricate a count or trigger a count when mounted', () => {
    const { el, events } = mount();
    expect(el.querySelector('strong')).toBeNull();
    expect(
      el.querySelector('[data-testid="call-log-total"]')?.textContent,
    ).toContain('fastQueryTotalUnknown');
    expect(events.count).not.toHaveBeenCalled();
  });
  it('shows a pending state and prevents repeated counting without disabling next-page browsing', async () => {
    const { el, props, events, button } = mount({ total: 526856 });
    props.countLoading = true;
    await nextTick();
    expect(el.querySelector('strong')).toBeNull();
    expect(el.querySelector('[data-spin]')).not.toBeNull();
    expect(button('fastQueryExactAction')).toBeUndefined();
    expect(events.count).not.toHaveBeenCalled();
    button('fastQueryNext').click();
    expect(events.page).toHaveBeenCalledWith(1);
    props.countLoading = false;
    props.total = null;
    await nextTick();
    button('fastQueryExactAction').click();
    expect(events.count).toHaveBeenCalledTimes(1);
  });
  it('preserves list readiness and cursor boundary restrictions', async () => {
    const { props, events, button } = mount({ loading: true });
    expect(button('fastQueryExactAction').disabled).toBe(true);
    expect(button('fastQueryNext').disabled).toBe(true);
    props.loading = false;
    props.hasLoaded = false;
    await nextTick();
    expect(button('fastQueryNext').disabled).toBe(true);
    props.hasLoaded = true;
    await nextTick();
    expect(button('fastQueryPrevious').disabled).toBe(true);
    props.currentPage = 2;
    props.hasNext = false;
    await nextTick();
    expect(button('fastQueryNext').disabled).toBe(true);
    button('fastQueryPrevious').click();
    expect(events.page).toHaveBeenCalledWith(-1);
  });
  it('keeps totals visible in numbered mode without duplicating pagination', () => {
    const { el } = mount({ total: 42, fastMode: false });
    expect(el.querySelector('strong')?.textContent).toBe('42');
    expect(el.querySelector('nav')).toBeNull();
  });
  it('displays a count error instead of a stale number and exposes retry', () => {
    const { el, button, events } = mount({ countError: true });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'fastQueryCountFailed',
    );
    button('fastQueryExactAction').click();
    expect(events.count).toHaveBeenCalledTimes(1);
  });
  it('emits supported page-size changes only', async () => {
    const { el, events } = mount();
    const select = el.querySelector('select')!;
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    await nextTick();
    expect(events.size).toHaveBeenCalledWith(50);
  });
});
