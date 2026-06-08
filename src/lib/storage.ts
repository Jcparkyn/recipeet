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

function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function createRecipeStore() {
  const [recipes, setRecipes] = createStore<Recipe[]>(loadJson(RECIPES_KEY, []));
  const [progresses, setProgress] = createStore<RecipeProgress[]>(loadJson(PROGRESS_KEY, []));
  const [settings, setSettingsStore] = createSignal<LLMSettings>(
    loadJson(SETTINGS_KEY, DEFAULT_LLM_SETTINGS),
  );

  function sync() {
    saveJson(RECIPES_KEY, recipes);
    saveJson(PROGRESS_KEY, progresses);
  }

  function addRecipe(recipe: Recipe) {
    setRecipes([recipe, ...recipes]);
    const progress: RecipeProgress = {
      recipeId: recipe.id,
      currentServings: recipe.content.originalServings,
      checkedShoppingItems: [],
      checkedSteps: [],
      checkedSubsteps: [],
      currentCookingStep: 0,
    };
    setProgress([progress, ...progresses]);
    sync();
  }

  function removeRecipe(id: string) {
    setRecipes(produce((r) => r.filter((p) => p.id !== id)));
    setProgress(produce((p) => p.filter((p) => p.recipeId !== id)));
    sync();
  }

  function getProgress(recipeId: string): RecipeProgress | undefined {
    return progresses.find((p) => p.recipeId === recipeId);
  }

  function updateProgress(recipeId: string, patch: Partial<RecipeProgress>) {
    setProgress(
      produce((p) => {
        const idx = p.findIndex((x) => x.recipeId === recipeId);
        if (idx !== -1) Object.assign(p[idx], patch);
        else if (patch.recipeId) p.push(patch as RecipeProgress);
      }),
    );
    sync();
  }

  function setSettings(s: LLMSettings) {
    setSettingsStore(s);
    saveJson(SETTINGS_KEY, s);
  }

  function clearAll() {
    localStorage.removeItem(RECIPES_KEY);
    localStorage.removeItem(PROGRESS_KEY);
    setRecipes([]);
    setProgress([]);
  }

  return {
    recipes,
    progresses,
    settings,
    addRecipe,
    removeRecipe,
    getProgress,
    updateProgress,
    setSettings,
    clearAll,
  };
}
