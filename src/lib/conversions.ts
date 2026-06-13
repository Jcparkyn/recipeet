import type { Quantity } from './types';

export const VOLUME_TO_ML: Record<string, number> = {
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

export const WEIGHT_TO_G: Record<string, number> = {
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

export function lookupDensity(name: string): number | undefined {
  const key = name.toLowerCase().trim();
  if (DENSITIES[key]) return DENSITIES[key];
  for (const [known, density] of Object.entries(DENSITIES)) {
    if (key.includes(known) || known.includes(key)) return density;
  }
  return undefined;
}

export function isVolumeUnit(unit: string): boolean {
  const u = unit.toLowerCase().trim();
  return u in VOLUME_TO_ML;
}

export function isWeightUnit(unit: string): boolean {
  const u = unit.toLowerCase().trim();
  return u in WEIGHT_TO_G;
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
      ? { quantity: round(qty.value / 1000), unit: 'kg' }
      : { quantity: round(qty.value), unit: 'g' };
  }
  if (qty.kind === 'ml') {
    return qty.value >= 1000
      ? { quantity: round(qty.value / 1000), unit: 'l' }
      : { quantity: round(qty.value), unit: 'ml' };
  }
  return { quantity: round(qty.value), unit: '' };
}

export interface Conversion {
  unit: string;
  value: number;
  label: string;
}

export function getConversions(
  qty: Quantity,
  ingredientName?: string,
): Conversion[] {
  const results: Conversion[] = [];

  if (qty.kind === 'ml') {
    const ml = qty.value;
    results.push({ unit: 'ml', value: round(ml), label: `${round(ml)} ml` });
    if (ml >= 1000) {
      results.push({ unit: 'l', value: round(ml / 1000), label: `${round(ml / 1000)} l` });
    }
    for (const [u, factor] of Object.entries(VOLUME_TO_ML)) {
      if (u === 'ml' || u === 'l') continue;
      if (u === 'gallon' && ml < 1000) continue;
      if (u === 'quart' && ml < 200) continue;
      if (u === 'pint' && ml < 100) continue;
      results.push({ unit: u, value: round(ml / factor), label: `${round(ml / factor)} ${u}` });
    }
    if (ingredientName) {
      const density = lookupDensity(ingredientName);
      if (density) {
        const g = ml * density;
        results.push({ unit: 'g', value: round(g), label: `${round(g)} g` });
        if (g >= 1000)
          results.push({ unit: 'kg', value: round(g / 1000), label: `${round(g / 1000)} kg` });
        for (const [u, factor] of Object.entries(WEIGHT_TO_G)) {
          if (u === 'g' || u === 'kg') continue;
          if (u === 'lb' && g < 50) continue;
          results.push({ unit: u, value: round(g / factor), label: `${round(g / factor)} ${u}` });
        }
      }
    }
  } else if (qty.kind === 'gram') {
    const g = qty.value;
    results.push({ unit: 'g', value: round(g), label: `${round(g)} g` });
    if (g >= 1000)
      results.push({ unit: 'kg', value: round(g / 1000), label: `${round(g / 1000)} kg` });
    for (const [u, factor] of Object.entries(WEIGHT_TO_G)) {
      if (u === 'g' || u === 'kg') continue;
      if (u === 'lb' && g < 50) continue;
      results.push({ unit: u, value: round(g / factor), label: `${round(g / factor)} ${u}` });
    }
    if (ingredientName) {
      const density = lookupDensity(ingredientName);
      if (density) {
        const ml = g / density;
        results.push({ unit: 'ml', value: round(ml), label: `${round(ml)} ml` });
        if (ml >= 1000)
          results.push({ unit: 'l', value: round(ml / 1000), label: `${round(ml / 1000)} l` });
        for (const [u, factor] of Object.entries(VOLUME_TO_ML)) {
          if (u === 'ml' || u === 'l') continue;
          results.push({
            unit: u,
            value: round(ml / factor),
            label: `${round(ml / factor)} ${u}`,
          });
        }
      }
    }
  }

  const seen = new Set<string>();
  return results.filter((c) => {
    if (IMPERIAL_UNITS.has(c.unit)) return false;
    const d = displayQuantity(qty);
    if (c.label === `${d.quantity} ${d.unit}`) return false;
    if (seen.has(c.unit)) return false;
    seen.add(c.unit);
    return true;
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

const AU_TBSP_ML = 20;
const METRIC_CUP_ML = 250;

const IMPERIAL_UNITS = new Set(['floz', 'pint', 'quart', 'gallon', 'oz', 'lb']);

export interface UnitDisplay {
  quantity: number;
  unit: string;
}

export function getToggledDisplay(
  qty: Quantity,
  displayUnit: string,
  modeIndex: number,
  ingredientName?: string,
): { display: UnitDisplay; totalModes: number } {
  let baseG: number | null = null;
  let baseMl: number | null = null;

  if (qty.kind === 'gram') {
    baseG = qty.value;
  } else if (qty.kind === 'ml') {
    baseMl = qty.value;
  }

  if (ingredientName) {
    const density = lookupDensity(ingredientName);
    if (density) {
      if (baseG !== null && baseMl === null) baseMl = baseG / density;
      else if (baseMl !== null && baseG === null) baseG = baseMl * density;
    }
  }

  const original = unitDisplayFromRaw(
    qty.kind === 'gram' ? qty.value : qty.kind === 'ml' ? qty.value : qty.value,
    displayUnit,
    qty.kind,
  );

  const availableModes: UnitDisplay[] = [original];

  function sameDisplay(a: UnitDisplay, b: UnitDisplay) {
    return a.unit === b.unit && Math.abs(a.quantity - b.quantity) < 0.005;
  }

  function addWeight(g: number) {
    const d = g < 1000
      ? { quantity: round(g), unit: 'g' as const }
      : { quantity: round(g / 1000), unit: 'kg' as const };
    if (!sameDisplay(d, original)) availableModes.push(d);
  }

  function addVolume(ml: number) {
    const d = ml < 1000
      ? { quantity: round(ml), unit: 'ml' as const }
      : { quantity: round(ml / 1000), unit: 'l' as const };
    if (!sameDisplay(d, original)) availableModes.push(d);
  }

  function addHousehold(ml: number) {
    let d: UnitDisplay;
    if (ml < 10) d = { quantity: round(ml / 5), unit: 'tsp' };
    else if (ml < 60) d = { quantity: round(ml / AU_TBSP_ML), unit: 'tbsp' };
    else d = { quantity: round(ml / METRIC_CUP_ML), unit: 'cup' };
    if (!sameDisplay(d, original)) availableModes.push(d);
  }

  if (baseG !== null) addWeight(baseG);
  if (baseMl !== null) addVolume(baseMl);
  if (baseMl !== null) addHousehold(baseMl);

  const clampedIndex = ((modeIndex % availableModes.length) + availableModes.length) % availableModes.length;
  return {
    display: availableModes[clampedIndex],
    totalModes: availableModes.length,
  };
}

function unitDisplayFromRaw(value: number, unit: string, kind: Quantity['kind']): UnitDisplay {
  if (kind === 'gram') {
    if (unit in WEIGHT_TO_G) {
      return { quantity: round(value / WEIGHT_TO_G[unit]), unit };
    }
    return { quantity: round(value), unit: 'g' };
  }
  if (kind === 'ml') {
    if (unit in VOLUME_TO_ML) {
      return { quantity: round(value / VOLUME_TO_ML[unit]), unit };
    }
    return { quantity: round(value), unit: 'ml' };
  }
  return { quantity: round(value), unit };
}
