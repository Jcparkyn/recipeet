import type { RecipeContent } from '@/lib/types';

export function totalHandsOnTime(content: RecipeContent): number {
  return content.sections.reduce(
    (total, section) =>
      total + section.steps.reduce((sum, step) => sum + (step.handsOnTime ?? 0), 0),
    0,
  );
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
