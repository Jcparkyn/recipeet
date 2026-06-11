import { Router, Route } from '@solidjs/router';
import { ErrorBoundary, lazy, Suspense } from 'solid-js';
import styles from './App.module.css';

const RecipeList = lazy(() => import('@/routes/RecipeList'));
const ImportRecipe = lazy(() => import('@/routes/ImportRecipe'));
const RecipeDetail = lazy(() => import('@/routes/RecipeDetail'));
const ShoppingList = lazy(() => import('@/routes/ShoppingList'));
const CookingMode = lazy(() => import('@/routes/CookingMode'));
const Settings = lazy(() => import('@/routes/Settings'));

function Fallback() {
  return <div class={styles.loading}>Loading...</div>;
}

function ErrorFallback(err: Error, reset: () => void) {
  return (
    <div class={styles.error}>
      <p>Something went wrong</p>
      <button class={styles.retryBtn} onClick={reset}>Try again</button>
    </div>
  );
}

export default function App() {
  return (
    <div class={styles.app}>
      <ErrorBoundary fallback={ErrorFallback}>
        <Suspense fallback={<Fallback />}>
          <Router>
            <Route path="/" component={RecipeList} />
            <Route path="/import" component={ImportRecipe} />
            <Route path="/settings" component={Settings} />
            <Route path="/recipe/:id" component={RecipeDetail} />
            <Route path="/recipe/:id/shop" component={ShoppingList} />
            <Route path="/recipe/:id/cook" component={CookingMode} />
          </Router>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
