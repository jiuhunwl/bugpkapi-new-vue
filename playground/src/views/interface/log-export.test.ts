import { afterEach, describe, expect, it, vi } from 'vitest';

import * as callLogExport from './log-export';

const { validateCallLogExportBlob } = callLogExport;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('call-log export response validation', () => {
  it('accepts a non-empty CSV blob', async () => {
    const blob = new Blob(['id,time\n1,2026-08-15'], { type: 'text/csv' });

    await expect(validateCallLogExportBlob(blob)).resolves.toBe(blob);
  });

  it('surfaces the server message when a blob contains a JSON error', async () => {
    const blob = new Blob(
      [JSON.stringify({ message: '请缩小筛选范围后重试' })],
      { type: 'application/json' },
    );

    await expect(validateCallLogExportBlob(blob)).rejects.toThrow(
      '请缩小筛选范围后重试',
    );
  });

  it('extracts a server message from a rejected JSON blob response', async () => {
    const getCallLogExportErrorMessage = (
      callLogExport as typeof callLogExport & {
        getCallLogExportErrorMessage?: (error: unknown) => Promise<string>;
      }
    ).getCallLogExportErrorMessage;
    expect(getCallLogExportErrorMessage).toBeTypeOf('function');
    if (!getCallLogExportErrorMessage) {
      throw new Error('missing getCallLogExportErrorMessage');
    }

    const blob = new Blob(
      [JSON.stringify({ data: { message: '导出数量超过限制' } })],
      { type: 'application/json' },
    );
    await expect(getCallLogExportErrorMessage(blob)).resolves.toBe(
      '导出数量超过限制',
    );
  });

  it('rejects an HTML page instead of downloading it as a CSV file', async () => {
    const blob = new Blob(['<!doctype html><html></html>'], {
      type: 'text/html',
    });

    await expect(validateCallLogExportBlob(blob)).rejects.toThrow(
      'CALL_LOG_EXPORT_INVALID_RESPONSE',
    );
  });

  it('rejects empty or non-blob responses', async () => {
    await expect(
      validateCallLogExportBlob(new Blob([], { type: 'text/csv' })),
    ).rejects.toThrow('CALL_LOG_EXPORT_EMPTY_RESPONSE');
    await expect(validateCallLogExportBlob({ code: 0 })).rejects.toThrow(
      'CALL_LOG_EXPORT_INVALID_RESPONSE',
    );
  });

  it('always removes the anchor and revokes its object URL when download fails', async () => {
    const downloadCallLogExportBlob = (
      callLogExport as typeof callLogExport & {
        downloadCallLogExportBlob?: (
          response: unknown,
          filename: string,
        ) => Promise<void>;
      }
    ).downloadCallLogExportBlob;
    expect(downloadCallLogExportBlob).toBeTypeOf('function');
    if (!downloadCallLogExportBlob) {
      throw new Error('missing downloadCallLogExportBlob');
    }

    const createObjectURL = vi.fn(() => 'blob:call-log-export');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => {
      throw new Error('download click failed');
    });
    const remove = vi.spyOn(anchor, 'remove');
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    const append = vi.spyOn(document.body, 'append');

    const blob = new Blob(['id,time\n1,2026-08-15'], { type: 'text/csv' });
    await expect(
      downloadCallLogExportBlob(blob, 'call-logs.csv'),
    ).rejects.toThrow('download click failed');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(append).toHaveBeenCalledWith(anchor);
    expect(anchor.download).toBe('call-logs.csv');
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:call-log-export');
  });

  it('defers object URL revocation until the browser has accepted the download', async () => {
    vi.useFakeTimers();
    const { downloadCallLogExportBlob } = callLogExport;
    const createObjectURL = vi.fn(() => 'blob:call-log-export');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    const remove = vi.spyOn(anchor, 'remove');
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);

    const blob = new Blob(['id,time\n1,2026-08-15'], { type: 'text/csv' });
    await downloadCallLogExportBlob(blob, 'call-logs.csv');

    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });
});
