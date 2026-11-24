import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('./request', () => ({
  requestClient: {
    get: mocks.get,
  },
}));

import { getKeyInterfaceOptions } from './key';

function marketInterface(id: number) {
  return {
    apiCode: `api-${id}`,
    id,
    name: `API ${id}`,
    pointPrice: 0,
    price: 0,
    requestMethod: 'GET' as const,
  };
}

describe('key interface options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads every page from the user-accessible market endpoint', async () => {
    mocks.get.mockImplementation((_path: string, config: any) => {
      const page = Number(config?.params?.page);
      return Promise.resolve({
        items:
          page === 1
            ? Array.from({ length: 100 }, (_, index) =>
                marketInterface(index + 1),
              )
            : [marketInterface(101)],
        total: 101,
      });
    });

    const options = await getKeyInterfaceOptions();

    expect(options).toHaveLength(101);
    expect(options[100]).toMatchObject({
      id: '101',
      label: 'API 101 (api-101)',
    });
    expect(mocks.get).toHaveBeenNthCalledWith(1, '/market/apis', {
      params: { page: 1, pageSize: 100 },
    });
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/market/apis', {
      params: { page: 2, pageSize: 100 },
    });
  });
});
