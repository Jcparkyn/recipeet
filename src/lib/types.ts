export interface RecipeContent {
  title: string;
  originalServings: number;
  ingredients: Ingredient[];
  sections: Section[];
  equipment?: Equipment[];
}

export interface Equipment {
  name: string;
  quantity?: number;
  notes?: string;
}

export interface Recipe {
  id: string;
  content: RecipeContent;
  sourceUrl?: string;
  createdAt: number;
  updatedAt: number;
}

import type { RealtimeItem } from '@openai/agents/realtime';

export interface RecipeProgress {
  recipeId: string;
  currentServings: number;
  checkedShoppingItems: string[];
  checkedSteps: string[];
  checkedIngredients: string[];
  currentCookingSection: number;
  ingredientUnitModes: Record<string, number>;
  chatMessages: RealtimeItem[];
}

export interface Ingredient {
  id: string;
  name: string;
  quantity?: number;
  unit: string;
  notes?: string;
  category?: string;
}

export interface Section {
  id: string;
  title: string;
  order: number;
  steps: Step[];
  images?: string[];
}

export interface Step {
  id: string;
  label?: string;
  instruction: string;
  segments?: InstructionSegment[];
  notes?: string;
  handsOnTime?: number;
  waitTime?: number;
}

export type InstructionSegment = TextSegment | IngredientSegment;

export interface TextSegment {
  type: 'text';
  text: string;
}

export interface IngredientSegment {
  type: 'ingredient';
  ingredientId: string;
}

export type QuantityKind = 'gram' | 'ml' | 'count';

export interface Quantity {
  value: number;
  kind: QuantityKind;
}

export interface LLMSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  parseInstructions: string;
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-5.6-luna',
  parseInstructions: '',
};
