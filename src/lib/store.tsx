import { createContext, useContext, type ParentProps } from 'solid-js';
import {
  recipes,
  progresses,
  settings,
  setSettings,
  addRecipe,
  removeRecipe,
  getProgress,
  updateProgress,
  clearAll,
} from './storage';
import type { LLMSettings } from './types';

const StoreCtx = createContext<Store>();

interface Store {
  recipes: typeof recipes;
  progresses: typeof progresses;
  settings: typeof settings;
  setSettings: (s: LLMSettings) => void;
  addRecipe: typeof addRecipe;
  removeRecipe: typeof removeRecipe;
  getProgress: typeof getProgress;
  updateProgress: typeof updateProgress;
  clearAll: typeof clearAll;
}

const store: Store = {
  recipes,
  progresses,
  settings,
  setSettings,
  addRecipe,
  removeRecipe,
  getProgress,
  updateProgress,
  clearAll,
};

export function RecipeStoreProvider(props: ParentProps) {
  return <StoreCtx.Provider value={store}>{props.children}</StoreCtx.Provider>;
}

export function useRecipes(): Store {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useRecipes must be used within RecipeStoreProvider');
  return ctx;
}
