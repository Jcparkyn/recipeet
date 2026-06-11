import { createMemo, createSignal, Show, For } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { recipes, getProgress, updateProgress } from '@/lib/storage';
import styles from './CookingMode.module.css';

export default function CookingMode() {
  const params = useParams();
  const navigate = useNavigate();
  const recipeId = params.id ?? '';

  const recipe = createMemo(() => recipes.find((r) => r.id === recipeId));
  const progress = createMemo(() => getProgress(recipeId));

  const steps = createMemo(() => recipe()?.content.steps ?? []);
  const currentIdx = createMemo(() => progress()?.currentCookingStep ?? 0);
  const currentStep = createMemo(() => steps()[currentIdx()]);
  const checkedSteps = createMemo(() => new Set(progress()?.checkedSteps));
  const checkedSubsteps = createMemo(() => new Set(progress()?.checkedSubsteps));

  const stepChecked = createMemo(() => checkedSteps().has(currentStep()?.id ?? ''));

  const isLastStep = createMemo(() => currentIdx() >= steps().length - 1);
  const isFirstStep = createMemo(() => currentIdx() <= 0);
  const [completed, setCompleted] = createSignal(false);

  function toggleSubstep(subId: string) {
    const p = progress();
    if (!p) return;
    const current = new Set(p.checkedSubsteps);
    if (current.has(subId)) {
      current.delete(subId);
    } else {
      current.add(subId);
    }
    updateProgress(p.recipeId, { checkedSubsteps: [...current] });
  }

  function toggleStep() {
    const p = progress();
    const step = currentStep();
    if (!p || !step) return;
    const currentSteps = new Set(p.checkedSteps);
    const currentSubs = new Set(p.checkedSubsteps);

    if (currentSteps.has(step.id)) {
      currentSteps.delete(step.id);
      for (const sub of step.substeps) currentSubs.delete(sub.id);
    } else {
      currentSteps.add(step.id);
      for (const sub of step.substeps) currentSubs.add(sub.id);
    }

    updateProgress(p.recipeId, {
      checkedSteps: [...currentSteps],
      checkedSubsteps: [...currentSubs],
    });
  }

  function goTo(idx: number) {
    const r = recipe();
    if (r && idx >= 0 && idx < r.content.steps.length) {
      updateProgress(r.id, { currentCookingStep: idx });
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

  const r = recipe();
  const p = progress();
  if (!r || !p) {
    return (
      <div class={styles.page}>
        <p>Recipe not found</p>
        <button onClick={() => navigate('/')}>Go back</button>
      </div>
    );
  }

  return (
    <Show when={!completed()} fallback={
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
    }>
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
          <div>
            <div class={styles.stepHeader} onClick={toggleStep}>
              <button
                class={styles.stepCheck}
                classList={{ [styles.checked]: stepChecked() }}
                aria-label={stepChecked() ? 'Uncheck step' : 'Check step'}
              >
                {stepChecked() ? '✓' : '○'}
              </button>
              <h2 class={styles.stepTitle}>{currentStep()?.title ?? ''}</h2>
            </div>

            <ul class={styles.substeps}>
              <For each={currentStep()?.substeps ?? []}>
                {(sub) => {
                  const checked = () => checkedSubsteps().has(sub.id);
                  return (
                    <li class={styles.substep}>
                      <button
                        class={styles.subCheck}
                        classList={{ [styles.checked]: checked() }}
                        onClick={() => toggleSubstep(sub.id)}
                        aria-label={checked() ? 'Uncheck' : 'Check'}
                      >
                        {checked() ? '✓' : '○'}
                      </button>
                      <span
                        class={styles.subInstruction}
                        classList={{ [styles.done]: checked() }}
                      >
                        {sub.instruction}
                      </span>
                    </li>
                  );
                }}
              </For>
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
            <For each={steps()}>
              {(_, i) => (
                <button
                  class={styles.dot}
                  classList={{ [styles.active]: i() === currentIdx() }}
                  onClick={() => goTo(i())}
                  aria-label={`Go to step ${i() + 1}`}
                />
              )}
            </For>
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
    </Show>
  );
}
