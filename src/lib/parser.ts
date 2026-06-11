import type { RecipeContent, LLMSettings, ShoppingCategory } from './types';

export interface ParseResult {
  content: RecipeContent;
  warnings?: string[];
}

export interface RecipeParser {
  parse(text: string, settings: LLMSettings): Promise<ParseResult>;
}

const SYSTEM_PROMPT = `You are a recipe parser. Given unstructured recipe text, return a JSON object with this schema:
{
  "title": string,
  "originalServings": number,
  "ingredients": [
    { "name": string, "quantity": number, "unit": string, "notes"?: string, "category": "produce"|"dairy"|"meat"|"pantry"|"spices"|"bakery"|"frozen"|"other" }
  ],
  "steps": [
    {
      "title": string,
      "order": number,
      "substeps": [
        { "instruction": string, "linkedIngredients"?: [{ "ingredientIndex": number, "quantity": number, "unit": string }] }
      ]
    }
  ]
}

Rules:
1. Reorder steps: prep work (chopping, measuring, marinating) before cooking steps.
2. Time-sensitive prep (e.g. "cut meat before it goes in a hot pan") gets its own step BEFORE the cooking step that needs it.
3. Non-urgent measuring (e.g. "add 1 tsp paprika to sauce") stays inline in the cooking substep.
4. Every substep instruction must include scaled ingredient quantities inline so no scrolling is needed.
5. Categorize each ingredient.
6. Default to 4 servings if not specified.
7. Convert fractions to decimals (0.5 not 1/2).
8. linkedIngredients[].ingredientIndex refers to zero-based index in ingredients[].

Return only valid JSON, no markdown fences, no extra text.`;

export class DeepSeekParser implements RecipeParser {
  async parse(text: string, settings: LLMSettings): Promise<ParseResult> {
    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`LLM API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty response from LLM');

    const parsed = JSON.parse(raw);
    return validateAndTransform(parsed);
  }
}

function validateAndTransform(raw: Record<string, unknown>): ParseResult {
  const warnings: string[] = [];

  if (!raw.title || typeof raw.title !== 'string') {
    throw new Error('Recipe is missing a title');
  }

  const title = raw.title;
  const originalServings = typeof raw.originalServings === 'number' ? raw.originalServings : 4;

  if (!Array.isArray(raw.ingredients)) {
    throw new Error('Recipe is missing ingredients');
  }

  if (!Array.isArray(raw.steps)) {
    throw new Error('Recipe is missing steps');
  }

  const ingredients = raw.ingredients.map((ing: Record<string, unknown>) => ({
    id: crypto.randomUUID(),
    name: String(ing.name || ''),
    quantity: Number(ing.quantity) || 0,
    unit: String(ing.unit || ''),
    notes: ing.notes ? String(ing.notes) : undefined,
    category: isValidCategory(ing.category) ? ing.category : undefined,
  }));

  const steps = raw.steps.map((step: Record<string, unknown>, si: number) => ({
    id: crypto.randomUUID(),
    title: String(step.title || `Step ${si + 1}`),
    order: typeof step.order === 'number' ? step.order : si,
    substeps: Array.isArray(step.substeps)
      ? step.substeps.map((sub: Record<string, unknown>) => ({
          id: crypto.randomUUID(),
          instruction: String(sub.instruction || ''),
          linkedIngredients: Array.isArray(sub.linkedIngredients)
            ? sub.linkedIngredients.map((li: Record<string, unknown>) => ({
                ingredientId:
                  typeof li.ingredientIndex === 'number' &&
                  li.ingredientIndex >= 0 &&
                  li.ingredientIndex < ingredients.length
                    ? ingredients[li.ingredientIndex].id
                    : '',
                quantity: Number(li.quantity) || 0,
                unit: String(li.unit || ''),
              }))
            : undefined,
        }))
      : [],
  }));

  steps.sort((a, b) => a.order - b.order);

  return {
    content: { title, originalServings, ingredients, steps },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function isValidCategory(c: unknown): c is ShoppingCategory {
  const valid: ShoppingCategory[] = ['produce', 'dairy', 'meat', 'pantry', 'spices', 'bakery', 'frozen', 'other'];
  return typeof c === 'string' && valid.includes(c as ShoppingCategory);
}

export function getParser(provider: string): RecipeParser {
  switch (provider) {
    case 'deepseek':
    default:
      return new DeepSeekParser();
  }
}
