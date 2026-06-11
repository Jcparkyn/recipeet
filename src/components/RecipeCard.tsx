import { createSignal } from 'solid-js';
import type { Recipe } from '@/lib/types';
import ConfirmDialog from '@/components/ConfirmDialog';
import styles from './RecipeCard.module.css';

interface Props {
  recipe: Recipe;
  onClick: () => void;
  onDelete: () => void;
}

export default function RecipeCard(props: Props) {
  const date = () => new Date(props.recipe.createdAt).toLocaleDateString();
  const [showDelete, setShowDelete] = createSignal(false);

  return (
    <>
      <div class={styles.card} onClick={props.onClick}>
        <div class={styles.body}>
          <h3 class={styles.title}>{props.recipe.content.title}</h3>
          <span class={styles.meta}>
            {props.recipe.content.originalServings} servings &middot; {date()}
          </span>
        </div>
        <button
          class={styles.delete}
          onClick={(e) => {
            e.stopPropagation();
            setShowDelete(true);
          }}
          aria-label="Delete recipe"
        >
          ×
        </button>
      </div>
      {showDelete() && (
        <ConfirmDialog
          message="Delete this recipe?"
          onConfirm={() => {
            setShowDelete(false);
            props.onDelete();
          }}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </>
  );
}
