import { createMemo, createSignal } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { useRecipes } from '@/lib/store';
import { scaleQuantity, formatQuantity } from '@/lib/scaling';
import type { SubStep } from '@/lib/types';
import styles from './CookingMode.module.css';

export default function CookingMode() {
  const params = useParams();
  const navigate = useNavigate();
  const ctx = useRecipes();
  if (!ctx) return null;

  const recipe = () => ctx.recipes.find((r) => r.id === params.id);
  const progress = () => ctx.getProgress(params.id);

  if (!recipe() || !progress()) {
    return (
      <div class={styles.page}>
        <p>Recipe not found</p>
        <button onClick={() => navigate('/')}>Go back</button>
      </div>
    );
  }

  const r = recipe()!;
  const p = progress()!;
  const steps = () => r.content.steps;
  const currentIdx = () => p.currentCookingStep;
  const currentStep = () => steps()[currentIdx()];
  const checkedSteps = () => new Set(p.checkedSteps);
  const checkedSubsteps = () => new Set(p.checkedSubsteps);
  const servings = () => p.currentServings;

  const stepChecked = createMemo(() => checkedSteps().has(currentStep()?.id ?? ''));

  const allSubstepsChecked = createMemo(() => {
    const step = currentStep();
    if (!step) return false;
    if (step.substeps.length === 0) return stepChecked();
    return step.substeps.every((s) => checkedSubsteps().has(s.id));
  });

  function toggleSubstep(subId: string) {
    const current = new Set(checkedSubsteps());
    if (current.has(subId)) {
      current.delete(subId);
    } else {
      current.add(subId);
    }
    ctx!.updateProgress(r.id, { checkedSubsteps: [...current] });
  }

  function toggleStep() {
    const currentSteps = new Set(checkedSteps());
    const currentSubs = new Set(checkedSubsteps());
    const step = currentStep();
    if (!step) return;

    if (currentSteps.has(step.id)) {
      currentSteps.delete(step.id);
      for (const sub of step.substeps) currentSubs.delete(sub.id);
    } else {
      currentSteps.add(step.id);
      for (const sub of step.substeps) currentSubs.add(sub.id);
    }

    ctx!.updateProgress(r.id, {
      checkedSteps: [...currentSteps],
      checkedSubsteps: [...currentSubs],
    });
  }

  const isLastStep = () => currentIdx() >= steps().length - 1;
  const isFirstStep = () => currentIdx() <= 0;
  const [completed, setCompleted] = createSignal(false);

  function goTo(idx: number) {
    if (idx >= 0 && idx < steps().length) {
      ctx!.updateProgress(r.id, { currentCookingStep: idx });
    }
  }

  function next() {
    if (isLastStep()) {
      setCompleted(true);
    } else {
      goTo(currentIdx() + 1);
    }
  }

  function prev() {
    goTo(currentIdx() - 1);
  }

  function getScaledQuantity(sub: SubStep): string {
    if (!sub.linkedIngredients || sub.linkedIngredients.length === 0) return '';
    return sub.linkedIngredients
      .map((li) => {
        const ing = r.content.ingredients.find((i) => i.id === li.ingredientId);
        if (!ing) return `${formatQuantity(li.quantity)} ${li.unit}`;
        const scaled = scaleQuantity(
          ing.quantity,
          r.content.originalServings,
          servings(),
        );
        return `${formatQuantity(scaled)} ${ing.unit}`;
      })
      .join(', ');
  }

  if (completed()) {
    return (
      <div class={styles.donePage}>
        <div class={styles.doneContent}>
          <h1>Done!</h1>
          <p>You finished cooking {r.content.title}</p>
          <button
            class={styles.doneBtn}
            onClick={() => navigate(`/recipe/${r.id}`)}
          >
            Back to recipe
          </button>
        </div>
      </div>
    );
  }

  const step = currentStep();

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <button class={styles.back} onClick={() => navigate(`/recipe/${r.id}`)} aria-label="Back">
          ←
        </button>
        <div class={styles.headerCenter}>
          <span class={styles.stepCount}>
            Step {currentIdx() + 1} of {steps().length}
          </span>
          <div class={styles.progressBar}>
            <div
              class={styles.progressFill}
              style={{ width: `${((currentIdx() + 1) / steps().length) * 100}%` }}
            />
          </div>
        </div>
        <div class={styles.spacer} />
      </header>

      <main class={styles.main}>
        <div class={styles.stepCard}>
          <div class={styles.stepHeader} onClick={toggleStep}>
            <button
              class={styles.stepCheck}
              classList={{ [styles.checked]: stepChecked() }}
              aria-label={stepChecked() ? 'Uncheck step' : 'Check step'}
            >
              {stepChecked() ? '✓' : '○'}
            </button>
            <h2 class={styles.stepTitle}>{step.title}</h2>
          </div>

          <ul class={styles.substeps}>
            {step.substeps.map((sub) => {
              const checked = checkedSubsteps().has(sub.id);
              return (
                <li class={styles.substep}>
                  <button
                    class={styles.subCheck}
                    classList={{ [styles.checked]: checked }}
                    onClick={() => toggleSubstep(sub.id)}
                    aria-label={checked ? 'Uncheck' : 'Check'}
                  >
                    {checked ? '✓' : '○'}
                  </button>
                  <span
                    class={styles.subInstruction}
                    classList={{ [styles.done]: checked }}
                  >
                    {sub.instruction}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </main>

      <footer class={styles.footer}>
        <button
          class={styles.navBtn}
          classList={{ [styles.disabled]: isFirstStep() }}
          onClick={prev}
          disabled={isFirstStep()}
        >
          Previous
        </button>
        <div class={styles.dots}>
          {steps().map((_, i) => (
            <button
              class={styles.dot}
              classList={{ [styles.active]: i === currentIdx() }}
              onClick={() => goTo(i)}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>
        <button
          class={styles.navBtn}
          classList={{ [styles.primary]: isLastStep() }}
          onClick={next}
        >
          {isLastStep() ? 'Finish' : 'Next'}
        </button>
      </footer>
    </div>
  );
}
