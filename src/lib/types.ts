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
  checkedSteps: string[];
  checkedSubsteps: string[];
  checkedIngredients: string[];
  currentCookingStep: number;
}

export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  category?: ShoppingCategory;
}

export interface Step {
  id: string;
  title: string;
  order: number;
  substeps: SubStep[];
  notes?: string;
}

export interface SubStep {
  id: string;
  instruction: string;
  segments?: InstructionSegment[];
  linkedIngredients?: LinkedIngredient[];
}

export interface LinkedIngredient {
  ingredientId: string;
  quantity: number;
  unit: string;
}

export type InstructionSegment = TextSegment | IngredientSegment;

export interface TextSegment {
  type: 'text';
  text: string;
}

export interface IngredientSegment {
  type: 'ingredient';
  ingredientId: string;
  quantity: number;
  unit: string;
}

export type ShoppingCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'pantry'
  | 'spices'
  | 'bakery'
  | 'frozen'
  | 'other';

export const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat',
  pantry: 'Pantry',
  spices: 'Spices',
  bakery: 'Bakery',
  frozen: 'Frozen',
  other: 'Other',
};

export const CATEGORY_ORDER: ShoppingCategory[] = [
  'produce',
  'meat',
  'dairy',
  'bakery',
  'pantry',
  'spices',
  'frozen',
  'other',
];

export interface LLMSettings {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  provider: 'deepseek',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
};
