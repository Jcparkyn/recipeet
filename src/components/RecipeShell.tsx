import { createSignal, createContext, useContext, type JSX, type Accessor } from 'solid-js';
import { useParams } from '@solidjs/router';
import AiChat from './AiChat';
import styles from './RecipeShell.module.css';

const AiChatBottomBarContext = createContext<{
  setExtras: (el: JSX.Element | null) => void;
  setCookMode: (v: boolean) => void;
  isCookMode: Accessor<boolean>;
}>();

export function useAiChatBottomBar() {
  const ctx = useContext(AiChatBottomBarContext);
  if (!ctx) throw new Error('useAiChatBottomBar must be used inside RecipeShell');
  return ctx;
}

export default function RecipeShell(props: { children?: JSX.Element }) {
  const params = useParams();
  const recipeId = params.id ?? '';
  const [extras, setExtras] = createSignal<JSX.Element | null>(null);
  const [isCookMode, setCookMode] = createSignal(false);

  const ctx = { setExtras, setCookMode, isCookMode };

  return (
    <AiChatBottomBarContext.Provider value={ctx}>
      <div class={styles.shell}>
        <div class={styles.content}>
          {props.children}
        </div>
        <AiChat recipeId={recipeId} isCookMode={isCookMode()}>
          {extras()}
        </AiChat>
      </div>
    </AiChatBottomBarContext.Provider>
  );
}
