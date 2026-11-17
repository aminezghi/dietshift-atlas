/**
 * Shared CSV escaping, serialization, and client-side Blob download utilities.
 * Extracted in Phase 5B (M-05) without changing export formats or column schemas.
 */

export function escapeCsvCell(v: string | number | boolean | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function serializeCsvTable(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null | undefined>>,
  commentLines?: readonly string[]
): string {
  const prefix = commentLines && commentLines.length > 0 ? [...commentLines] : [];
  return [
    ...prefix,
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ].join('\n');
}

export function triggerBlobDownload(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsvContent(content: string, filename: string): void {
  triggerBlobDownload(content, 'text/csv;charset=utf-8;', filename);
}

export function downloadJsonPayload(payload: unknown, filename: string): void {
  triggerBlobDownload(
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8;',
    filename
  );
}
