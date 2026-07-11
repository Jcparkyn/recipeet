import { Agent, run, OpenAIProvider } from '@openai/agents';
import OpenAI from 'openai';
import { z } from 'zod';
import type { RecipeContent, LLMSettings, InstructionSegment, Ingredient } from './types';

export interface ParseResult {
  content: RecipeContent;
  warnings?: string[];
}

export interface RecipeParser {
  parse(text: string, settings: LLMSettings): Promise<ParseResult>;
}

const ING_MARKER = /\[\[ing:(\d+)\]\]/g;

const SYSTEM_PROMPT = `You are a recipe parser. Given unstructured recipe text, extract structured recipe data.

Structure:
- Reorder steps so that long-running background tasks (e.g. preheating oven, bringing water to a boil, marinating) start BEFORE shorter prep steps like chopping and measuring. The goal is that by the time the food is ready to go in, the oven is already hot or the water is already boiling.
- Prep work (chopping, measuring, marinating) should still come before cooking steps that depend on them.
- Time-sensitive prep (e.g. "cut meat before it goes in a hot pan") gets its own step BEFORE the cooking step that needs it.
- Split into separate substeps aggressively. A substep may contain multiple ingredient actions (add, stir, mix, measure) but at most ONE timed cooking/waiting section. Whenever the source describes a cooking action (cook, simmer, fry, boil, bake, roast, sauté, rest, etc.) followed by another cooking action with different timing, split them into different substeps. Example: "add [[ing:0]], cook for 2 min, add [[ing:1]], cook for 4 min" must be TWO substeps — the first ending at "2 min", the second starting with "add [[ing:1]]". Conversely, "fry [[ing:0]] for 3 min, then set aside" is a single substep because there is only one cooking section.
- As a rough guideline, steps should each have around 2-4 substeps. More substeps is okay if they're very short, and one substep is okay if it's unrelated to nearby steps.

Ingredients:
- Every substep instruction must use [[ing:N]] markers where an ingredient is used (N = zero-based index in ingredients[]). Do NOT write the ingredient name or quantity in the instruction text — the [[ing:N]] marker replaces it entirely. Example: "Dice [[ing:0]] into small cubes" not "Dice 2 onions into small cubes".
- Categorize each ingredient using standard AU grocery store aisle names, title-cased. Examples (not exhaustive): Produce, Dairy, Meat, Pantry, Spices, Bakery, Frozen. You don't have to follow the categories used in the original recipe, which might be a different system.
- Non-urgent measuring (e.g. "add 1 tsp paprika to sauce") stays inline in the cooking substep.
- Extract preparation notes, substitutions, or special qualities from ingredient text (e.g. "cold, cubed", "peeled and diced", "or margarine"). Include in the "notes" field of each ingredient. Leave empty if none.
- If an ingredient is used in multiple steps/substeps, make multiple entries for that ingredient with the same name.
- If the recipe contains "either/or" ingredients (e.g. chicken OR pork, parsley OR coriander), they must be put in a separate category heading, e.g. "Protein (choose 1)".

Timing:
- Estimate the time each substep takes. Include "handsOnTime" (active work in minutes, e.g. chopping, stirring) and "waitTime" (passive time in minutes, e.g. baking, simmering, resting). Both are numbers in minutes, omit if zero. Examples: dicing chicken is {"handsOnTime": 3}; frying is {"handsOnTime": 2, "waitTime": 8}.

Notes:
- Include any general notes about a step (tips, warnings, explanations) in the "notes" field. Omit or leave empty if there are no notable notes. This should NOT include a summary or duration/timing info, just extra useful details from the recipe.
- Identify up to 2 relevant image URLs from the original page content (the markdown may contain ![alt](url) references) that illustrate each step. Include them in an "images" array on each step object. Only include images directly useful for understanding that specific step. Use an empty array if no relevant images exist.

Quantities:
- Guess the number of servings based on quantities, if not specified explicitly in the recipe.
- Convert fractions to decimals (0.5 not 1/2).
- Never use 0 as a quantity. If there's no quantity in the recipe, leave quantity null.
- Do NOT convert units. Return units exactly as they appear in the source text. Use only these unit strings: ml, l, g, kg, oz, lb, cup, tbsp, tsp, floz, pint, quart, gallon. For items without a unit (e.g. eggs, cloves, pinches of salt), use an empty string "".

Return only valid JSON, no markdown fences, no extra text.`;

