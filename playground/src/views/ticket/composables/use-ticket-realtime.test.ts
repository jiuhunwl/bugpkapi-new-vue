import { describe, expect, it } from 'vitest';

import { consumeSSEBuffer } from './use-ticket-realtime';

describe('ticket SSE parser', () => {
  it('preserves incomplete chunks and parses CRLF event frames', () => {
    const frames: Array<{ data: string; event: string; id: string }> = [];
    let buffer = consumeSSEBuffer(
      'id: 7\r\nevent: ticket.message\r\ndata: {"ticketId":"12",',
      (frame) => frames.push(frame),
    );
    expect(frames).toHaveLength(0);

    buffer = consumeSSEBuffer(
      `${buffer}"type":"ticket.message"}\r\n\r\n`,
      (frame) => frames.push(frame),
    );

    expect(buffer).toBe('');
    expect(frames).toEqual([
      {
        data: '{"ticketId":"12","type":"ticket.message"}',
        event: 'ticket.message',
        id: '7',
        retry: undefined,
      },
    ]);
  });

  it('joins multiline data and ignores heartbeat comments', () => {
    const frames: Array<{ data: string; event: string; id: string }> = [];
    const buffer = consumeSSEBuffer(
      ': heartbeat\n\nevent: ready\ndata: {\ndata: }\n\n',
      (frame) => frames.push(frame),
    );

    expect(buffer).toBe('');
    expect(frames).toEqual([
      { data: '{\n}', event: 'ready', id: '', retry: undefined },
    ]);
  });
});
