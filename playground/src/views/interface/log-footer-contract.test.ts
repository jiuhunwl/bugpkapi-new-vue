import { describe, expect, it } from 'vitest';
import page from './log.vue?raw';
import footer from './modules/CallLogQueryFooter.vue?raw';
import columns from './log-data.ts?raw';
describe('standard Vben call log page', () => {
  it('uses one Page and one Vben grid like key/user management', () => {
    expect(page).toContain('auto-content-height');
    expect(page).toContain(':table-title="pageTitle"');
    expect(page).toContain("$t('system.package.billingRecordTitle')");
    expect(page).toContain('<template #bottom>');
    expect(page).not.toContain('call-log-hero');
    expect(page).not.toContain('call-log-grid-region');
  });
  it('keeps a lightweight count/pager inside the grid, not a separate statistics card', () => {
    expect(page).toContain(':count-loading="countLoading"');
    expect(page).toContain('@count="onLoadTotal"');
    expect(footer).not.toContain('Statistic');
    expect(footer).toContain('total === null');
    expect(footer).toContain('aria-live="polite"');
  });
  it('retains explicit search without custom grid layout overrides', () => {
    expect(page).toContain('collapsed: true');
    expect(page).toContain('submitOnChange: false');
    expect(page).not.toContain('ResizeObserver');
    expect(page).not.toContain(':deep(.vxe-');
    expect(page).not.toContain('overflow-hidden');
    expect(page).toContain('logQuery.cancel()');
  });
  it('starts both user and admin lists with the interface rather than admin-only metadata', () => {
    expect(columns).not.toMatch(/return \[\s*\.\.\.adminColumns/);
  });
});
