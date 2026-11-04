import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('plain')).toBe('plain');
  });
  it('neutralises spreadsheet formulas', () => {
    for (const s of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx'])
      expect(csvCell(s).replace(/^"/, '')).toMatch(/^'/);
    expect(csvCell(-5)).toBe('-5'); // real numbers are fine
    expect(csvCell('5 kg')).toBe('5 kg');
  });
  it('handles empties, booleans and non-finite numbers', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(NaN)).toBe('');
    expect(csvCell(true)).toBe('yes');
  });
  it('writes a BOM, CRLF rows and a trailing newline', () => {
    const t = toCsv(
      ['A', 'B'],
      [
        [1, 'x,y'],
        [2, '=cmd'],
      ],
    );
    expect(t).toBe('﻿A,B\r\n1,"x,y"\r\n2,\'=cmd\r\n');
  });
});
