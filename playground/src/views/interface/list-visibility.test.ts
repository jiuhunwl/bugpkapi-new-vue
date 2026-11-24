import { describe, expect, it } from 'vitest';
import source from './list.vue?raw';
import logs from './log.vue?raw';

describe('interface page display boundaries', () => {
  it('explicitly limits the market to users without interface management access', () => {
    expect(source).toContain('<div v-if="!canList" class="interface-market">');
    expect(source).not.toContain('<div v-else class="interface-market">');
  });
  it('always displays the filtered log total, including numbered pagination', () => {
    expect(logs).toContain(':fast-mode="fastMode"');
    expect(logs).not.toMatch(/<CallLogQueryFooter\s+v-if="fastMode"/);
  });
});
