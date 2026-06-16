import { createMemo, createSignal, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useParams, useNavigate } from '@solidjs/router';
import { recipes, getProgress, removeRecipe, updateRecipe, updateProgress } from '@/lib/storage';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/types';
import type { Ingredient, ShoppingCategory } from '@/lib/types';
import { scaleQuantity, formatQuantity } from '@/lib/scaling';
import { getToggledDisplay, toQuantity } from '@/lib/conversions';
import ServingsScaler from '@/components/ServingsScaler';
import ConversionPopover from '@/components/ConversionPopover';
import ConfirmDialog from '@/components/ConfirmDialog';
import styles from './RecipeDetail.module.css';

interface GroupedIngredient {
  name: string;
  unit: string;
  quantity: number;
  ids: string[];
  notes?: string;
  category?: ShoppingCategory;
}

export default function RecipeDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const recipeId = params.id ?? '';
  const [showDelete, setShowDelete] = createSignal(false);
  const [stepPopoverId, setStepPopoverId] = createSignal<string | null>(null);
  const [ingPopoverId, setIngPopoverId] = createSignal<string | null>(null);

  const maybeRecipe = recipes.find((x) => x.id === recipeId);
  if (!maybeRecipe) {
    return (
      <div class={styles.page}>
        <p>Recipe not found</p>
        <button onClick={() => navigate('/')}>Go back</button>
      </div>
    );
  }
  const recipe = maybeRecipe;

  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal(recipe.content.title);
  let titleInputRef!: HTMLInputElement;

  function startEdit() {
    setEditValue(recipe.content.title);
    setEditing(true);
    queueMicrotask(() => titleInputRef?.select());
  }

  function commitEdit() {
    const newTitle = editValue().trim();
    if (newTitle && newTitle !== recipe.content.title) {
      updateRecipe(recipe.id, { content: { ...recipe.content, title: newTitle } });
    }
    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function handleTitleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }
  const p = getProgress(recipeId);
  const servings = () => p?.currentServings ?? recipe.content.originalServings;

  function setServings(n: number) {
    updateProgress(recipe.id, { currentServings: n });
  }

  function handleDelete() {
    setShowDelete(true);
  }

  const grouped = createMemo(() =>
    groupIngredients(recipe.content.ingredients, servings(), recipe.content.originalServings),
  );
  const allIds = () => recipe.content.ingredients.map((i) => i.id);
  const checked = () => new Set(p?.checkedShoppingItems ?? []);
  const checkedCount = () => p?.checkedShoppingItems.length ?? 0;
  const totalCount = () => allIds().length;

  function toggleItem(id: string) {
    const current = new Set(p?.checkedShoppingItems ?? []);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    updateProgress(recipe.id, { checkedShoppingItems: [...current] });
  }

  function toggleCategory(ingredients: GroupedIngredient[]) {
    const current = new Set(p?.checkedShoppingItems ?? []);
    const allChecked = ingredients.every((g) => g.ids.every((id) => current.has(id)));
    for (const ing of ingredients) {
      for (const id of ing.ids) {
        if (allChecked) {
          current.delete(id);
        } else {
          current.add(id);
        }
      }
    }
    updateProgress(recipe.id, { checkedShoppingItems: [...current] });
  }

  const cats = createMemo(() => {
    const g = grouped();
    const result: { category: ShoppingCategory; items: GroupedIngredient[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = g.filter((i) => i.category === cat);
      if (items.length > 0) result.push({ category: cat, items });
    }
    const other = g.filter((i) => !i.category || !CATEGORY_ORDER.includes(i.category));
    if (other.length > 0) result.push({ category: 'other', items: other });
    return result;
  });

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <button class={styles.back} onClick={() => navigate('/')} aria-label="Back">
          ←
        </button>
        <div class={styles.headerInfo}>
          {editing() ? (
            <input
              ref={(el) => { titleInputRef = el; }}
              class={styles.titleInput}
              type="text"
              value={editValue()}
              onInput={(e) => setEditValue(e.currentTarget.value)}
              onBlur={commitEdit}
              onKeyDown={handleTitleKeyDown}
            />
          ) : (
            <div class={styles.titleRow}>
              <h1 class={styles.title}>{recipe.content.title}</h1>
              <button
                class={styles.editBtn}
                onClick={startEdit}
                aria-label="Rename recipe"
              >
                ✎
              </button>
            </div>
          )}
          {recipe.sourceUrl && <span class={styles.source}>{recipe.sourceUrl}</span>}
        </div>
        <button class={styles.deleteBtn} onClick={handleDelete} aria-label="Delete">
          🗑
        </button>
      </header>

      <main class={styles.main}>
        <ServingsScaler value={servings()} onChange={setServings} />

        <section>
          <h2 class={styles.sectionTitle}>
            Ingredients ({recipe.content.ingredients.length})
          </h2>

          <div class={styles.progress}>
            <span>
              {checkedCount()} / {totalCount()} checked
            </span>
            <div class={styles.bar}>
              <div
                class={styles.barFill}
                style={{ width: `${totalCount() > 0 ? (checkedCount() / totalCount()) * 100 : 0}%` }}
              />
            </div>
          </div>

          {cats().map((cat) => {
            const allChecked = cat.items.every((item) =>
              item.ids.every((id) => checked().has(id)),
            );
            return (
              <div class={styles.category}>
                <div
                  class={styles.catHeader}
                  onClick={() => toggleCategory(cat.items)}
                >
                  <span
                    class={styles.catCheck}
                    classList={{ [styles.checked]: allChecked }}
                  >
                    {allChecked ? '✓' : '○'}
                  </span>
                  <h3 class={styles.catTitle}>{CATEGORY_LABELS[cat.category]}</h3>
                </div>
                <ul class={styles.ingredientList}>
                  {cat.items.map((item) => {
                    const itemChecked = item.ids.every((id) => checked().has(id));
                    const firstId = item.ids[0];
                    const showPopover = ingPopoverId() === firstId;
                    const ingredient = recipe.content.ingredients.find(
                      (i) => i.id === firstId,
                    );
                    const qty = () => toQuantity(item.quantity, item.unit);
                    const modeIdx = () => p?.ingredientUnitModes[firstId] ?? 0;
                    const toggled = () =>
                      getToggledDisplay(qty(), item.unit, modeIdx(), item.name);
                    const hasToggle = () => toggled().totalModes > 1;
                    return (
                      <li class={styles.ingredient}>
                        <button
                          class={styles.checkBtn}
                          classList={{ [styles.checked]: itemChecked }}
                          onClick={() => {
                            for (const id of item.ids) toggleItem(id);
                          }}
                          aria-label={item.name}
                        >
                          {itemChecked ? '✓' : '○'}
                        </button>
                        <button
                          class={styles.ingName}
                          onClick={() =>
                            setIngPopoverId(showPopover ? null : firstId)
                          }
                        >
                          {item.name}
                          {item.notes && item.notes.length < 50 && (
                            <span class={styles.ingNotes}>{item.notes}</span>
                          )}
                        </button>
                        <button
                          class={styles.ingQty}
                          classList={{ [styles.hasToggle]: hasToggle() }}
                          onClick={() => {
                            if (hasToggle()) {
                              const modes = {
                                ...(p?.ingredientUnitModes ?? {}),
                                [firstId]: modeIdx() + 1,
                              };
                              updateProgress(recipe.id, {
                                ingredientUnitModes: modes,
                              });
                            }
                          }}
                          aria-label="Toggle unit"
                          disabled={!hasToggle()}
                        >
                          {formatQuantity(toggled().display.quantity)}{' '}
                          {toggled().display.unit}
                        </button>
                        {showPopover && ingredient && (
                          <ConversionPopover
                            quantity={toQuantity(
                              item.quantity,
                              ingredient.unit,
                            )}
                            ingredientName={ingredient.name}
                            onClose={() => setIngPopoverId(null)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>

        <section>
          <h2 class={styles.sectionTitle}>Steps ({recipe.content.steps.length})</h2>
          <ol class={styles.stepList}>
            {recipe.content.steps.map((step) => {
              const showPopover = () => stepPopoverId() === step.id;
              return (
                <li class={styles.step}>
                  <span class={styles.stepTitle}>{step.title}</span>
                  {step.notes && (
                    <>
                      <button
                        class={styles.stepInfoBtn}
                        onClick={() => setStepPopoverId(showPopover() ? null : step.id)}
                        aria-label="Step info"
                      >
                        ℹ
                      </button>
                      <Show when={showPopover()}>
                        <Portal>
                          <div class={styles.popoverOverlay} onClick={() => setStepPopoverId(null)}>
                            <div class={styles.stepPopover} onClick={(e) => e.stopPropagation()}>
                              <p class={styles.stepPopoverText}>{step.notes}</p>
                              <button class={styles.popoverClose} onClick={() => setStepPopoverId(null)}>&times;</button>
                            </div>
                          </div>
                        </Portal>
                      </Show>
                    </>
                  )}
                  {step.images && step.images.length > 0 && (
                    <div class={styles.stepImages}>
                      {step.images.map((url) => (
                        <img class={styles.stepImage} src={url} alt="" loading="lazy" />
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </main>

      <footer class={styles.footer}>
        <button
          class={styles.btn}
          onClick={() => navigate(`/recipe/${recipe.id}/cook`)}
        >
          Start Cooking
        </button>
      </footer>

      {showDelete() && (
        <ConfirmDialog
          message="Delete this recipe?"
          onConfirm={() => {
            setShowDelete(false);
            removeRecipe(recipe.id);
            navigate('/');
          }}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}

function groupIngredients(
  ingredients: Ingredient[],
  targetServings: number,
  originalServings: number,
): GroupedIngredient[] {
  const map = new Map<string, GroupedIngredient>();
  for (const ing of ingredients) {
    const key = `${ing.name.toLowerCase().trim()}|${ing.unit.toLowerCase().trim()}`;
    const scaled = scaleQuantity(
      ing.quantity,
      originalServings,
      targetServings,
    );
    const existing = map.get(key);
    if (existing) {
      existing.quantity += scaled;
      existing.ids.push(ing.id);
    } else {
      map.set(key, {
        name: ing.name,
        unit: ing.unit,
        quantity: scaled,
        ids: [ing.id],
        notes: ing.notes,
        category: ing.category,
      });
    }
  }
  return [...map.values()];
}
