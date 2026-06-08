import { Router, Route } from '@solidjs/router';
import { lazy } from 'solid-js';
import { RecipeStoreProvider } from '@/lib/store';
import styles from './App.module.css';

const RecipeList = lazy(() => import('@/routes/RecipeList'));
const ImportRecipe = lazy(() => import('@/routes/ImportRecipe'));
const RecipeDetail = lazy(() => import('@/routes/RecipeDetail'));
const ShoppingList = lazy(() => import('@/routes/ShoppingList'));
const CookingMode = lazy(() => import('@/routes/CookingMode'));
const Settings = lazy(() => import('@/routes/Settings'));

export default function App() {
  return (
    <div class={styles.app}>
      <RecipeStoreProvider>
        <Router>
          <Route path="/" component={RecipeList} />
          <Route path="/import" component={ImportRecipe} />
          <Route path="/settings" component={Settings} />
          <Route path="/recipe/:id" component={RecipeDetail} />
          <Route path="/recipe/:id/shop" component={ShoppingList} />
          <Route path="/recipe/:id/cook" component={CookingMode} />
        </Router>
      </RecipeStoreProvider>
    </div>
  );
}
