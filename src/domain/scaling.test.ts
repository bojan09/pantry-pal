import { describe, expect, it } from 'vitest';
import { clampServings, displayAmount, formatAmount, isNonLinear, toFraction } from './scaling';

describe('toFraction', () => {
  it('uses kitchen fractions', () => {
    expect(toFraction(1.5)).toBe('1½');
    expect(toFraction(0.25)).toBe('¼');
    expect(toFraction(2 / 3)).toBe('⅔');
    expect(toFraction(0.34)).toBe('⅓');
    expect(toFraction(3)).toBe('3');
    expect(toFraction(0.99)).toBe('1');
    expect(toFraction(2.97)).toBe('3');
    expect(toFraction(0)).toBe('0');
  });
});

describe('formatAmount', () => {
  it('rounds grams to sensible steps and promotes to kg', () => {
    expect(formatAmount(247, 'g')).toBe('245 g');
    expect(formatAmount(37.4, 'g')).toBe('37 g');
    expect(formatAmount(1250, 'g')).toBe('1.25 kg');
    expect(formatAmount(1500, 'ml')).toBe('1.5 l'.replace('l', 'L'));
  });
  it('uses fractions and plurals for spoons, cups and counts', () => {
    expect(formatAmount(1.5, 'cup', 'imperial')).toBe('1½ cups');
    expect(formatAmount(1.5, 'cup')).toBe('355 ml');
    expect(formatAmount(0.5, 'tsp')).toBe('½ tsp');
    expect(formatAmount(2, 'can')).toBe('2 cans');
    expect(formatAmount(1, 'can')).toBe('1 can');
    expect(formatAmount(1.5, 'jar-m')).toBe('1½ medium jars');
    expect(formatAmount(3, 'pcs')).toBe('3 pcs');
  });
  it('says "a pinch" for negligible spoon amounts', () => {
    expect(formatAmount(0.03, 'tsp')).toBe('a pinch of');
  });
  it('converts mass and volume to the preferred system, never counts', () => {
    expect(formatAmount(500, 'g', 'imperial')).toBe('1.1 lb');
    expect(formatAmount(100, 'g', 'imperial')).toBe('3.5 oz');
    expect(displayAmount(250, 'ml', 'imperial').unit).toBe('cup');
    expect(formatAmount(2, 'pcs', 'imperial')).toBe('2 pcs');
    expect(formatAmount(1, 'tbsp', 'imperial')).toBe('1 tbsp');
    expect(formatAmount(1, 'lb', 'metric')).toBe('455 g');
  });
  it('leaves unknown units alone', () => {
    expect(formatAmount(2, 'handful')).toBe('2 handful');
  });
});

describe('isNonLinear / clampServings', () => {
  it('flags spices and leavening', () => {
    expect(isNonLinear('Spices & Herbs', 'Cumin')).toBe(true);
    expect(isNonLinear('Baking', 'Yeast')).toBe(true);
    expect(isNonLinear('Vegetables', 'Salt')).toBe(true);
    expect(isNonLinear('Vegetables', 'Onions')).toBe(false);
  });
  it('clamps servings to 1..100', () => {
    expect(clampServings(0)).toBe(1);
    expect(clampServings(2.4)).toBe(2);
    expect(clampServings(500)).toBe(100);
  });
});
