import { createContext, useContext } from 'solid-js';
import { createRecipeStore } from './storage';

type Store = ReturnType<typeof createRecipeStore>;

const StoreContext = createContext<Store | null>(null);

export function RecipeStoreProvider(props: { children: unknown }) {
  const store = createRecipeStore();
  return (
    <StoreContext.Provider value={store}>
      {props.children as never}
    </StoreContext.Provider>
  );
}

export function useRecipes(): Store | null {
  return useContext(StoreContext);
}
