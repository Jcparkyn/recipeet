import { useParams, useNavigate } from '@solidjs/router';
import { recipes, getProgress, removeRecipe, updateProgress } from '@/lib/storage';
import { scaleQuantity, formatQuantity } from '@/lib/scaling';
import ServingsScaler from '@/components/ServingsScaler';
import styles from './RecipeDetail.module.css';

export default function RecipeDetail() {
  const params = useParams();
  const navigate = useNavigate();

  const recipe = () => recipes.find((r) => r.id === params.id);
  const progress = () => getProgress(params.id);

  if (!recipe()) {
    return (
      <div class={styles.page}>
        <p>Recipe not found</p>
        <button onClick={() => navigate('/')}>Go back</button>
      </div>
    );
  }

  const r = recipe()!;
  const p = progress();
  const servings = () => p?.currentServings ?? r.content.originalServings;

  function setServings(n: number) {
    updateProgress(r.id, { currentServings: n });
  }

  function handleDelete() {
    if (confirm('Delete this recipe?')) {
      removeRecipe(r.id);
      navigate('/');
    }
  }

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <button class={styles.back} onClick={() => navigate('/')} aria-label="Back">
          ←
        </button>
        <div class={styles.headerInfo}>
          <h1 class={styles.title}>{r.content.title}</h1>
          {r.sourceUrl && <span class={styles.source}>{r.sourceUrl}</span>}
        </div>
        <button class={styles.deleteBtn} onClick={handleDelete} aria-label="Delete">
          🗑
        </button>
      </header>

      <main class={styles.main}>
        <ServingsScaler value={servings()} onChange={setServings} />

        <section>
          <h2 class={styles.sectionTitle}>
            Ingredients ({r.content.ingredients.length})
          </h2>
          <ul class={styles.ingredientList}>
            {r.content.ingredients.map((ing) => {
              const qty = scaleQuantity(ing.quantity, r.content.originalServings, servings());
              return (
                <li class={styles.ingredient}>
                  <span class={styles.ingName}>{ing.name}</span>
                  <span class={styles.ingQty}>
                    {formatQuantity(qty)} {ing.unit}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 class={styles.sectionTitle}>Steps ({r.content.steps.length})</h2>
          <ol class={styles.stepList}>
            {r.content.steps.map((step) => (
              <li class={styles.step}>{step.title}</li>
            ))}
          </ol>
        </section>
      </main>

      <footer class={styles.footer}>
        <button
          class={styles.btn}
          classList={{ [styles.secondary]: true }}
          onClick={() => navigate(`/recipe/${r.id}/shop`)}
        >
          Shopping List
        </button>
        <button
          class={styles.btn}
          onClick={() => navigate(`/recipe/${r.id}/cook`)}
        >
          Start Cooking
        </button>
      </footer>
    </div>
  );
}
