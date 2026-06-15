import type { Quantity } from './types';
import { formatQuantity } from './scaling';

const VOLUME_TO_ML: Record<string, number> = {
  tsp: 5,
  tbsp: 20,
  floz: 30,
  cup: 240,
  pint: 480,
  quart: 960,
  gallon: 3840,
  ml: 1,
  l: 1000,
};

const WEIGHT_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.35,
  lb: 453.6,
};

const DENSITIES: Record<string, number> = {
  'all-purpose flour': 0.53,
  'plain flour': 0.53,
  flour: 0.53,
  'bread flour': 0.55,
  'whole wheat flour': 0.53,
  'granulated sugar': 0.85,
  'white sugar': 0.85,
  sugar: 0.85,
  'caster sugar': 0.85,
  'brown sugar': 0.82,
  'powdered sugar': 0.56,
  'icing sugar': 0.56,
  'confectioners sugar': 0.56,
  butter: 0.96,
  margarine: 0.96,
  shortening: 0.85,
  'vegetable oil': 0.92,
  'olive oil': 0.92,
  'canola oil': 0.92,
  'sunflower oil': 0.92,
  oil: 0.92,
  honey: 1.42,
  'maple syrup': 1.37,
  'golden syrup': 1.42,
  'corn syrup': 1.38,
  molasses: 1.42,
  milk: 1.03,
  'heavy cream': 1.01,
  'double cream': 1.01,
  'whipping cream': 1.01,
  cream: 1.01,
  'sour cream': 1.02,
  'cream cheese': 1.02,
  yogurt: 1.05,
  'greek yogurt': 1.05,
  water: 1.0,
  salt: 1.2,
  'table salt': 1.2,
  'kosher salt': 0.9,
  'sea salt': 1.1,
  'baking powder': 0.9,
  'baking soda': 0.9,
  'bicarbonate of soda': 0.9,
  'cocoa powder': 0.5,
  'cacao powder': 0.5,
  cornstarch: 0.5,
  cornflour: 0.5,
  'rice (uncooked)': 0.85,
  rice: 0.85,
  'basmati rice': 0.85,
  'jasmine rice': 0.85,
  oats: 0.4,
  'rolled oats': 0.4,
  'porridge oats': 0.4,
  'peanut butter': 1.3,
  'almond butter': 1.25,
  tahini: 1.15,
  'tomato paste': 1.1,
  'tomato puree': 1.1,
  mayonnaise: 0.95,
  ketchup: 1.05,
  mustard: 1.05,
  'soy sauce': 1.1,
  'fish sauce': 1.05,
  'worcestershire sauce': 1.05,
  vinegar: 1.0,
  'balsamic vinegar': 1.05,
  'apple cider vinegar': 1.0,
  'rice vinegar': 1.0,
  'white wine': 1.0,
  'red wine': 1.0,
  'coconut milk': 1.02,
  'almond milk': 1.0,
  'oat milk': 1.01,
  'soy milk': 1.02,
  'sesame oil': 0.92,
  'coconut oil': 0.92,
  lard: 0.9,
  suet: 0.85,
  'shredded cheese': 0.45,
  'grated cheese': 0.45,
  'parmesan (grated)': 0.45,
  'cheddar (grated)': 0.45,
  'bread crumbs': 0.4,
  panko: 0.25,
  'almond flour': 0.5,
  'ground almonds': 0.5,
  'corn meal': 0.6,
  polenta: 0.6,
  semolina: 0.6,
  'powdered milk': 0.45,
  'milk powder': 0.45,
  'protein powder': 0.45,
  'instant yeast': 0.6,
  'active dry yeast': 0.65,
  'fresh yeast': 1.0,
  gelatin: 0.6,
  'gelatin powder': 0.6,
  agar: 0.55,
};

function lookupDensity(name: string): number | undefined {
  const key = name.toLowerCase().trim();
  if (DENSITIES[key]) return DENSITIES[key];
  for (const [known, density] of Object.entries(DENSITIES)) {
    if (key.includes(known) || known.includes(key)) return density;
  }
  return undefined;
}

export function toQuantity(quantity: number, unit: string): Quantity {
  const u = unit.toLowerCase().trim();
  if (u in VOLUME_TO_ML) {
    return { value: quantity * VOLUME_TO_ML[u], kind: 'ml' };
  }
  if (u in WEIGHT_TO_G) {
    return { value: quantity * WEIGHT_TO_G[u], kind: 'gram' };
  }
  return { value: quantity, kind: 'count' };
}

export function displayQuantity(qty: Quantity): UnitDisplay {
  if (qty.kind === 'gram') {
    return qty.value >= 1000
      ? { quantity: qty.value / 1000, unit: 'kg' }
      : { quantity: qty.value, unit: 'g' };
  }
  if (qty.kind === 'ml') {
    return qty.value >= 1000
      ? { quantity: qty.value / 1000, unit: 'l' }
      : { quantity: qty.value, unit: 'ml' };
  }
  return { quantity: qty.value, unit: '' };
}

