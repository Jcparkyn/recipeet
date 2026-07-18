import { createStore, produce } from 'solid-js/store';
import { createSignal } from 'solid-js';
import type { Recipe, RecipeProgress, LLMSettings } from './types';
import { DEFAULT_LLM_SETTINGS } from './types';

const RECIPES_KEY = 'recipeet:recipes';
const PROGRESS_KEY = 'recipeet:progress';
const SETTINGS_KEY = 'recipeet:settings';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function migrateProgress(p: RecipeProgress): RecipeProgress {
  if (!p.ingredientUnitModes) p.ingredientUnitModes = {};
  if (!p.chatMessages) p.chatMessages = [];
  return p;
}

export const [recipes, setRecipes] = createStore<Recipe[]>(
  loadJson(RECIPES_KEY, []),
);

export const [progresses, setProgress] = createStore<RecipeProgress[]>(
  loadJson<RecipeProgress[]>(PROGRESS_KEY, []).map(migrateProgress),
);

export const [settings, setInternalSettings] = createSignal<LLMSettings>(
  { ...DEFAULT_LLM_SETTINGS, ...loadJson<Partial<LLMSettings>>(SETTINGS_KEY, {}) },
);

export function setSettings(s: LLMSettings) {
  setInternalSettings(s);
  persistSettings();
}

export function persistRecipes() {
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
}

export function persistProgress() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progresses));
}

export function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings()));
}

export function addRecipe(recipe: Recipe) {
  setRecipes(produce((arr) => { arr.unshift(recipe); }));
  setProgress(produce((arr) => {
    arr.unshift({
      recipeId: recipe.id,
      currentServings: recipe.content.originalServings,
      checkedShoppingItems: [],
      checkedSteps: [],
      checkedIngredients: [],
      ingredientUnitModes: {},
      currentCookingSection: 0,
      chatMessages: [],
    });
  }));
  persistRecipes();
  persistProgress();
}

export function updateRecipe(id: string, mutate: (r: Recipe) => void) {
  setRecipes(produce((arr) => {
    const idx = arr.findIndex((recipe) => recipe.id === id);
    if (idx !== -1) {
      mutate(arr[idx]);
      arr[idx].updatedAt = Date.now();
    }
  }));
  persistRecipes();
}

export function removeRecipe(id: string) {
  setRecipes(produce((r) => {
    const idx = r.findIndex((recipe) => recipe.id === id);
    if (idx !== -1) r.splice(idx, 1);
  }));
  setProgress(produce((p) => {
    const idx = p.findIndex((prog) => prog.recipeId === id);
    if (idx !== -1) p.splice(idx, 1);
  }));
  persistRecipes();
  persistProgress();
}

export function getProgress(recipeId: string): RecipeProgress | undefined {
  return progresses.find((p) => p.recipeId === recipeId);
}

export function updateProgress(recipeId: string, mutate: (p: RecipeProgress) => void) {
  setProgress(
    produce((arr) => {
      const idx = arr.findIndex((x) => x.recipeId === recipeId);
      if (idx !== -1) mutate(arr[idx]);
    }),
  );
  persistProgress();
}

export function clearAll() {
  localStorage.removeItem(RECIPES_KEY);
  localStorage.removeItem(PROGRESS_KEY);
  setRecipes([]);
  setProgress([]);
  persistRecipes();
  persistProgress();
}
