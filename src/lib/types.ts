export interface RecipeContent {
  title: string;
  originalServings: number;
  ingredients: Ingredient[];
  steps: Step[];
}

export interface Recipe {
  id: string;
  content: RecipeContent;
  sourceUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RecipeProgress {
  recipeId: string;
  currentServings: number;
  checkedShoppingItems: string[];
  checkedSubsteps: string[];
  checkedIngredients: string[];
  currentCookingStep: number;
  ingredientUnitModes: Record<string, number>;
}

export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  category?: string;
}

export interface Step {
  id: string;
  title: string;
  order: number;
  substeps: SubStep[];
  notes?: string;
  images?: string[];
}

export interface SubStep {
  id: string;
  instruction: string;
  segments?: InstructionSegment[];
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
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-v4-pro',
};
