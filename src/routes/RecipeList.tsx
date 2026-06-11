import { useNavigate } from '@solidjs/router';
import { recipes, removeRecipe } from '@/lib/storage';
import RecipeCard from '@/components/RecipeCard';
import styles from './RecipeList.module.css';

export default function RecipeList() {
  const navigate = useNavigate();

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <h1 class={styles.title}>Recipeet</h1>
        <button
          class={styles.settingsBtn}
          onClick={() => navigate('/settings')}
          aria-label="Settings"
        >
          ⚙
        </button>
      </header>

      <main class={styles.main}>
        {recipes.length === 0 ? (
          <div class={styles.empty}>
            <p>No recipes yet</p>
            <button class={styles.cta} onClick={() => navigate('/import')}>
              + Add a Recipe
            </button>
          </div>
        ) : (
          <div class={styles.grid}>
            {recipes.map((r) => (
              <RecipeCard
                recipe={r}
                onClick={() => navigate(`/recipe/${r.id}`)}
                onDelete={() => removeRecipe(r.id)}
              />
            ))}
          </div>
        )}
      </main>

      {recipes.length > 0 && (
        <button
          class={styles.fab}
          onClick={() => navigate('/import')}
          aria-label="Add recipe"
        >
          +
        </button>
      )}
    </div>
  );
}
