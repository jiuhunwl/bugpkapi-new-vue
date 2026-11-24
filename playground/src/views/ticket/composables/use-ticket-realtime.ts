import type { TicketApi } from '#/api/ticket';

import { onMounted, onScopeDispose, shallowRef, watch } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import { notification } from 'ant-design-vue';

import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import {
  accountBanDescription,
  parseAccountBanDetails,
} from '#/utils/account-ban';

type RealtimeStatus = 'connected' | 'connecting' | 'offline' | 'reconnecting';

/**
 * The stream uses raw fetch instead of the shared request client, so the
 * global ban interceptor never sees its responses. Without this marker a
 * banned account would retry forever and never learn why.
 */
class TicketStreamBannedError extends Error {
  constructor() {
    super('TICKET_STREAM_ACCOUNT_BANNED');
    this.name = 'TicketStreamBannedError';
  }
}

interface UseTicketRealtimeOptions {
  enabled?: () => boolean;
  onEvent: (event: TicketApi.Event) => Promise<void> | void;
  ticketId?: () => string | undefined;
}

interface SSEFrame {
  data: string;
  event: string;
  id: string;
  retry?: number;
}

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const MAX_RECONNECT_DELAY = 30_000;

/**
 * Reads a ban rejection from the stream handshake and hands the session over to
 * the same flow the request client uses. Returns false for every other failure
 * so ordinary retries keep their existing behaviour.
 */
async function handleBanResponse(response: Response): Promise<boolean> {
  if (response.status !== 403) {
    return false;
  }
  let payload: unknown;
  try {
    payload = await response.clone().json();
  } catch {
    return false;
  }
  const details = parseAccountBanDetails(
    (payload as { data?: unknown } | null)?.data,
  );
  if (!details) {
    return false;
  }
  notification.error({
    description: accountBanDescription(details),
    duration: 0,
    key: 'account-banned',
    message: $t('page.auth.accountBan.title'),
  });
  await useAuthStore().terminateBannedSession();
  return true;
}

export function useTicketRealtime(options: UseTicketRealtimeOptions) {
  const accessStore = useAccessStore();
  const status = shallowRef<RealtimeStatus>('connecting');
  const error = shallowRef('');
  const lastEventAt = shallowRef<Date>();

  let active = false;
  let controller: AbortController | undefined;
  let generation = 0;
  let reconnectResolve: (() => void) | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  function start() {
    if (active) return;
    if (options.enabled?.() === false) {
      status.value = 'offline';
      return;
    }
    active = true;
    const currentGeneration = ++generation;
    void connectionLoop(currentGeneration);
  }

  function stop() {
    active = false;
    generation += 1;
    controller?.abort();
    controller = undefined;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
    reconnectResolve?.();
    reconnectResolve = undefined;
  }

  function restart() {
    stop();
    start();
  }

  async function connectionLoop(currentGeneration: number) {
    let attempt = 0;
    while (active && currentGeneration === generation) {
      if (!accessStore.accessToken) {
        status.value = 'offline';
        error.value = '';
        return;
      }
      status.value = attempt === 0 ? 'connecting' : 'reconnecting';
      try {
        await connectOnce(currentGeneration);
        attempt = 0;
      } catch (connectError) {
        if (!active || currentGeneration !== generation) {
          return;
        }
        if (connectError instanceof TicketStreamBannedError) {
          // The account flow owns the session from here: it has already been
          // notified, so the stream stops instead of reconnecting.
          status.value = 'offline';
          error.value = '';
          return;
        }
        error.value = errorMessage(connectError);
        status.value = isBrowserOffline() ? 'offline' : 'reconnecting';
        attempt += 1;
      }
      if (!active || currentGeneration !== generation) {
        return;
      }
      const delay = Math.min(
        MAX_RECONNECT_DELAY,
        Math.max(1_000, 1_000 * 2 ** Math.min(attempt, 5)),
      );
      await waitForReconnect(delay);
    }
  }

  async function connectOnce(currentGeneration: number) {
    controller = new AbortController();
    const requestLocale = localeHeaders();
    const response = await fetch(streamURL(options.ticketId?.()), {
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'text/event-stream',
        'Accept-Language': requestLocale.acceptLanguage,
        Authorization: `Bearer ${accessStore.accessToken}`,
        'X-App-Locale': requestLocale.appLocale,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      if (await handleBanResponse(response)) {
        throw new TicketStreamBannedError();
      }
      throw new Error(`TICKET_STREAM_HTTP_${response.status}`);
    }
    if (!response.body) {
      throw new Error('TICKET_STREAM_BODY_UNAVAILABLE');
    }

    status.value = 'connected';
    error.value = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (active && currentGeneration === generation) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer = consumeSSEBuffer(
          `${buffer}${decoder.decode(value, { stream: true })}`,
          (frame) => {
            if (frame.event === 'ready') {
              status.value = 'connected';
              return;
            }
            const event = parseTicketEvent(frame);
            if (!event) {
              return;
            }
            lastEventAt.value = new Date();
            void options.onEvent(event);
          },
        );
      }
    } finally {
      reader.releaseLock();
    }
    if (active && currentGeneration === generation) {
      throw new Error('TICKET_STREAM_CLOSED');
    }
  }

  function waitForReconnect(delay: number) {
    return new Promise<void>((resolve) => {
      reconnectResolve = resolve;
      reconnectTimer = setTimeout(() => {
        reconnectResolve = undefined;
        reconnectTimer = undefined;
        resolve();
      }, delay);
    });
  }

  let mounted = false;
  onMounted(() => {
    mounted = true;
    start();
  });
  watch(
    () =>
      [
        accessStore.accessToken,
        options.enabled?.() ?? true,
        options.ticketId?.(),
      ] as const,
    ([token, enabled, id], [previousToken, previousEnabled, previousId]) => {
      if (
        !mounted ||
        (token === previousToken &&
          enabled === previousEnabled &&
          id === previousId)
      )
        return;
      if (enabled && token) restart();
      else {
        stop();
        status.value = 'offline';
      }
    },
  );
  onScopeDispose(() => {
    mounted = false;
    stop();
  });

  return {
    error,
    lastEventAt,
    restart,
    status,
    stop,
  };
}

