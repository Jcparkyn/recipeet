import { createMemo, createSignal, Show, For } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { recipes, getProgress, updateProgress } from '@/lib/storage';
import { scaleQuantity, formatQuantity } from '@/lib/scaling';
import { getToggledDisplay, toQuantity } from '@/lib/conversions';
import AiChat from '@/components/AiChat';
import styles from './CookingMode.module.css';

export default function CookingMode() {
  const params = useParams();
  const navigate = useNavigate();
  const recipeId = params.id ?? '';

  const recipe = createMemo(() => recipes.find((r) => r.id === recipeId));
  const progress = createMemo(() => getProgress(recipeId));

  const sections = createMemo(() => recipe()?.content.sections ?? []);
  const currentIdx = createMemo(() => progress()?.currentCookingSection ?? 0);
  const currentSection = createMemo(() => sections()[currentIdx()]);
  const currentImages = createMemo(() => currentSection()?.images?.filter(Boolean) ?? []);
  const checkedSteps = createMemo(() => new Set(progress()?.checkedSteps));
  const checkedIngredients = createMemo(() => new Set(progress()?.checkedIngredients));

  const sectionChecked = createMemo(() => {
    const section = currentSection();
    if (!section) return false;
    return section.steps.length > 0 && section.steps.every((step) => checkedSteps().has(step.id));
  });

  const isLastSection = createMemo(() => currentIdx() >= sections().length - 1);
  const isFirstSection = createMemo(() => currentIdx() <= 0);
  const handsOnTimes = createMemo(() => {
    const allSections = sections();
    const checkSteps = checkedSteps();
    const idx = currentIdx();
    let completedTime = 0;
    let totalTime = 0;
    for (let i = 0; i < allSections.length; i++) {
      for (const step of allSections[i].steps) {
        const time = step.handsOnTime ?? 0;
        totalTime += time;
        if (i < idx || (i === idx && checkSteps.has(step.id))) {
          completedTime += time;
        }
      }
    }
    const percent = totalTime === 0
      ? ((idx + 1) / allSections.length) * 100
      : (completedTime / totalTime) * 100;
    return { completedTime, totalTime, percent };
  });

  const [completed, setCompleted] = createSignal(false);

  const ingredientLookup = createMemo(() => {
    const map = new Map<string, { name: string; quantity?: number; unit: string }>();
    for (const ing of recipe()?.content.ingredients ?? []) {
      map.set(ing.id, { name: ing.name, quantity: ing.quantity, unit: ing.unit });
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

  function toggleStep(stepId: string) {
    const p = progress();
    if (!p) return;
    const current = new Set(p.checkedSteps);
    if (current.has(stepId)) {
      current.delete(stepId);
    } else {
      current.add(stepId);
    }
    updateProgress(p.recipeId, (pp) => { pp.checkedSteps = [...current]; });
  }

  function toggleSection() {
    const p = progress();
    const section = currentSection();
    if (!p || !section) return;
    const currentSteps = new Set(p.checkedSteps);

    if (sectionChecked()) {
      for (const step of section.steps) currentSteps.delete(step.id);
    } else {
      for (const step of section.steps) currentSteps.add(step.id);
    }

    updateProgress(p.recipeId, (pp) => { pp.checkedSteps = [...currentSteps]; });
  }

  function goTo(idx: number) {
    const r = recipe();
    if (r && idx >= 0 && idx < r.content.sections.length) {
      updateProgress(r.id, (pp) => { pp.currentCookingSection = idx; });
    }
  }

  function next() {
    if (isLastSection()) {
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
            <span class={styles.sectionCount}>
              Section {currentIdx() + 1} of {sections().length}
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
            <div class={styles.sectionHeader} onClick={toggleSection}>
              <button
                class={styles.stepCheck}
                classList={{ [styles.checked]: sectionChecked() }}
                aria-label={sectionChecked() ? 'Uncheck section' : 'Check section'}
              >
                {sectionChecked() ? '✓' : ''}
              </button>
              <h2 class={styles.sectionTitle}>{currentSection()?.title ?? ''}</h2>
            </div>

            <ul class={styles.steps}>
              <For each={currentSection()?.steps ?? []}>
                {(step) => {
                  const checked = () => checkedSteps().has(step.id);
                  const hasTimes = () => (step.handsOnTime ?? 0) > 0 || (step.waitTime ?? 0) > 0;
                  return (
                    <li class={styles.step}>
                      <button
                        class={styles.stepCheck}
                        classList={{ [styles.checked]: checked() }}
                        onClick={() => toggleStep(step.id)}
                        aria-label={checked() ? 'Uncheck' : 'Check'}
                      >
                        {checked() ? '✓' : ''}
                      </button>
                      <span
                        class={styles.stepInstruction}
                        classList={{ [styles.done]: checked() }}
                      >
                        <Show
                          when={step.segments}
                          fallback={step.instruction}
                        >
                           <For each={step.segments}>
                            {(seg) => {
                              if (seg.type === 'text') return seg.text;
                              const ing = ingredientLookup().get(seg.ingredientId);
                              const qty = ing?.quantity;
                              const scaled = scaleQuantity(qty, originalServings(), targetServings());
                              const hasQty = qty != null && scaled != null;
                              const segQty = () => hasQty ? toQuantity(qty, ing?.unit ?? '') : undefined;
                              const isChecked = () => checkedIngredients().has(seg.ingredientId);
                              const modeKey = seg.ingredientId;
                              const modeIdx = () => progress()?.ingredientUnitModes[modeKey] ?? 0;
                              const toggled = () => getToggledDisplay(segQty(), ing?.unit ?? '', modeIdx(), ing?.name);
                              const hasToggle = () => toggled().totalModes > 1;
                              return (
                                <>
                                  <Show when={hasQty}>
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
                                  </Show>
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
                          <>{(step.handsOnTime ?? 0) > 0 && <span class={styles.timeHands}>Hands-on: {step.handsOnTime}m</span>}{(step.waitTime ?? 0) > 0 && <span class={styles.timeWait}>Wait: {step.waitTime}m</span>}</>
                        )}
                      </span>
                    </li>
                  );
                }}
              </For>
            </ul>

            <Show when={currentImages().length > 0}>
              <div class={styles.sectionImages}>
                {currentImages().map((url) => (
                  <img class={styles.sectionImage} src={url} alt="" loading="lazy" />
                ))}
              </div>
            </Show>
          </div>
        </main>

        <AiChat recipeId={r.id} isCookMode={true}>
          <div class={styles.navBar}>
            <button
              class={styles.navBtn}
              classList={{ [styles.disabled]: isFirstSection() }}
              onClick={prev}
              disabled={isFirstSection()}
            >
            ❮
            </button>
            <div class={styles.dots}>
              <For each={sections()}>
                {(_, i) => (
                  <button
                    class={styles.dot}
                    classList={{ [styles.active]: i() === currentIdx() }}
                    onClick={() => goTo(i())}
                    aria-label={`Go to section ${i() + 1}`}
                  />
                )}
              </For>
            </div>
            <button
              class={styles.navBtn}
              classList={{ [styles.primary]: isLastSection() }}
              onClick={next}
            >
              {isLastSection() ? '✓' : '❯'}
            </button>
          </div>
        </AiChat>
      </div>
    </Show>
  );
}
