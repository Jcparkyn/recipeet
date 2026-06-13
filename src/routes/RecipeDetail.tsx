import { createSignal, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useParams, useNavigate } from '@solidjs/router';
import { recipes, getProgress, removeRecipe, updateProgress } from '@/lib/storage';
import { scaleQuantity, formatQuantity } from '@/lib/scaling';
import ServingsScaler from '@/components/ServingsScaler';
import ConfirmDialog from '@/components/ConfirmDialog';
import styles from './RecipeDetail.module.css';

export default function RecipeDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const recipeId = params.id ?? '';
  const [showDelete, setShowDelete] = createSignal(false);
  const [stepPopoverId, setStepPopoverId] = createSignal<string | null>(null);

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
  const p = getProgress(recipeId);
  const servings = () => p?.currentServings ?? recipe.content.originalServings;

  function setServings(n: number) {
    updateProgress(recipe.id, { currentServings: n });
  }

  function handleDelete() {
    setShowDelete(true);
  }

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <button class={styles.back} onClick={() => navigate('/')} aria-label="Back">
          ←
        </button>
        <div class={styles.headerInfo}>
          <h1 class={styles.title}>{recipe.content.title}</h1>
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
          <ul class={styles.ingredientList}>
            {recipe.content.ingredients.map((ing) => {
              const qty = scaleQuantity(ing.quantity, recipe.content.originalServings, servings());
              return (
                <li class={styles.ingredient}>
                  <span class={styles.ingName}>
                    {ing.name}
                    {ing.notes && ing.notes.length < 50 && (
                      <span class={styles.ingNotes}>{ing.notes}</span>
                    )}
                  </span>
                  <span class={styles.ingQty}>
                    {formatQuantity(qty)} {ing.unit}
                  </span>
                </li>
              );
            })}
          </ul>
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
          classList={{ [styles.secondary]: true }}
          onClick={() => navigate(`/recipe/${recipe.id}/shop`)}
        >
          Shopping List
        </button>
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
