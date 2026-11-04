/**
 * CSV for spreadsheets. Cells that start with = + - @ (or a tab/CR) are prefixed with an
 * apostrophe so a spreadsheet cannot run them as a formula (CSV injection). Numbers pass
 * through untouched.
 */
export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = typeof v === 'boolean' ? (v ? 'yes' : 'no') : v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(
  header: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  // BOM so Excel reads UTF-8; CRLF per RFC 4180
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function download(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
