import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, loadPrefs, savePrefs } from './prefs';

const fakeStorage = (initial?: string) => {
  let v = initial ?? null;
  return {
    getItem: () => v,
    setItem: (_k: string, val: string) => {
      v = val;
    },
  };
};

describe('prefs', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadPrefs(fakeStorage())).toEqual(DEFAULT_PREFS);
  });

  it('round-trips saved prefs', () => {
    const s = fakeStorage();
    savePrefs({ ...DEFAULT_PREFS, accent: 'sage', onboarded: true, name: 'Bojan' }, s);
    const loaded = loadPrefs(s);
    expect(loaded.accent).toBe('sage');
    expect(loaded.name).toBe('Bojan');
    expect(loaded.onboarded).toBe(true);
  });

  it('keeps valid fields and drops invalid ones', () => {
    const s = fakeStorage(JSON.stringify({ accent: 'neon', currency: 'EUR', bgDim: 999 }));
    const loaded = loadPrefs(s);
    expect(loaded.accent).toBe(DEFAULT_PREFS.accent);
    expect(loaded.currency).toBe('EUR');
    expect(loaded.bgDim).toBe(DEFAULT_PREFS.bgDim);
  });

  it('survives corrupt JSON and missing storage', () => {
    expect(loadPrefs(fakeStorage('{not json'))).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
  });
});
