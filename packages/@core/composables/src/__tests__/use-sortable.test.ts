import type { SortableOptions } from 'sortablejs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSortable } from '../use-sortable';

const { createSortableMock } = vi.hoisted(() => ({
  createSortableMock: vi.fn(),
}));

vi.mock('sortablejs/modular/sortable.complete.esm.js', () => ({
  default: {
    create: createSortableMock,
  },
}));

describe('useSortable', () => {
  beforeEach(() => {
    createSortableMock.mockReset();
  });
  it('should call Sortable.create with the correct options', async () => {
    // Create a mock element
    const mockElement = document.createElement('div') as HTMLDivElement;

    // Define custom options
    const customOptions: SortableOptions = {
      group: 'test-group',
      sort: false,
    };

    // Use the useSortable function
    const { initializeSortable } = useSortable(mockElement, customOptions);

    // Initialize sortable
    await initializeSortable();

    // Verify that Sortable.create was called with the correct parameters
    expect(createSortableMock).toHaveBeenCalledTimes(1);
    expect(createSortableMock).toHaveBeenCalledWith(
      mockElement,
      expect.objectContaining({
        animation: 300,
        delay: 400,
        delayOnTouchOnly: true,
        ...customOptions,
      }),
    );
  });
});
