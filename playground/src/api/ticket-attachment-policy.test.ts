import { describe, expect, it, vi } from 'vitest';

import { getTicketAttachmentPolicy } from './ticket';

const client = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./request', () => ({ requestClient: client }));

describe('ticket attachment policy API', () => {
  it('uses the system-api-relative route and returns the client-unwrapped policy with cancellation', async () => {
    const policy = {
      maxBytes: 3 * 1024 * 1024,
      allowedExtensions: ['.png', '.pdf'],
    };
    const controller = new AbortController();
    client.get.mockResolvedValueOnce(policy);

    expect(await getTicketAttachmentPolicy(controller.signal)).toEqual(policy);
    expect(client.get).toHaveBeenCalledWith('/tickets/attachment-policy', {
      signal: controller.signal,
    });
  });
});
