export function scaleQuantity(
  quantity: number,
  originalServings: number,
  targetServings: number,
): number {
  if (originalServings <= 0) return quantity;
  const scaled = quantity * (targetServings / originalServings);
  const rounded = Math.round(scaled * 100) / 100;
  return rounded;
}

export function formatQuantity(qty: number): string {
  return qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2).replace(/0+$/, '');
}