export function consumeSSEBuffer(
  input: string,
  onFrame: (frame: SSEFrame) => void,
) {
  let buffer = input.replace(/\r\n/g, '\n');
  let boundary = buffer.indexOf('\n\n');
  while (boundary >= 0) {
    const block = buffer.slice(0, boundary);
    buffer = buffer.slice(boundary + 2);
    const frame = parseSSEFrame(block);
    if (frame) {
      onFrame(frame);
    }
    boundary = buffer.indexOf('\n\n');
  }
  return buffer;
}

function parseSSEFrame(block: string): SSEFrame | undefined {
  const data: string[] = [];
  let event = 'message';
  let id = '';
  let retry: number | undefined;
  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    const rawValue = separator < 0 ? '' : line.slice(separator + 1);
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
    switch (field) {
      case 'data': {
        data.push(value);
        break;
      }
      case 'event': {
        event = value || 'message';
        break;
      }
      case 'id': {
        id = value;
        break;
      }
      case 'retry': {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= 0) {
          retry = parsed;
        }
        break;
      }
    }
  }
  if (data.length === 0 && event === 'message' && !id && retry === undefined) {
    return undefined;
  }
  return { data: data.join('\n'), event, id, retry };
}

function parseTicketEvent(frame: SSEFrame): TicketApi.Event | undefined {
  if (!frame.data || !frame.event.startsWith('ticket.')) {
    return undefined;
  }
  try {
    const value = JSON.parse(frame.data) as TicketApi.Event;
    if (!value?.ticketId || !value?.type) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

function streamURL(ticketId?: string) {
  const root = String(apiURL || '').replace(/\/+$/, '');
  const query = ticketId ? `?ticketId=${encodeURIComponent(ticketId)}` : '';
  return `${root}/tickets/stream${query}`;
}

function localeHeaders() {
  const documentLocale =
    typeof document === 'undefined' ? '' : document.documentElement.lang;
  const browserLanguages =
    typeof navigator === 'undefined'
      ? []
      : [...(navigator.languages || []), navigator.language];
  const appLocale =
    [documentLocale, preferences.app.locale, ...browserLanguages].find(
      (value) => typeof value === 'string' && value.trim(),
    ) || 'zh-CN';
  const languages = [appLocale, ...browserLanguages]
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
  return {
    acceptLanguage: languages
      .map((value, index) =>
        index === 0
          ? value
          : `${value};q=${Math.max(0.5, 1 - index * 0.1).toFixed(1)}`,
      )
      .join(','),
    appLocale,
  };
}

function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error || 'TICKET_STREAM_FAILED');
}
