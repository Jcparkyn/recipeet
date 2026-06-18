import type { Quantity } from './types';

export function scaleQuantity(
  quantity: number | undefined,
  originalServings: number,
  targetServings: number,
): number | undefined {
  if (quantity == null || originalServings <= 0) return quantity;
  const scaled = quantity * (targetServings / originalServings);
  return Math.round(scaled * 100) / 100;
}

export function scaleQuantityValue(
  qty: Quantity,
  originalServings: number,
  targetServings: number,
): Quantity {
  return {
    ...qty,
    value: scaleQuantity(qty.value, originalServings, targetServings) ?? 0,
  };
}

export function formatQuantity(qty: number): string {
  return qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2).replace(/0+$/, '');
}