const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.coerce.number().optional(),
  unit: z.string(),
  notes: z.string().optional(),
  category: z.string().optional(),
});

const substepSchema = z.object({
  instruction: z.string().min(1),
  handsOnTime: z.number().nonnegative().optional(),
  waitTime: z.number().nonnegative().optional(),
});

const stepSchema = z.object({
  title: z.string().min(1),
  order: z.number(),
  notes: z.string().optional(),
  images: z.array(z.string()).optional(),
  substeps: z.array(substepSchema).min(1),
});

const recipeOutputSchema = z.object({
  title: z.string().min(1),
  originalServings: z.coerce.number().positive().optional(),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(stepSchema).min(1),
});

type RawRecipe = z.infer<typeof recipeOutputSchema>;

export class OpenAIParser implements RecipeParser {
  async parse(text: string, settings: LLMSettings): Promise<ParseResult> {
    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl,
      dangerouslyAllowBrowser: true,
    });
    const provider = new OpenAIProvider({ openAIClient: client });
    const model = await provider.getModel(settings.model);

    const agent = new Agent({
      name: 'Recipe Parser',
      instructions: SYSTEM_PROMPT,
      model,
      outputType: recipeOutputSchema,
    });

    const result = await run(agent, text);

    if (!result.finalOutput) {
      throw new Error('Empty response from LLM');
    }

    return validateAndTransform(result.finalOutput as RawRecipe);
  }
}

function validateAndTransform(raw: RawRecipe): ParseResult {
  let nextId = 1;
  const warnings: string[] = [];

  const ingredients: Ingredient[] = raw.ingredients.map((ing) => ({
    id: String(nextId++),
    name: ing.name,
    quantity: (ing.quantity != null && ing.quantity > 0) ? ing.quantity : undefined,
    unit: ing.unit || '',
    notes: ing.notes || undefined,
    category: ing.category || undefined,
  }));

  const steps = raw.steps.map((step, si) => ({
    id: String(nextId++),
    title: step.title || `Step ${si + 1}`,
    order: step.order ?? si,
    notes: step.notes || undefined,
    images: (step.images || []).filter((u) => u.length > 0).slice(0, 2),
    substeps: (step.substeps || []).map((sub) => {
      const instruction = sub.instruction || '';
      const segments = parseSegments(instruction, ingredients);

      return {
        id: String(nextId++),
        instruction,
        segments,
        handsOnTime: sub.handsOnTime && sub.handsOnTime > 0 ? sub.handsOnTime : undefined,
        waitTime: sub.waitTime && sub.waitTime > 0 ? sub.waitTime : undefined,
      };
    }),
  }));

  steps.sort((a, b) => a.order - b.order);

  return {
    content: { title: raw.title, originalServings: raw.originalServings ?? 1, ingredients, steps },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function parseSegments(
  instruction: string,
  ingredients: { id: string; name: string }[],
): InstructionSegment[] {
  const segments: InstructionSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  ING_MARKER.lastIndex = 0;

  while ((match = ING_MARKER.exec(instruction)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: instruction.slice(lastIndex, match.index) });
    }

    const idx = Number(match[1]);
    const ing = ingredients[idx];

    if (ing) {
      segments.push({ type: 'ingredient', ingredientId: ing.id });
    } else {
      segments.push({ type: 'text', text: `ingredient ${idx}` });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < instruction.length) {
    segments.push({ type: 'text', text: instruction.slice(lastIndex) });
  }

  if (segments.length === 0) {
    return [{ type: 'text', text: instruction }];
  }

  return segments;
}

export function getParser(): RecipeParser {
  return new OpenAIParser();
}
