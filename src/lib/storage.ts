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

export const [recipes, setRecipes] = createStore<Recipe[]>(
  loadJson(RECIPES_KEY, []),
);

export const [progresses, setProgress] = createStore<RecipeProgress[]>(
  loadJson(PROGRESS_KEY, []),
);

export const [settings, setSettings] = createSignal<LLMSettings>(
  loadJson(SETTINGS_KEY, DEFAULT_LLM_SETTINGS),
);

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
  setRecipes([recipe, ...recipes]);
  setProgress([
    {
      recipeId: recipe.id,
      currentServings: recipe.content.originalServings,
      checkedShoppingItems: [],
      checkedSteps: [],
      checkedSubsteps: [],
      currentCookingStep: 0,
    },
    ...progresses,
  ]);
}

export function removeRecipe(id: string) {
  setRecipes(produce((r) => r.filter((p) => p.id !== id)));
  setProgress(produce((p) => p.filter((p) => p.recipeId !== id)));
}

export function getProgress(recipeId: string): RecipeProgress | undefined {
  return progresses.find((p) => p.recipeId === recipeId);
}

export function updateProgress(recipeId: string, patch: Partial<RecipeProgress>) {
  setProgress(
    produce((p) => {
      const idx = p.findIndex((x) => x.recipeId === recipeId);
      if (idx !== -1) Object.assign(p[idx], patch);
      else if (patch.recipeId) p.push(patch as RecipeProgress);
    }),
  );
}

export function clearAll() {
  localStorage.removeItem(RECIPES_KEY);
  localStorage.removeItem(PROGRESS_KEY);
  setRecipes([]);
  setProgress([]);
}
