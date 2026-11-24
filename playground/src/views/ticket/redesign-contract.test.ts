import { describe, expect, it } from 'vitest';

import bootstrap from '../../bootstrap.ts?raw';
import docs from '../market/docs.vue?raw';
import composer from './components/TicketComposer.vue?raw';
import detail from './components/TicketDetail.vue?raw';
import timeline from './components/TicketMessageTimeline.vue?raw';
import columns from './data.ts?raw';
import detailRoute from './detail.vue?raw';
import list from './list.vue?raw';

describe('Vben-native ticket and docs layout', () => {
  it('keeps grid behavior but combines identity and latest activity into readable columns', () => {
    expect(list).toContain('ticket-subject-meta');
    expect(list).toContain('row.lastMessagePreview');
    expect(columns).not.toContain("field: 'ticketNo'");
    expect(columns).not.toContain("field: 'unreadCount'");
    expect(list).toContain('TicketSummary');
    expect(list).toContain('listError');
  });
  it('uses one detail heading, with the thread as scroll owner and no fixed decorative palette', () => {
    expect(detailRoute).not.toContain(':title="pageTitle"');
    expect(detail).toContain('ticket-detail-scroll-region');
    expect(detail + timeline + composer).not.toMatch(
      /linear-gradient|#4f8cff|#8b5cf6|#22d3ee/,
    );
    expect(timeline).toContain('hsl(var(--primary)');
  });
  it('places the real explorer beside docs without a duplicate terminal hero or hardcoded hostname', () => {
    expect(bootstrap).toContain("router.currentRoute.value.name !== 'ApiDocs'");
    expect(docs).toContain('docs-playground');
    expect(docs).not.toContain('api.example.com/docs/');
    expect(docs).not.toContain('class="api-hero"');
    expect(docs).not.toContain('var(--home-grad)');
  });
});
