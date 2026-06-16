import { createMemo, createSignal, Show, For } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { recipes, getProgress, updateProgress } from '@/lib/storage';
import { scaleQuantity, formatQuantity } from '@/lib/scaling';
import { getToggledDisplay, toQuantity } from '@/lib/conversions';
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
  const currentImages = createMemo(() => currentStep()?.images?.filter(Boolean) ?? []);
  const checkedSubsteps = createMemo(() => new Set(progress()?.checkedSubsteps));
  const checkedIngredients = createMemo(() => new Set(progress()?.checkedIngredients));

  const stepChecked = createMemo(() => {
    const step = currentStep();
    if (!step) return false;
    return step.substeps.length > 0 && step.substeps.every((sub) => checkedSubsteps().has(sub.id));
  });

  const isLastStep = createMemo(() => currentIdx() >= steps().length - 1);
  const isFirstStep = createMemo(() => currentIdx() <= 0);
  const handsOnTimes = createMemo(() => {
    const allSteps = steps();
    const checkSubs = checkedSubsteps();
    const idx = currentIdx();
    let completedTime = 0;
    let totalTime = 0;
    for (let i = 0; i < allSteps.length; i++) {
      for (const sub of allSteps[i].substeps) {
        const time = sub.handsOnTime ?? 0;
        totalTime += time;
        if (i < idx || (i === idx && checkSubs.has(sub.id))) {
          completedTime += time;
        }
      }
    }
    const percent = totalTime === 0
      ? ((idx + 1) / allSteps.length) * 100
      : (completedTime / totalTime) * 100;
    return { completedTime, totalTime, percent };
  });

  const [completed, setCompleted] = createSignal(false);

  const ingredientLookup = createMemo(() => {
    const map = new Map<string, { name: string }>();
    for (const ing of recipe()?.content.ingredients ?? []) {
      map.set(ing.id, { name: ing.name });
    }
    return map;
  });

  const targetServings = createMemo(() => progress()?.currentServings ?? 1);
  const originalServings = createMemo(() => recipe()?.content.originalServings ?? 1);

  function toggleIngredient(ingredientId: string) {
    const p = progress();
    if (!p) return;
    const current = new Set(p.checkedIngredients);
    if (current.has(ingredientId)) {
      current.delete(ingredientId);
    } else {
      current.add(ingredientId);
    }
    updateProgress(p.recipeId, (pp) => { pp.checkedIngredients = [...current]; });
  }

  function toggleSubstep(subId: string) {
    const p = progress();
    if (!p) return;
    const current = new Set(p.checkedSubsteps);
    if (current.has(subId)) {
      current.delete(subId);
    } else {
      current.add(subId);
    }
    updateProgress(p.recipeId, (pp) => { pp.checkedSubsteps = [...current]; });
  }

  function toggleStep() {
    const p = progress();
    const step = currentStep();
    if (!p || !step) return;
    const currentSubs = new Set(p.checkedSubsteps);

    if (stepChecked()) {
      for (const sub of step.substeps) currentSubs.delete(sub.id);
    } else {
      for (const sub of step.substeps) currentSubs.add(sub.id);
    }

    updateProgress(p.recipeId, (pp) => { pp.checkedSubsteps = [...currentSubs]; });
  }

  function goTo(idx: number) {
    const r = recipe();
    if (r && idx >= 0 && idx < r.content.steps.length) {
      updateProgress(r.id, (pp) => { pp.currentCookingStep = idx; });
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
            <div class={styles.progressRow}>
              <span class={styles.progressLabel}>{handsOnTimes().completedTime}m</span>
              <div class={styles.progressBar}>
                <div
                  class={styles.progressFill}
                  style={{ width: `${handsOnTimes().percent}%` }}
                />
              </div>
              <span class={styles.progressLabel}>{handsOnTimes().totalTime - handsOnTimes().completedTime}m</span>
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
                {stepChecked() ? '✓' : ''}
              </button>
              <h2 class={styles.stepTitle}>{currentStep()?.title ?? ''}</h2>
            </div>

            <ul class={styles.substeps}>
              <For each={currentStep()?.substeps ?? []}>
                {(sub) => {
                  const checked = () => checkedSubsteps().has(sub.id);
                  const hasTimes = () => (sub.handsOnTime ?? 0) > 0 || (sub.waitTime ?? 0) > 0;
                  return (
                    <li class={styles.substep}>
                      <button
                        class={styles.stepCheck}
                        classList={{ [styles.checked]: checked() }}
                        onClick={() => toggleSubstep(sub.id)}
                        aria-label={checked() ? 'Uncheck' : 'Check'}
                      >
                        {checked() ? '✓' : ''}
                      </button>
                      <span
                        class={styles.subInstruction}
                        classList={{ [styles.done]: checked() }}
                      >
                        <Show
                          when={sub.segments}
                          fallback={sub.instruction}
                        >
                          <For each={sub.segments}>
                            {(seg) => {
                              if (seg.type === 'text') return seg.text;
                              const ing = ingredientLookup().get(seg.ingredientId);
                              const scaled = scaleQuantity(seg.quantity, originalServings(), targetServings());
                              const segQty = () => toQuantity(scaled, seg.unit);
                              const isChecked = () => checkedIngredients().has(seg.ingredientId);
                              const modeKey = seg.ingredientId;
                              const modeIdx = () => progress()?.ingredientUnitModes[modeKey] ?? 0;
                              const toggled = () => getToggledDisplay(segQty(), seg.unit, modeIdx(), ing?.name);
                              const hasToggle = () => toggled().totalModes > 1;
                              return (
                                <>
                                  <button
                                    class={styles.unitToggle}
                                    classList={{ [styles.hasToggle]: hasToggle() }}
                                    onClick={() => {
                                      if (hasToggle()) {
                                        const modes = { ...p.ingredientUnitModes, [modeKey]: modeIdx() + 1 };
                                        updateProgress(r.id, (pp) => { pp.ingredientUnitModes = modes; });
                                      }
                                    }}
                                    aria-label="Toggle unit"
                                    disabled={!hasToggle()}
                                  >
                                    {formatQuantity(toggled().display.quantity)} {toggled().display.unit}
                                  </button>
                                  {' '}
                                  <span
                                    class={styles.ingredientLink}
                                    classList={{ [styles.checked]: isChecked() }}
                                    onClick={() => toggleIngredient(seg.ingredientId)}
                                  >
                                    {ing?.name ?? ''}
                                  </span>
                                </>
                              );
                            }}
                          </For>
                        </Show>
                        {hasTimes() && (
                          <>{(sub.handsOnTime ?? 0) > 0 && <span class={styles.timeHands}>Hands-on: {sub.handsOnTime}m</span>}{(sub.waitTime ?? 0) > 0 && <span class={styles.timeWait}>Wait: {sub.waitTime}m</span>}</>
                        )}
                      </span>
                    </li>
                  );
                }}
              </For>
            </ul>

            <Show when={currentImages().length > 0}>
              <div class={styles.stepImages}>
                {currentImages().map((url) => (
                  <img class={styles.stepImage} src={url} alt="" loading="lazy" />
                ))}
              </div>
            </Show>
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
