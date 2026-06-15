import type { RecipeContent, LLMSettings, ShoppingCategory, LinkedIngredient, InstructionSegment } from './types';

export interface ParseResult {
  content: RecipeContent;
  warnings?: string[];
}

export interface RecipeParser {
  parse(text: string, settings: LLMSettings): Promise<ParseResult>;
}

const ING_MARKER = /\[\[ing:(\d+)\]\]/g;

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
      "notes"?: string,
      "images"?: string[],
      "substeps": [
        { "instruction": string, "handsOnTime"?: number, "waitTime"?: number, "linkedIngredients"?: [{ "ingredientIndex": number, "quantity": number, "unit": string }] }
      ]
    }
  ]
}

Rules:
1. Include any general notes about a step (tips, warnings, explanations) in the "notes" field. Omit or leave empty if there are no notable notes. Do NOT put duration/timing info in notes.
2. Reorder steps so that long-running background tasks (e.g. preheating oven, bringing water to a boil, marinating) start BEFORE shorter prep steps like chopping and measuring. The goal is that by the time the food is ready to go in, the oven is already hot or the water is already boiling.
3. Prep work (chopping, measuring, marinating) should still come before cooking steps that depend on them.
4. Time-sensitive prep (e.g. "cut meat before it goes in a hot pan") gets its own step BEFORE the cooking step that needs it.
5. Non-urgent measuring (e.g. "add 1 tsp paprika to sauce") stays inline in the cooking substep.
6. Every substep instruction must use [[ing:N]] markers where an ingredient is used (N = zero-based index in ingredients[]). Do NOT write the ingredient name or quantity in the instruction text — the [[ing:N]] marker replaces it entirely. Example: "Dice [[ing:0]] into small cubes" not "Dice 2 onions into small cubes".
7. Categorize each ingredient.
8. Default to 4 servings if not specified.
9. Convert fractions to decimals (0.5 not 1/2).
10. linkedIngredients[].ingredientIndex refers to zero-based index in ingredients[].
12. Extract preparation notes, substitutions, or special qualities from ingredient text (e.g. "cold, cubed", "peeled and diced", "or margarine"). Include in the "notes" field of each ingredient. Leave empty if none.
13. Identify up to 2 relevant image URLs from the original page content (the markdown may contain ![alt](url) references) that illustrate each step. Include them in an "images" array on each step object. Only include images directly useful for understanding that specific step. Use an empty array if no relevant images exist.
14. Estimate the time each substep takes. Include "handsOnTime" (active work in minutes, e.g. chopping, stirring) and "waitTime" (passive time in minutes, e.g. baking, simmering, resting). Both are numbers in minutes, omit if zero. Examples: dicing chicken is {"handsOnTime": 3}; frying is {"handsOnTime": 2, "waitTime": 8}.

11. Do NOT convert units. Return units exactly as they appear in the source text. Use only these unit strings: ml, l, g, kg, oz, lb, cup, tbsp, tsp, floz, pint, quart, gallon. For items without a unit (e.g. eggs, cloves, pinches of salt), use an empty string "".

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
        thinking: { type: 'enabled' },
        reasoning_effort: 'high',
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
  let nextId = 1;
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
    id: String(nextId++),
    name: String(ing.name || ''),
    quantity: Number(ing.quantity) || 0,
    unit: String(ing.unit || ''),
    notes: ing.notes ? String(ing.notes) : undefined,
    category: isValidCategory(ing.category) ? ing.category : undefined,
  }));

  const steps = raw.steps.map((step: Record<string, unknown>, si: number) => ({
    id: String(nextId++),
    title: String(step.title || `Step ${si + 1}`),
    order: typeof step.order === 'number' ? step.order : si,
    notes: step.notes ? String(step.notes) : undefined,
    images: Array.isArray(step.images)
      ? (step.images as string[]).filter((u): u is string => typeof u === 'string' && u.length > 0).slice(0, 2)
      : undefined,
    substeps: Array.isArray(step.substeps)
      ? step.substeps.map((sub: Record<string, unknown>) => {
          const linkedIngredients: LinkedIngredient[] | undefined = Array.isArray(sub.linkedIngredients)
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
            : undefined;

          const instruction = String(sub.instruction || '');
          const segments = parseSegments(instruction, ingredients, linkedIngredients);

          return {
            id: String(nextId++),
            instruction,
            segments,
            linkedIngredients,
            handsOnTime: typeof sub.handsOnTime === 'number' && sub.handsOnTime > 0 ? sub.handsOnTime : undefined,
            waitTime: typeof sub.waitTime === 'number' && sub.waitTime > 0 ? sub.waitTime : undefined,
          };
        })
      : [],
  }));

  steps.sort((a, b) => a.order - b.order);

  return {
    content: { title, originalServings, ingredients, steps },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function parseSegments(
  instruction: string,
  ingredients: { id: string; name: string }[],
  linkedIngredients?: LinkedIngredient[],
): InstructionSegment[] {
  if (!linkedIngredients || linkedIngredients.length === 0) {
    return [{ type: 'text', text: instruction }];
  }

  const byIndex = new Map<number, LinkedIngredient>();
  for (const li of linkedIngredients) {
    const idx = ingredients.findIndex((ing) => ing.id === li.ingredientId);
    if (idx >= 0) byIndex.set(idx, li);
  }

  const segments: InstructionSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  ING_MARKER.lastIndex = 0;

  while ((match = ING_MARKER.exec(instruction)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: instruction.slice(lastIndex, match.index) });
    }

    const idx = Number(match[1]);
    const li = byIndex.get(idx);

    if (li && li.ingredientId) {
      segments.push({
        type: 'ingredient',
        ingredientId: li.ingredientId,
        quantity: li.quantity,
        unit: li.unit,
      });
    } else {
      const ing = ingredients[idx];
      const name = ing ? ing.name : `ingredient ${idx}`;
      segments.push({ type: 'text', text: `${li?.quantity ?? ''} ${li?.unit ?? ''} ${name}`.trim() });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < instruction.length) {
    segments.push({ type: 'text', text: instruction.slice(lastIndex) });
  }

  return segments;
}

function isValidCategory(c: unknown): c is ShoppingCategory {
  const valid: ShoppingCategory[] = ['produce', 'dairy', 'meat', 'pantry', 'spices', 'bakery', 'frozen', 'other'];
  return typeof c === 'string' && valid.includes(c as ShoppingCategory);
}

export function getParser(): RecipeParser {
  return new DeepSeekParser();
}
