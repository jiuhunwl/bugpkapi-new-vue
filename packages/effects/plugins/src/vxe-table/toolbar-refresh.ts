type ToolbarConfig = Record<string, any> | undefined;

interface ToolbarRefreshOptions {
  code?: null | string;
  query?: (params: Record<string, any>) => unknown;
  queryMethod?: (params: Record<string, any>) => unknown;
}

interface ToolbarRefreshRunnerOptions {
  commit?: (code: string) => unknown;
  getToolbarConfig: () => ToolbarConfig;
  onRefreshingChange: (refreshing: boolean) => void;
  query: () => unknown;
  reload: () => unknown;
}

interface ToolbarSlotOptions {
  actions: boolean;
  refresh: boolean;
  tools: boolean;
}

export function createToolbarSlots({
  actions,
  refresh,
  tools,
}: ToolbarSlotOptions) {
  return {
    ...(actions ? { buttons: 'toolbar-actions' } : {}),
    ...(tools ? { tools: 'toolbar-tools' } : {}),
    ...(refresh ? { toolSuffix: 'toolbar-refresh' } : {}),
  };
}

export function createToolbarRefreshRunner({
  commit,
  getToolbarConfig,
  onRefreshingChange,
  query,
  reload,
}: ToolbarRefreshRunnerOptions) {
  let refreshing = false;

  return async () => {
    if (refreshing) return;

    refreshing = true;
    onRefreshingChange(true);
    try {
      const toolbarConfig = getToolbarConfig();
      const refresh = toolbarConfig?.refresh;
      const refreshOptions: ToolbarRefreshOptions = {
        ...(toolbarConfig?.refreshOptions ?? {}),
        ...(refresh && typeof refresh === 'object' ? refresh : {}),
      };
      const queryMethod = refreshOptions.queryMethod || refreshOptions.query;

      if (queryMethod) {
        await queryMethod({});
      } else if (refreshOptions.code === 'query') {
        await query();
      } else if (
        refreshOptions.code &&
        refreshOptions.code !== 'reload' &&
        commit
      ) {
        await commit(refreshOptions.code);
      } else {
        await reload();
      }
    } catch {
      // VXE refresh callbacks intentionally do not surface failures.
    } finally {
      refreshing = false;
      onRefreshingChange(false);
    }
  };
}

export function hasNativeToolbarRefresh(toolbarConfig: ToolbarConfig) {
  return Boolean(toolbarConfig?.refresh);
}

export function disableBuiltInToolbarRefresh<T extends ToolbarConfig>(
  toolbarConfig: T,
): T {
  if (!hasNativeToolbarRefresh(toolbarConfig)) return toolbarConfig;
  return {
    ...toolbarConfig,
    refresh: false,
  } as T;
}
