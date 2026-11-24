import { ref } from 'vue';

import { useDebounceFn } from '@vueuse/core';

export type RemoteOption = { label: string; value: string };
export type RemoteOptionFetcher = (
  keyword: string,
  signal: AbortSignal,
) => Promise<RemoteOption[]>;

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { code?: string; name?: string };
  return (
    candidate.code === 'ERR_CANCELED' ||
    candidate.name === 'AbortError' ||
    candidate.name === 'CanceledError'
  );
}

/**
 * 远程选项搜索的核心逻辑：防抖、取消旧请求、陈旧响应丢弃。
 * 有意不依赖组件生命周期（dispose 由调用方触发），便于单元测试。
 */
export function useRemoteOptions(
  fetch: RemoteOptionFetcher,
  debounceMs = 300,
) {
  const options = ref<RemoteOption[]>([]);
  const loading = ref(false);
  let controller: AbortController | null = null;
  let sequence = 0;

  async function load(keyword: string) {
    controller?.abort();
    controller = new AbortController();
    const current = ++sequence;
    const signal = controller.signal;
    loading.value = true;
    try {
      const result = await fetch(keyword, signal);
      if (current === sequence && !signal.aborted) {
        options.value = result;
      }
    } catch (error) {
      if (!isAbortError(error) && current === sequence) {
        options.value = [];
      }
    } finally {
      if (current === sequence) {
        loading.value = false;
      }
    }
  }

  const search = useDebounceFn(load, debounceMs);

  function dispose() {
    controller?.abort();
    sequence++;
    loading.value = false;
  }

  return { options, loading, search, load, dispose };
}
