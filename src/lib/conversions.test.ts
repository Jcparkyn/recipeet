import { describe, it, expect } from 'vitest';
import { getAvailableModes } from './conversions';
import type { Quantity } from './types';

function qty(value: number, kind: Quantity['kind']): Quantity {
  return { value, kind };
}

describe('getAvailableModes', () => {
  describe('volume-only (no density)', () => {
    it('5ml → household (1 tsp) first, then volume', () => {
      const modes = getAvailableModes(qty(5, 'ml'));
      expect(modes).toHaveLength(2);
      expect(modes[0]).toEqual({ quantity: 1, unit: 'tsp' });
      expect(modes[1]).toEqual({ quantity: 5, unit: 'ml' });
    });

    it('15ml → household (3 tsp) first, then volume', () => {
      const modes = getAvailableModes(qty(15, 'ml'));
      expect(modes).toHaveLength(2);
      expect(modes[0]).toEqual({ quantity: 3, unit: 'tsp' });
      expect(modes[1]).toEqual({ quantity: 15, unit: 'ml' });
    });

    it('20ml → household (1 tbsp) first, then volume', () => {
      const modes = getAvailableModes(qty(20, 'ml'));
      expect(modes).toHaveLength(2);
      expect(modes[0]).toEqual({ quantity: 1, unit: 'tbsp' });
      expect(modes[1]).toEqual({ quantity: 20, unit: 'ml' });
    });

    it('80ml → household (4 tbsp) first, then volume', () => {
      const modes = getAvailableModes(qty(80, 'ml'));
      expect(modes).toHaveLength(2);
      expect(modes[0]).toEqual({ quantity: 4, unit: 'tbsp' });
      expect(modes[1]).toEqual({ quantity: 80, unit: 'ml' });
    });

    it('100ml (>80) → volume first, household (cup) last, no reorder', () => {
      const modes = getAvailableModes(qty(100, 'ml'));
      expect(modes).toHaveLength(2);
      expect(modes[0]).toEqual({ quantity: 100, unit: 'ml' });
      expect(modes[1]).toEqual({ quantity: 100 / 250, unit: 'cup' });
    });

    it('1000ml (>80) → volume first, household (cup) last', () => {
      const modes = getAvailableModes(qty(1000, 'ml'));
      expect(modes).toHaveLength(2);
      expect(modes[0]).toEqual({ quantity: 1, unit: 'l' });
      expect(modes[1]).toEqual({ quantity: 1000 / 250, unit: 'cup' });
    });
  });

  describe('weight-only (no density)', () => {
    it('500g → just weight', () => {
      const modes = getAvailableModes(qty(500, 'gram'));
      expect(modes).toHaveLength(1);
      expect(modes[0]).toEqual({ quantity: 500, unit: 'g' });
    });

    it('1500g → kg', () => {
      const modes = getAvailableModes(qty(1500, 'gram'));
      expect(modes).toHaveLength(1);
      expect(modes[0]).toEqual({ quantity: 1.5, unit: 'kg' });
    });
  });

  describe('with density (flour, 0.53)', () => {
    const flourDensity = 0.53;

    it('5ml → household (1 tsp) first, then volume, then weight', () => {
      const modes = getAvailableModes(qty(5, 'ml'), flourDensity);
      expect(modes).toHaveLength(3);
      expect(modes[0]).toEqual({ quantity: 1, unit: 'tsp' });
      expect(modes[1]).toEqual({ quantity: 5, unit: 'ml' });
      expect(modes[2].unit).toBe('g');
      expect(modes[2].quantity).toBeCloseTo(2.65, 2);
    });

    it('20ml → household (1 tbsp) first, then volume, then weight', () => {
      const modes = getAvailableModes(qty(20, 'ml'), flourDensity);
      expect(modes).toHaveLength(3);
      expect(modes[0]).toEqual({ quantity: 1, unit: 'tbsp' });
      expect(modes[1]).toEqual({ quantity: 20, unit: 'ml' });
      expect(modes[2].unit).toBe('g');
      expect(modes[2].quantity).toBeCloseTo(10.6, 2);
    });

    it('300ml (>80) → volume first (original was volume), then weight, household last', () => {
      const modes = getAvailableModes(qty(300, 'ml'), flourDensity);
      expect(modes).toHaveLength(3);
      expect(modes[0]).toEqual({ quantity: 300, unit: 'ml' });
      expect(modes[1]).toEqual({ quantity: 159, unit: 'g' });
      expect(modes[2]).toEqual({ quantity: 1.2, unit: 'cup' });
    });

    it('500g → weight, volume, household (no reorder, weight-first ingredient)', () => {
      const modes = getAvailableModes(qty(500, 'gram'), flourDensity);
      expect(modes).toHaveLength(3);
      expect(modes[0]).toEqual({ quantity: 500, unit: 'g' });
      expect(modes[1].unit).toBe('ml');
      expect(modes[1].quantity).toBeCloseTo(500 / flourDensity, 2);
      expect(modes[2]).toEqual({ quantity: (500 / flourDensity) / 250, unit: 'cup' });
    });
  });

  describe('count items', () => {
    it('returns empty for count items', () => {
      const modes = getAvailableModes(qty(3, 'count'));
      expect(modes).toHaveLength(0);
    });
  });
});
