import { Router, Route } from '@solidjs/router';
import { ErrorBoundary } from 'solid-js';
import styles from './App.module.css';
import RecipeList from '@/routes/RecipeList';
import ImportRecipe from '@/routes/ImportRecipe';
import RecipeDetail from '@/routes/RecipeDetail';
import CookingMode from '@/routes/CookingMode';
import Settings from '@/routes/Settings';

function ErrorFallback(err: Error, reset: () => void) {
  return (
    <div class={styles.error}>
      <p>{err.message || 'Something went wrong'}</p>
      <button class={styles.retryBtn} onClick={reset}>Try again</button>
    </div>
  );
}

export default function App() {
  return (
    <div class={styles.app}>
      <ErrorBoundary fallback={ErrorFallback}>
        <Router base={import.meta.env.BASE_URL}>
          <Route path="/" component={RecipeList} />
          <Route path="/import" component={ImportRecipe} />
          <Route path="/settings" component={Settings} />
          <Route path="/recipe/:id" component={RecipeDetail} />
          <Route path="/recipe/:id/cook" component={CookingMode} />
        </Router>
      </ErrorBoundary>
    </div>
  );
}
