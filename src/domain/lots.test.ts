import { describe, expect, it } from 'vitest';
import type { InventoryLot } from '@/data/types';
import {
  byFirstExpiring,
  daysUntil,
  expiryStatus,
  isLowStock,
  planConsume,
  statusText,
  totalsFor,
} from './lots';
import { canConvert, convert, formatBase, formatQuantity } from './units';

let n = 0;
const lot = (p: Partial<InventoryLot>): InventoryLot => ({
  id: `l${++n}`,
  ingredientId: 'i',
  quantity: 1,
  unit: 'g',
  zone: 'pantry',
  dateLabel: 'unknown',
  createdAt: n,
  updatedAt: n,
  ...p,
});

describe('units', () => {
  it('converts within a dimension', () => {
    expect(convert(1.5, 'kg', 'g')).toBe(1500);
    expect(convert(1, 'lb', 'oz')).toBeCloseTo(16, 6);
    expect(convert(1, 'cup', 'ml')).toBeCloseTo(236.588, 2);
    expect(convert(3, 'tsp', 'tbsp')).toBeCloseTo(1, 6);
  });
  it('refuses mass<->volume without density and converts with one', () => {
    expect(convert(100, 'g', 'ml')).toBeNull();
    expect(convert(100, 'g', 'ml', 0.5)).toBe(200);
    expect(convert(200, 'ml', 'g', 0.5)).toBe(100);
    expect(canConvert('ml', 'g')).toBe(false);
  });
  it('never converts between different count units or count and mass', () => {
    expect(convert(1, 'can', 'pcs')).toBeNull();
    expect(convert(1, 'jar-s', 'jar-l')).toBeNull();
    expect(convert(2, 'pcs', 'pcs')).toBe(2);
    expect(convert(1, 'pcs', 'g', 1)).toBeNull();
  });
  it('rejects unknown units and non-finite numbers', () => {
    expect(convert(1, 'stone', 'g')).toBeNull();
    expect(convert(NaN, 'g', 'kg')).toBeNull();
  });
  it('formats readable amounts for both systems', () => {
    expect(formatBase(1500, 'mass', 'metric')).toBe('1.5 kg');
    expect(formatBase(250, 'mass', 'metric')).toBe('250 g');
    expect(formatBase(453.59237, 'mass', 'imperial')).toBe('1 lb');
    expect(formatBase(100, 'mass', 'imperial')).toBe('3.5 oz');
    expect(formatBase(2500, 'volume', 'metric')).toBe('2.5 L');
    expect(formatQuantity(0.1 + 0.2, 'kg')).toBe('0.3 kg');
    expect(formatQuantity(1, 'jar-m')).toBe('1 medium jar');
    expect(formatQuantity(3, 'jar-s')).toBe('3 small jars');
    expect(formatQuantity(2, 'can')).toBe('2 cans');
    expect(formatQuantity(2, 'pcs')).toBe('2 pcs');
  });
});

describe('totalsFor', () => {
  it('sums compatible lots across units', () => {
    const t = totalsFor([
      lot({ quantity: 1, unit: 'kg' }),
      lot({ quantity: 500, unit: 'g' }),
      lot({ quantity: 1, unit: 'lb' }),
    ]);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ key: 'mass', unit: 'g' });
    expect(t[0].base).toBeCloseTo(1953.59237, 4);
  });
  it('keeps mass, volume and each count unit separate', () => {
    const t = totalsFor([
      lot({ quantity: 200, unit: 'g' }),
      lot({ quantity: 1, unit: 'l' }),
      lot({ quantity: 3, unit: 'pcs' }),
      lot({ quantity: 2, unit: 'can' }),
    ]);
    expect(t.map((a) => a.key).sort()).toEqual(['count:can', 'count:pcs', 'mass', 'volume']);
    // display order is weight, volume, then counts in unit-list order
    expect(
      totalsFor([lot({ quantity: 1, unit: 'jar-l' }), lot({ quantity: 2, unit: 'jar-s' })]).map(
        (a) => a.key,
      ),
    ).toEqual(['count:jar-s', 'count:jar-l']);
    expect(t.map((a) => a.key)).toEqual(['mass', 'volume', 'count:pcs', 'count:can']);
  });
});

