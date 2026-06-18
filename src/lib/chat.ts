import { streamText, tool, stepCountIs } from 'ai';
import { createDeepSeek, type DeepSeekLanguageModelOptions } from '@ai-sdk/deepseek';
import { z } from 'zod';
import type { Recipe, RecipeProgress, ChatMessage } from './types';

export interface ChatTools {
  setSubstep: (substepId: string, checked: boolean) => void;
  completeStep: (stepIndex: number) => void;
  goToStep: (stepIndex: number) => void;
  getProgress: () => RecipeProgress;
}

function buildSystemPrompt(
  recipe: Recipe,
  progress: RecipeProgress,
): string {
  const ctx = {
    recipe: {
      title: recipe.content.title,
      servings: progress.currentServings,
      originalServings: recipe.content.originalServings,
    },
    progress: {
      currentStep: progress.currentCookingStep,
      totalSteps: recipe.content.steps.length,
      checkedSubsteps: progress.checkedSubsteps,
      checkedIngredients: progress.checkedIngredients,
    },
    steps: recipe.content.steps.map((s, i) => ({
      index: i,
      title: s.title,
      substeps: s.substeps.map((sub) => ({
        id: sub.id,
        instruction: sub.instruction,
        handsOnTime: sub.handsOnTime,
        waitTime: sub.waitTime,
        checked: progress.checkedSubsteps.includes(sub.id),
      })),
    })),
    ingredients: recipe.content.ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
    })),
  };

  const contextJson = JSON.stringify(ctx, null, 2);

  return `You are a helpful cooking assistant embedded in a recipe app. You have access to the full recipe and the user's current progress.

RECIPE CONTEXT:
${contextJson}

You have tools to update the user's progress. Use them proactively when the user indicates they've completed something.

Guidelines:
- Be concise. The user is cooking and needs quick, actionable answers.
- When the user describes completing an action, use the update_substep tool to mark it done.
- If the user asks "what's next", check their progress and tell them what substep or step comes next.
- When mentioning ingredients, use the scaled quantities based on current servings shown in the recipe context.
- Do not repeat the full recipe context unless specifically asked.
- If the user seems confused or stuck, offer helpful guidance based on the recipe steps.
- In cook mode, you can navigate between steps using go_to_step if needed.`;
}

export function createChatStream(
  recipe: Recipe,
  progress: RecipeProgress,
  chatHistory: ChatMessage[],
  userMessage: string,
  tools: ChatTools,
  isCookMode: boolean,
  apiKey: string,
  baseUrl: string,
  model: string,
) {
  const provider = createDeepSeek({
    apiKey,
    baseURL: baseUrl,
  });

  const systemPrompt = buildSystemPrompt(recipe, progress);

  const messages = [
    ...chatHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const updateSubstepTool = tool({
    description: 'Mark a substep as checked (done) or unchecked. Use when the user completes or uncompletes a substep action.',
    inputSchema: z.object({
      substepId: z.string().describe('The ID of the substep to update'),
      checked: z.boolean().describe('True to mark as done, false to mark as not done'),
    }),
    execute: async ({ substepId, checked }) => {
      tools.setSubstep(substepId, checked);
      return { success: true };
    },
  });

  const completeStepTool = tool({
    description: 'Mark all substeps in a specific step as complete.',
    inputSchema: z.object({
      stepIndex: z.number().int().min(0).describe('Zero-based index of the step to complete'),
    }),
    execute: async ({ stepIndex }) => {
      tools.completeStep(stepIndex);
      return { success: true };
    },
  });

  const getProgressTool = tool({
    description: 'Get the current cooking progress status.',
    inputSchema: z.object({}),
    execute: async () => {
      const p = tools.getProgress();
      return {
        currentStep: p.currentCookingStep,
        totalSteps: recipe.content.steps.length,
        checkedSubsteps: p.checkedSubsteps,
        checkedIngredients: p.checkedIngredients,
      };
    },
  });

  const goToStepTool = isCookMode
    ? tool({
        description: 'Navigate to a specific step by its index.',
        inputSchema: z.object({
          stepIndex: z.number().int().min(0).describe('Zero-based index of the step to navigate to'),
        }),
        execute: async ({ stepIndex }) => {
          tools.goToStep(stepIndex);
          return { success: true };
        },
      })
    : null;

  return streamText({
    model: provider(model),
    system: systemPrompt,
    messages,
    tools: {
      update_substep: updateSubstepTool,
      complete_step: completeStepTool,
      get_progress: getProgressTool,
      ...(goToStepTool ? { go_to_step: goToStepTool } : {}),
    },
    stopWhen: stepCountIs(5),
    providerOptions: {
      deepseek: {
        thinking: { type: 'disabled' },
        reasoningEffort: 'high',
      } satisfies DeepSeekLanguageModelOptions,
    },
  });
}
