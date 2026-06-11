import { createSignal } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { useRecipes } from '@/lib/store';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/types';
import type { Ingredient, ShoppingCategory } from '@/lib/types';
import { scaleQuantity, formatQuantity } from '@/lib/scaling';
import ConversionPopover from '@/components/ConversionPopover';
import styles from './ShoppingList.module.css';

interface GroupedIngredient {
  name: string;
  unit: string;
  quantity: number;
  ids: string[];
  notes?: string;
  category?: ShoppingCategory;
}

export default function ShoppingList() {
  const params = useParams();
  const navigate = useNavigate();
  const ctx = useRecipes();

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
  const servings = () => p.currentServings;

  const grouped = () => groupIngredients(r.content.ingredients, servings(), r.content.originalServings);
  const allIds = () => r.content.ingredients.map((i) => i.id);
  const checked = () => new Set(p.checkedShoppingItems);
  const checkedCount = () => p.checkedShoppingItems.length;
  const totalCount = () => allIds().length;

  function toggleItem(id: string) {
    const current = new Set(p.checkedShoppingItems);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    ctx.updateProgress(r.id, { checkedShoppingItems: [...current] });
  }

  function toggleCategory(ingredients: GroupedIngredient[]) {
    const current = new Set(p.checkedShoppingItems);
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
    ctx.updateProgress(r.id, { checkedShoppingItems: [...current] });
  }

  const cats = () => {
    const g = grouped();
    const result: { category: ShoppingCategory; items: GroupedIngredient[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = g.filter((i) => i.category === cat);
      if (items.length > 0) result.push({ category: cat, items });
    }
    const other = g.filter((i) => !i.category || !CATEGORY_ORDER.includes(i.category));
    if (other.length > 0) result.push({ category: 'other', items: other });
    return result;
  };

  const [popoverId, setPopoverId] = createSignal<string | null>(null);

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <button
          class={styles.back}
          onClick={() => navigate(`/recipe/${r.id}`)}
          aria-label="Back"
        >
          ←
        </button>
        <h1 class={styles.title}>Shopping List</h1>
        <div class={styles.spacer} />
      </header>

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

      <main class={styles.main}>
        {cats().map((cat) => {
          const allChecked = cat.items.every((item) =>
            item.ids.every((id) => checked().has(id)),
          );
          return (
            <section class={styles.category}>
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
                <h2 class={styles.catTitle}>{CATEGORY_LABELS[cat.category]}</h2>
              </div>
              <ul class={styles.items}>
                {cat.items.map((item) => {
                  const itemChecked = item.ids.every((id) => checked().has(id));
                  const firstId = item.ids[0];
                  const showPopover = popoverId() === firstId;
                  const ingredient = r.content.ingredients.find(
                    (i) => i.id === firstId,
                  );
                  return (
                    <li class={styles.item}>
                      <div class={styles.itemRow}>
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
                          class={styles.itemName}
                          onClick={() =>
                            setPopoverId(showPopover ? null : firstId)
                          }
                        >
                          {item.name}
                          {item.notes ? ` (${item.notes})` : ''}
                        </button>
                        <span class={styles.itemQty}>
                          {formatQuantity(item.quantity)} {item.unit}
                        </span>
                      </div>
                      {showPopover && ingredient && (
                        <ConversionPopover
                          quantity={
                            item.quantity
                          }
                          unit={ingredient.unit}
                          ingredientName={ingredient.name}
                          onClose={() => setPopoverId(null)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>

      <footer class={styles.footer}>
        <button
          class={styles.footerBtn}
          onClick={() => navigate(`/recipe/${r.id}/cook`)}
        >
          Start Cooking
        </button>
      </footer>
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
    const scaled = scaleQuantity(ing.quantity, originalServings, targetServings);
    if (map.has(key)) {
      const existing = map.get(key)!;
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
