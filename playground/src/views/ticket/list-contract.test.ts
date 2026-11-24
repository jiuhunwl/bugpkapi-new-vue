import { describe, expect, it } from 'vitest';
import list from './list.vue?raw';
import userEntry from './user.vue?raw';
import adminEntry from './admin.vue?raw';
import detail from './detail.vue?raw';

describe('ticket list/detail wiring', () => {
  it('routes the old entry wrappers to the list, not the side-by-side workspace', () => {
    expect(userEntry).toContain("'./user-list.vue'");
    expect(adminEntry).toContain("'./admin-list.vue'");
    expect(userEntry + adminEntry).not.toContain("'./index.vue'");
  });
  it('binds row clicks through VXE gridEvents and provides a keyboard-accessible subject link', () => {
    expect(list).toMatch(/gridEvents:\s*\{[\s\S]*?cellClick: onCellClick/);
    expect(list).toContain('<RouterLink');
    expect(list).not.toContain('@cell-click');
  });
  it('loads only the list and enforces the existing create permission', () => {
    expect(list).not.toContain('getTicketDetail');
    expect(list).not.toContain('markTicketRead');
    expect(list).toContain("hasCode('ticket:user:create')");
    expect(list).toContain('submitOnChange: false');
  });
  it('does not lose quick reply creation in the standalone detail', () => {
    expect(detail).toContain('createTicketQuickReply(payload)');
    expect(detail).not.toContain('update only in this minimal wrapper');
  });
});
