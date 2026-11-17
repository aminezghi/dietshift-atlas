// @vitest-environment jsdom
import '../test/setupDom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  downloadCsvContent,
  downloadJsonPayload,
  escapeCsvCell,
  serializeCsvTable,
  triggerBlobDownload,
} from './exportDownload';

async function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return blob.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('Phase 5C shared exportDownload utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('escapes special characters and serializes optional comment provenance headers cleanly', () => {
    expect(escapeCsvCell('simple')).toBe('simple');
    expect(escapeCsvCell('quote "here", comma')).toBe('"quote ""here"", comma"');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell(0)).toBe('0');
    expect(escapeCsvCell(null)).toBe('');

    const out = serializeCsvTable(
      ['Code', 'Notes', 'Value'],
      [
        ['IT', 'Includes "DOP", CSV-safe', 0],
        ['FR', null, 12.5],
      ],
      ['# Header Line 1']
    );
    expect(out).toBe(
      '# Header Line 1\nCode,Notes,Value\nIT,"Includes ""DOP"", CSV-safe",0\nFR,,12.5'
    );
  });

  it('triggers anchor download with exact Blob payload and cleans up object URLs', async () => {
    vi.useFakeTimers();
    const capturedBlobs: Blob[] = [];
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      capturedBlobs.push(obj as Blob);
      return 'blob:captured-export';
    });
    const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    triggerBlobDownload('a,b\n1,2', 'text/csv;charset=utf-8;', 'sample.csv');
    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(await readBlobText(capturedBlobs[0])).toBe('a,b\n1,2');

    vi.advanceTimersByTime(1000);
    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:captured-export');

    downloadCsvContent('col\nval', 'table.csv');
    expect(capturedBlobs[1].type).toContain('text/csv');
    expect(await readBlobText(capturedBlobs[1])).toBe('col\nval');

    downloadJsonPayload({ ok: true, count: 4 }, 'payload.json');
    expect(capturedBlobs[2].type).toContain('application/json');
    expect(JSON.parse(await readBlobText(capturedBlobs[2]))).toEqual({ ok: true, count: 4 });
  });
});
