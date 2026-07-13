import { createMemo, createSignal, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useParams, useNavigate } from '@solidjs/router';
import { recipes, getProgress, removeRecipe, updateRecipe, updateProgress } from '@/lib/storage';
import type { Ingredient } from '@/lib/types';
import { scaleQuantity, formatQuantity } from '@/lib/scaling';
import { getToggledDisplay, toQuantity } from '@/lib/conversions';
import ServingsScaler from '@/components/ServingsScaler';
import ConfirmDialog from '@/components/ConfirmDialog';
import AiChat from '@/components/AiChat';
import styles from './RecipeDetail.module.css';

interface GroupedIngredient {
  name: string;
  unit: string;
  quantity?: number;
  ids: string[];
  notes?: string;
  category?: string;
}

export default function RecipeDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const recipeId = params.id ?? '';
  const [showDelete, setShowDelete] = createSignal(false);
  const [showReset, setShowReset] = createSignal(false);
  const [sectionPopoverId, setSectionPopoverId] = createSignal<string | null>(null);

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
      updateRecipe(recipe.id, (r) => { r.content.title = newTitle; });
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

  const equipment = () => recipe.content.equipment;

  const hasProgress = createMemo(() => {
    if (!p) return false;
    return (
      p.currentServings !== recipe.content.originalServings ||
      p.checkedShoppingItems.length > 0 ||
      p.checkedSteps.length > 0 ||
      p.checkedIngredients.length > 0 ||
      p.currentCookingSection !== 0 ||
      Object.keys(p.ingredientUnitModes).length > 0 ||
      p.chatMessages.length > 0
    );
  });

  function setServings(n: number) {
    updateProgress(recipe.id, (p) => { p.currentServings = n; });
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
    updateProgress(recipe.id, (p) => { p.checkedShoppingItems = [...current]; });
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
    updateProgress(recipe.id, (p) => { p.checkedShoppingItems = [...current]; });
  }

  const cats = createMemo(() => {
    const g = grouped();
    const map = new Map<string, GroupedIngredient[]>();
    const other: GroupedIngredient[] = [];
    for (const item of g) {
      if (item.category) {
        const existing = map.get(item.category);
        if (existing) {
          existing.push(item);
        } else {
          map.set(item.category, [item]);
        }
      } else {
        other.push(item);
      }
    }
    const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const result: { category: string; items: GroupedIngredient[] }[] = [];
    for (const [cat, items] of sorted) {
      result.push({ category: cat, items });
    }
    if (other.length > 0) result.push({ category: 'Other', items: other });
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
                    class={styles.checkBtn}
                    classList={{ [styles.checked]: allChecked }}
                  >
                    {allChecked ? '✓' : ''}
                  </span>
                  <h3 class={styles.catTitle}>{cat.category}</h3>
                </div>
                <ul class={styles.ingredientList}>
                  {cat.items.map((item) => {
                    const itemChecked = item.ids.every((id) => checked().has(id));
                    const firstId = item.ids[0];
                    const hasQty = item.quantity != null;
                    const qty = () => hasQty ? toQuantity(item.quantity, item.unit) : undefined;
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
                          {itemChecked ? '✓' : ''}
                        </button>
                        <button
                          class={styles.ingName}
                          onClick={() => {
                            for (const id of item.ids) toggleItem(id);
                          }}
                        >
                          {item.name}
                          {item.notes && item.notes.length < 50 && (
                            <span class={styles.ingNotes}>{item.notes}</span>
                          )}
                        </button>
                        <Show when={hasQty}>
                          <button
                            class={styles.ingQty}
                            classList={{ [styles.hasToggle]: hasToggle() }}
                            onClick={() => {
                              if (hasToggle()) {
                                const modes = {
                                  ...(p?.ingredientUnitModes ?? {}),
                                  [firstId]: modeIdx() + 1,
                                };
                                updateProgress(recipe.id, (p) => { p.ingredientUnitModes = modes; });
                              }
                            }}
                            aria-label="Toggle unit"
                            disabled={!hasToggle()}
                          >
                            {formatQuantity(toggled().display.quantity)}{' '}
                            {toggled().display.unit}
                          </button>
                        </Show>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>

        <Show when={equipment()}>
          {(eq) => {
            const items = eq();
            if (!items) return null;
            return (
              <section>
                <h2 class={styles.sectionTitle}>
                  Equipment ({items.length})
                </h2>
                <ul class={styles.equipmentList}>
                  {items.map((item) => (
                    <li class={styles.equipmentItem}>
                      <span class={styles.equipmentName}>
                        {item.name}
                        {item.quantity && item.quantity > 1 && (
                          <span class={styles.equipmentSize}> x{item.quantity}</span>
                        )}
                        {item.notes && <span class={styles.equipmentNotes}> — {item.notes}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          }}
        </Show>

        <section>
          <h2 class={styles.sectionTitle}>Sections ({recipe.content.sections.length})</h2>
          <ol class={styles.sectionList}>
            {recipe.content.sections.map((section) => {
              const showPopover = () => sectionPopoverId() === section.id;
              return (
                <li class={styles.section}>
                  <span class={styles.sectionName}>{section.title}</span>
                  {section.notes && (
                    <>
                      <button
                        class={styles.sectionInfoBtn}
                        onClick={() => setSectionPopoverId(showPopover() ? null : section.id)}
                        aria-label="Section info"
                      >
                        ℹ
                      </button>
                      <Show when={showPopover()}>
                        <Portal>
                          <div class={styles.popoverOverlay} onClick={() => setSectionPopoverId(null)}>
                            <div class={styles.sectionPopover} onClick={(e) => e.stopPropagation()}>
                              <p class={styles.sectionPopoverText}>{section.notes}</p>
                              <button class={styles.popoverClose} onClick={() => setSectionPopoverId(null)}>&times;</button>
                            </div>
                          </div>
                        </Portal>
                      </Show>
                    </>
                  )}
                  {section.images && section.images.length > 0 && (
                    <div class={styles.sectionImages}>
                      {section.images.map((url) => (
                        <img class={styles.sectionImage} src={url} alt="" loading="lazy" />
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </main>

      <AiChat recipeId={recipe.id} isCookMode={false}>
        <Show when={hasProgress()}>
          <button
            class={styles.btnReset}
            onClick={() => setShowReset(true)}
          >
            Reset
          </button>
        </Show>
        <button
          class={styles.btn}
          onClick={() => navigate(`/recipe/${recipe.id}/cook`)}
        >
          Start Cooking
        </button>
      </AiChat>

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

      {showReset() && (
        <ConfirmDialog
          message="Reset all progress for this recipe?"
          confirmLabel="Reset"
          onConfirm={() => {
            setShowReset(false);
            updateProgress(recipe.id, (p) => {
              p.currentServings = recipe.content.originalServings;
              p.checkedShoppingItems = [];
              p.checkedSteps = [];
              p.checkedIngredients = [];
              p.currentCookingSection = 0;
              p.ingredientUnitModes = {};
              p.chatMessages = [];
            });
          }}
          onCancel={() => setShowReset(false)}
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
      if (existing.quantity != null && scaled != null) {
        existing.quantity += scaled;
      } else {
        existing.quantity = existing.quantity ?? scaled;
      }
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
