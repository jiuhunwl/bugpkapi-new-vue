import { describe, expect, it, vi } from 'vitest';

import {
  createToolbarRefreshRunner,
  createToolbarSlots,
  disableBuiltInToolbarRefresh,
  hasNativeToolbarRefresh,
} from './toolbar-refresh';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Vben VXE toolbar refresh bridge', () => {
  it('detects enabled boolean and object refresh configurations', () => {
    expect(hasNativeToolbarRefresh({ refresh: true })).toBe(true);
    expect(hasNativeToolbarRefresh({ refresh: { queryMethod: () => {} } })).toBe(
      true,
    );
    expect(hasNativeToolbarRefresh({ refresh: false })).toBe(false);
    expect(hasNativeToolbarRefresh(undefined)).toBe(false);
  });

  it('disables only the VXE built-in refresh control without mutating input', () => {
    const source = {
      custom: true,
      refresh: { queryMethod: () => {} },
      search: true,
    };

    const normalized = disableBuiltInToolbarRefresh(source);

    expect(normalized).toEqual({
      custom: true,
      refresh: false,
      search: true,
    });
    expect(normalized).not.toBe(source);
    expect(source.refresh).toEqual({ queryMethod: expect.any(Function) });
  });

  it('assigns bridged refresh to the tool suffix without replacing configured tools', () => {
    expect(
      createToolbarSlots({
        actions: false,
        refresh: true,
        tools: false,
      }),
    ).toEqual({
      toolSuffix: 'toolbar-refresh',
    });
  });

  it('keeps an explicit tools slot alongside the refresh suffix', () => {
    expect(
      createToolbarSlots({
        actions: true,
        refresh: true,
        tools: true,
      }),
    ).toEqual({
      buttons: 'toolbar-actions',
      tools: 'toolbar-tools',
      toolSuffix: 'toolbar-refresh',
    });
  });

  it('merges refreshOptions before object refresh overrides them', async () => {
    const refreshOptionsMethod = vi.fn();
    const refreshMethod = vi.fn();
    const query = vi.fn();
    const reload = vi.fn();
    let toolbarConfig: Record<string, any> = {
      refresh: true,
      refreshOptions: { queryMethod: refreshOptionsMethod },
    };
    const runRefresh = createToolbarRefreshRunner({
      getToolbarConfig: () => toolbarConfig,
      onRefreshingChange: () => {},
      query,
      reload,
    });

    await runRefresh();

    expect(refreshOptionsMethod).toHaveBeenCalledWith({});

    toolbarConfig = {
      refresh: { queryMethod: refreshMethod },
      refreshOptions: { queryMethod: refreshOptionsMethod },
    };

    await runRefresh();

    expect(refreshMethod).toHaveBeenCalledOnce();
    expect(refreshMethod).toHaveBeenCalledWith({});
    expect(refreshOptionsMethod).toHaveBeenCalledOnce();
    expect(query).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('prefers queryMethod over the deprecated query callback', async () => {
    const queryMethod = vi.fn();
    const deprecatedQuery = vi.fn();
    const runRefresh = createToolbarRefreshRunner({
      getToolbarConfig: () => ({
        refresh: { query: deprecatedQuery, queryMethod },
      }),
      onRefreshingChange: () => {},
      query: vi.fn(),
      reload: vi.fn(),
    });

    await runRefresh();

    expect(queryMethod).toHaveBeenCalledWith({});
    expect(deprecatedQuery).not.toHaveBeenCalled();
  });

  it('supports the deprecated refresh query callback', async () => {
    const deprecatedQuery = vi.fn();
    const runRefresh = createToolbarRefreshRunner({
      getToolbarConfig: () => ({ refresh: { query: deprecatedQuery } }),
      onRefreshingChange: () => {},
      query: vi.fn(),
      reload: vi.fn(),
    });

    await runRefresh();

    expect(deprecatedQuery).toHaveBeenCalledWith({});
  });

  it.each([
    ['query code', { refresh: { code: 'query' as const } }, 'query'],
    ['reload code', { refresh: { code: 'reload' as const } }, 'reload'],
    ['boolean refresh', { refresh: true }, 'reload'],
  ])('dispatches %s through the grid API', async (_name, config, expected) => {
    const query = vi.fn();
    const reload = vi.fn();
    const runRefresh = createToolbarRefreshRunner({
      getToolbarConfig: () => config,
      onRefreshingChange: () => {},
      query,
      reload,
    });

    await runRefresh();

    expect(query).toHaveBeenCalledTimes(expected === 'query' ? 1 : 0);
    expect(reload).toHaveBeenCalledTimes(expected === 'reload' ? 1 : 0);
  });

  it('forwards a custom refresh code through the native grid commit path', async () => {
    const commit = vi.fn();
    const query = vi.fn();
    const reload = vi.fn();
    const runRefresh = createToolbarRefreshRunner({
      commit,
      getToolbarConfig: () => ({ refresh: { code: 'rebuild-cache' } }),
      onRefreshingChange: () => {},
      query,
      reload,
    });

    await runRefresh();

    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith('rebuild-cache');
    expect(query).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('keeps loading active for the async refresh and ignores a duplicate run', async () => {
    const deferred = createDeferred();
    const loadingChanges: boolean[] = [];
    const queryMethod = vi.fn(() => deferred.promise);
    const runRefresh = createToolbarRefreshRunner({
      getToolbarConfig: () => ({ refresh: { queryMethod } }),
      onRefreshingChange: (refreshing) => loadingChanges.push(refreshing),
      query: vi.fn(),
      reload: vi.fn(),
    });

    const firstRun = runRefresh();
    const duplicateRun = runRefresh();

    expect(queryMethod).toHaveBeenCalledOnce();
    expect(loadingChanges).toEqual([true]);

    deferred.resolve();
    await Promise.all([firstRun, duplicateRun]);

    expect(loadingChanges).toEqual([true, false]);
  });

  it('clears loading and swallows refresh callback failures like VXE', async () => {
    const loadingChanges: boolean[] = [];
    const runRefresh = createToolbarRefreshRunner({
      getToolbarConfig: () => ({
        refresh: {
          queryMethod: () => Promise.reject(new Error('refresh failed')),
        },
      }),
      onRefreshingChange: (refreshing) => loadingChanges.push(refreshing),
      query: vi.fn(),
      reload: vi.fn(),
    });

    await expect(runRefresh()).resolves.toBeUndefined();
    expect(loadingChanges).toEqual([true, false]);
  });
});