describe('expiry', () => {
  const today = '2025-10-20';
  it('counts calendar days across month/year boundaries', () => {
    expect(daysUntil('2025-10-22', today)).toBe(2);
    expect(daysUntil('2026-01-01', '2025-12-31')).toBe(1);
    expect(daysUntil('2025-10-19', today)).toBe(-1);
  });
  it('classifies lots at the boundaries', () => {
    const base = { dateLabel: 'use_by' as const };
    expect(expiryStatus({ ...base, date: '2025-10-19' }, today, 3)).toBe('expired');
    expect(expiryStatus({ ...base, date: '2025-10-20' }, today, 3)).toBe('soon');
    expect(expiryStatus({ ...base, date: '2025-10-23' }, today, 3)).toBe('soon');
    expect(expiryStatus({ ...base, date: '2025-10-24' }, today, 3)).toBe('ok');
    expect(expiryStatus({ dateLabel: 'unknown', date: '2025-10-20' }, today, 3)).toBe('none');
    expect(expiryStatus({ dateLabel: 'best_before' }, today, 3)).toBe('none');
  });
  it('words use-by and best-before differently and never claims safety', () => {
    expect(statusText({ dateLabel: 'use_by', date: '2025-10-18' }, today, 3)).toBe(
      'Past use-by date by 2 days',
    );
    expect(statusText({ dateLabel: 'best_before', date: '2025-10-18' }, today, 3)).toBe(
      'Past best-before date by 2 days',
    );
    expect(statusText({ dateLabel: 'best_before', date: '2025-10-21' }, today, 3)).toBe(
      '1 day to best-before date',
    );
    expect(statusText({ dateLabel: 'unknown' }, today, 3)).toBe('No date logged');
  });
  it('orders earliest first with undated last', () => {
    const a = lot({ dateLabel: 'use_by', date: '2025-11-01' });
    const b = lot({ dateLabel: 'best_before', date: '2025-10-25' });
    const c = lot({});
    expect([a, c, b].sort(byFirstExpiring)).toEqual([b, a, c]);
  });
});

describe('isLowStock', () => {
  it('compares combined compatible stock to the threshold', () => {
    const lots = [
      lot({ quantity: 100, unit: 'g', lowStockThreshold: 250 }),
      lot({ quantity: 0.1, unit: 'kg' }),
    ];
    expect(isLowStock(lots)).toBe(true); // 200 g <= 250 g
    expect(isLowStock([lot({ quantity: 300, unit: 'g', lowStockThreshold: 250 })])).toBe(false);
  });
  it('ignores stock in incompatible units', () => {
    const lots = [
      lot({ quantity: 100, unit: 'g', lowStockThreshold: 150 }),
      lot({ quantity: 5, unit: 'pcs' }),
    ];
    expect(isLowStock(lots)).toBe(true);
  });
  it('is false without thresholds', () => {
    expect(isLowStock([lot({ quantity: 1 })])).toBe(false);
  });
});

describe('planConsume', () => {
  it('takes from the earliest-dated lot first and spans lots', () => {
    const late = lot({ quantity: 500, dateLabel: 'best_before', date: '2025-12-01' });
    const soon = lot({ quantity: 200, dateLabel: 'use_by', date: '2025-10-25' });
    const none = lot({ quantity: 1000 });
    const plan = planConsume([late, none, soon], 300, 'g');
    expect(plan).toEqual({
      ok: true,
      steps: [
        { lotId: soon.id, take: 200, remaining: 0 },
        { lotId: late.id, take: 100, remaining: 400 },
      ],
    });
  });
  it('converts across units and reports remaining in the lot unit', () => {
    const l = lot({ quantity: 2, unit: 'kg' });
    expect(planConsume([l], 500, 'g')).toEqual({
      ok: true,
      steps: [{ lotId: l.id, take: 0.5, remaining: 1.5 }],
    });
  });
  it('reports insufficient stock with what is available', () => {
    expect(planConsume([lot({ quantity: 100 })], 150, 'g')).toEqual({
      ok: false,
      reason: 'insufficient',
      available: 100,
    });
  });
  it('refuses incompatible units instead of guessing', () => {
    expect(planConsume([lot({ quantity: 100, unit: 'g' })], 1, 'pcs')).toEqual({
      ok: false,
      reason: 'incompatible',
    });
    expect(planConsume([lot({ quantity: 100, unit: 'g' })], 100, 'ml')).toEqual({
      ok: false,
      reason: 'incompatible',
    });
  });
  it('uses density when provided', () => {
    const l = lot({ quantity: 1, unit: 'l' });
    expect(planConsume([l], 500, 'g', 1)).toMatchObject({ ok: true });
  });
  it('rejects zero, negative and NaN', () => {
    for (const q of [0, -1, NaN])
      expect(planConsume([lot({})], q, 'g')).toEqual({ ok: false, reason: 'invalid' });
  });
  it('does not accumulate float error when consuming exactly everything', () => {
    const ls = [lot({ quantity: 0.1 }), lot({ quantity: 0.2 })];
    const plan = planConsume(ls, 0.3, 'g');
    expect(plan.ok && plan.steps.every((s) => s.remaining === 0)).toBe(true);
  });
});