interface Conversion {
  unit: string;
  value: number;
  label: string;
}

export function getConversions(
  qty: Quantity,
  ingredientName?: string,
): Conversion[] {
  const results: Conversion[] = [];

  let ml: number | null = null;
  let g: number | null = null;

  if (qty.kind === 'ml') ml = qty.value;
  else if (qty.kind === 'gram') g = qty.value;

  if (ingredientName && (ml !== null || g !== null)) {
    const density = lookupDensity(ingredientName);
    if (density) {
      if (ml !== null && g === null) g = ml * density;
      else if (g !== null && ml === null) ml = g / density;
    }
  }

  if (g !== null) {
    if (g < 1000) {
      results.push({ unit: 'g', value: g, label: `${formatQuantity(g)} g` });
    } else {
      const kg = g / 1000;
      results.push({ unit: 'kg', value: kg, label: `${formatQuantity(kg)} kg` });
    }
  }

  if (ml !== null) {
    if (ml <= 40) {
      const tsp = ml / VOLUME_TO_ML.tsp;
      results.push({ unit: 'tsp', value: tsp, label: `${formatQuantity(tsp)} tsp` });
    }
    if (ml <= 80) {
      const tbsp = ml / VOLUME_TO_ML.tbsp;
      results.push({ unit: 'tbsp', value: tbsp, label: `${formatQuantity(tbsp)} tbsp` });
    }
    if (ml < 1000) {
      results.push({ unit: 'ml', value: ml, label: `${formatQuantity(ml)} ml` });
    } else {
      const l = ml / 1000;
      results.push({ unit: 'l', value: l, label: `${formatQuantity(l)} l` });
    }
  }

  const displayed = displayQuantity(qty);
  return results.filter((c) => c.label !== `${formatQuantity(displayed.quantity)} ${displayed.unit}`);
}

interface UnitDisplay {
  quantity: number;
  unit: string;
}

export function getAvailableModes(qty: Quantity, density?: number): UnitDisplay[] {
  let baseG: number | null = null;
  let baseMl: number | null = null;

  if (qty.kind === 'gram') {
    baseG = qty.value;
  } else if (qty.kind === 'ml') {
    baseMl = qty.value;
  }

  if (density) {
    if (baseG !== null && baseMl === null) baseMl = baseG / density;
    else if (baseMl !== null && baseG === null) baseG = baseMl * density;
  }

  const modes: UnitDisplay[] = [];

  if (baseG !== null) {
    const d = baseG < 1000
      ? { quantity: baseG, unit: 'g' as const }
      : { quantity: baseG / 1000, unit: 'kg' as const };
    modes.push(d);
  }

  if (baseMl !== null) {
    const d = baseMl < 1000
      ? { quantity: baseMl, unit: 'ml' as const }
      : { quantity: baseMl / 1000, unit: 'l' as const };
    if (qty.kind == 'ml') {
      modes.unshift(d);
    } else {
      modes.push(d);
    }
  }

  if (baseMl !== null) {
    let d: UnitDisplay;
    if (baseMl < VOLUME_TO_ML.tbsp) d = { quantity: baseMl / VOLUME_TO_ML.tsp, unit: 'tsp' };
    else if (baseMl <= 80) d = { quantity: baseMl / VOLUME_TO_ML.tbsp, unit: 'tbsp' };
    else d = { quantity: baseMl / VOLUME_TO_ML.cup, unit: 'cup' };
    if (qty.kind === 'ml' && baseMl <= 80) {
      // set as default for small quantities
      modes.unshift(d);
    } else {
      modes.push(d);
    }
  }

  return modes;
}

/**
 * Returns the display for a togglable ingredient quantity.
 *
 * Builds a list of available unit modes (weight via density, volume,
 * household tsp/tbsp/cup) and returns the display at the given mode index.
 * {@link modeIndex} is modulo-wrapped, so callers can increment freely
 * without worrying about bounds.
 *
 * For volume-first ingredients (<=80 ml), the volume mode is moved to the
 * front of the list so ml/L is the default display.
 */
export function getToggledDisplay(
  qty: Quantity,
  displayUnit: string,
  modeIndex: number,
  ingredientName?: string,
): { display: UnitDisplay; totalModes: number } {
  const density = ingredientName ? lookupDensity(ingredientName) : undefined;
  const modes = getAvailableModes(qty, density);

  if (modes.length === 0) {
    return { display: { quantity: qty.value, unit: displayUnit }, totalModes: 0 };
  }

  return {
    display: modes[modeIndex % modes.length],
    totalModes: modes.length,
  };
}
