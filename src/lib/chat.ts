import { RealtimeAgent } from '@openai/agents/realtime';
import { tool } from '@openai/agents/realtime';
import { z } from 'zod';
import type { Recipe, RecipeProgress } from './types';
import { scaleQuantity, formatQuantity } from './scaling';

export interface ChatTools {
  setSubstep: (substepId: string, checked: boolean) => void;
  completeStep: (stepIndex: number) => void;
  goToStep: (stepIndex: number) => void;
  getProgress: () => RecipeProgress;
}

function buildSystemPrompt(recipe: Recipe, currentServings: number): string {
  const ctx = {
    title: recipe.content.title,
    servings: currentServings,
    originalServings: recipe.content.originalServings,
    steps: recipe.content.steps.map((s, i) => ({
      index: i,
      title: s.title,
      substeps: s.substeps.map((sub) => ({
        id: sub.id,
        instruction: sub.instruction,
        handsOnTime: sub.handsOnTime,
        waitTime: sub.waitTime,
      })),
    })),
    ingredients: recipe.content.ingredients.map((i) => {
      const scaled = scaleQuantity(i.quantity, recipe.content.originalServings, currentServings);
      const display = scaled != null && i.unit ? `${formatQuantity(scaled)} ${i.unit}` : undefined;
      return {
        id: i.id,
        name: i.name,
        display,
        category: i.category,
      };
    }),
  };

  const contextJson = JSON.stringify(ctx, null, 2);

  return `You are a helpful cooking assistant embedded in a recipe app.

RECIPE (all quantities below are already scaled to ${currentServings} servings):
${contextJson}

You have tools to update the user's progress. Use them proactively when the user indicates they've completed something.

Guidelines:
- Be concise. The user is cooking and needs quick, actionable answers.
- When the user describes completing an action, use the update_substep tool to mark it done.
- If the user asks "what's next", check their progress with get_progress and tell them what substep comes next.
- Ingredient quantities in the recipe are already scaled — use them directly, do not recalculate.
- Do not repeat the full recipe unless asked.
- If the user seems confused or stuck, offer helpful guidance based on the recipe steps.
- In cook mode, you can navigate between steps using go_to_step if needed.
- No formatting (bold, **, etc) - just plain text.
`;
}

export function createRecipeAgent(
  recipe: Recipe,
  progress: RecipeProgress,
  tools: ChatTools,
  isCookMode: boolean,
): RealtimeAgent {
  const instructions = buildSystemPrompt(recipe, progress.currentServings);

  const systemTools = [
    tool({
      name: 'update_substep',
      description: 'Mark a substep as checked (done) or unchecked.',
      parameters: z.object({
        substepId: z.string().describe('The ID of the substep to update'),
        checked: z.boolean().describe('True to mark as done, false to mark as not done'),
      }),
      execute: async ({ substepId, checked }) => {
        tools.setSubstep(substepId, checked);
        return 'Substep updated.';
      },
    }),

    tool({
      name: 'complete_step',
      description: 'Mark all substeps in a step as complete.',
      parameters: z.object({
        stepIndex: z.number().int().min(0).describe('Zero-based index of the step'),
      }),
      execute: async ({ stepIndex }) => {
        tools.completeStep(stepIndex);
        return 'Step completed.';
      },
    }),

    tool({
      name: 'get_progress',
      description: 'Get the current cooking progress including servings.',
      parameters: z.object({}),
      execute: async () => {
        const p = tools.getProgress();
        return JSON.stringify({
          currentStep: p.currentCookingStep,
          totalSteps: recipe.content.steps.length,
          currentServings: p.currentServings,
          checkedSubsteps: p.checkedSubsteps,
          checkedIngredients: p.checkedIngredients,
        });
      },
    }),
  ];

  const goToStepTool = tool({
    name: 'go_to_step',
    description: 'Navigate to a specific step.',
    parameters: z.object({
      stepIndex: z.number().int().min(0).describe('Zero-based index of the step'),
    }),
    execute: async ({ stepIndex }) => {
      tools.goToStep(stepIndex);
      return `Navigated to step ${stepIndex}.`;
    },
  });

  return new RealtimeAgent({
    name: 'Cooking Assistant',
    instructions,
    tools: isCookMode ? [...systemTools, goToStepTool] : systemTools,
  });
}
