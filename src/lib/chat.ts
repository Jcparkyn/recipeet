import { RealtimeAgent } from '@openai/agents/realtime';
import { tool } from '@openai/agents/realtime';
import { z } from 'zod';
import type { Recipe, RecipeProgress } from './types';
import { scaleQuantity, formatQuantity } from './scaling';

export interface ChatTools {
  setStep: (stepId: string, checked: boolean) => void;
  completeSection: (sectionIndex: number) => void;
  goToSection: (sectionIndex: number) => void;
  getProgress: () => RecipeProgress;
}

function buildSystemPrompt(recipe: Recipe, currentServings: number): string {
  const ctx = {
    title: recipe.content.title,
    servings: currentServings,
    originalServings: recipe.content.originalServings,
    sections: recipe.content.sections.map((s, i) => ({
      index: i,
      title: s.title,
      steps: s.steps.map((step) => ({
        id: step.id,
        instruction: step.instruction,
        handsOnTime: step.handsOnTime,
        waitTime: step.waitTime,
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
- Answer in as few words as possible. The user is cooking and needs quick, actionable answers.
- No filler words/phrases, follow ups, or suggestions for what's next unless asked.
- When the user describes completing an action, use the update_step tool to mark it done.
- If the user asks "what's next", check their progress with get_progress and tell them what step comes next.
- Ingredient quantities in the recipe are already scaled — use them directly, do not recalculate.
- Do not repeat the full recipe unless asked.
- If the user seems confused or stuck, offer helpful guidance based on the recipe sections.
- In cook mode, you can navigate between sections using go_to_section if needed.
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
      name: 'update_step',
      description: 'Mark a step as checked (done) or unchecked.',
      parameters: z.object({
        stepId: z.string().describe('The ID of the step to update'),
        checked: z.boolean().describe('True to mark as done, false to mark as not done'),
      }),
      execute: async ({ stepId, checked }) => {
        tools.setStep(stepId, checked);
        return 'Step updated.';
      },
    }),

    tool({
      name: 'complete_section',
      description: 'Mark all steps in a section as complete.',
      parameters: z.object({
        sectionIndex: z.number().int().min(0).describe('Zero-based index of the section'),
      }),
      execute: async ({ sectionIndex }) => {
        tools.completeSection(sectionIndex);
        return 'Section completed.';
      },
    }),

    tool({
      name: 'get_progress',
      description: 'Get the current cooking progress including servings.',
      parameters: z.object({}),
      execute: async () => {
        const p = tools.getProgress();
        return JSON.stringify({
          currentSection: p.currentCookingSection,
          totalSections: recipe.content.sections.length,
          currentServings: p.currentServings,
          checkedSteps: p.checkedSteps,
          checkedIngredients: p.checkedIngredients,
        });
      },
    }),
  ];

  const goToSectionTool = tool({
    name: 'go_to_section',
    description: 'Navigate to a specific section.',
    parameters: z.object({
      sectionIndex: z.number().int().min(0).describe('Zero-based index of the section'),
    }),
    execute: async ({ sectionIndex }) => {
      tools.goToSection(sectionIndex);
      return `Navigated to section ${sectionIndex}.`;
    },
  });

  return new RealtimeAgent({
    name: 'Cooking Assistant',
    instructions,
    tools: isCookMode ? [...systemTools, goToSectionTool] : systemTools,
  });
}
