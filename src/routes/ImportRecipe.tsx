import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { useNavigate } from '@solidjs/router';
import { settings, addRecipe } from '@/lib/storage';
import { getParser } from '@/lib/parser';
import { fetchUrlContent } from '@/lib/jina';
import type { Recipe } from '@/lib/types';
import styles from './ImportRecipe.module.css';

type ImportRequest =
  | { type: 'paste'; content: string }
  | { type: 'url'; url: string };

interface ImportState {
  status: 'idle' | 'fetching' | 'parsing' | 'error';
  error: unknown;
  errorDismissed: boolean;
}

export default function ImportRecipe() {
  const navigate = useNavigate();

  const [tab, setTab] = createSignal<'paste' | 'url'>('paste');
  const [text, setText] = createSignal('');
  const [url, setUrl] = createSignal('');

  const [importState, setImportState] = createStore<ImportState>({
    status: 'idle',
    error: null,
    errorDismissed: false,
  });

  async function runImport(req: ImportRequest) {
    setImportState({ status: 'parsing', error: null, errorDismissed: false });

    try {
      let content: string;
      let sourceUrl: string | undefined;

      if (req.type === 'paste') {
        content = req.content;
      } else {
        setImportState('status', 'fetching');
        content = await fetchUrlContent(req.url);
        sourceUrl = req.url;
        setImportState('status', 'parsing');
      }

      const s = settings();
      if (!s.apiKey) {
        throw new Error('Please set your API key in Settings first');
      }

      const parser = getParser();
      const parsed = await parser.parse(content, s);

      const recipe: Recipe = {
        id: String(Date.now()),
        content: parsed.content,
        sourceUrl,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      addRecipe(recipe);
      navigate(`/recipe/${recipe.id}`);
    } catch (err) {
      console.error('Recipe import failed:', err);
      setImportState({ status: 'error', error: err });
    }
  }

  function handlePaste() {
    const content = text().trim();
    if (!content) return;
    runImport({ type: 'paste', content });
  }

  function handleUrl() {
    const u = url().trim();
    if (!u) return;
    runImport({ type: 'url', url: u });
  }

  const loading = () => importState.status === 'fetching' || importState.status === 'parsing';

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <button class={styles.back} onClick={() => navigate('/')} aria-label="Back">
          ←
        </button>
        <h1 class={styles.title}>Add Recipe</h1>
        <div class={styles.spacer} />
      </header>

      <div class={styles.tabs}>
        <button
          class={styles.tab}
          classList={{ [styles.active]: tab() === 'paste' }}
          onClick={() => setTab('paste')}
        >
          Paste Text
        </button>
        <button
          class={styles.tab}
          classList={{ [styles.active]: tab() === 'url' }}
          onClick={() => setTab('url')}
        >
          Import URL
        </button>
      </div>

      <main class={styles.main}>
        {tab() === 'paste' ? (
          <div class={styles.pasteTab}>
            <textarea
              class={styles.textarea}
              placeholder="Paste your recipe here..."
              value={text()}
              onInput={(e) => setText(e.currentTarget.value)}
              rows={16}
            />
            <button class={styles.parseBtn} onClick={handlePaste} disabled={loading()}>
              {loading() ? 'Parsing...' : 'Parse Recipe'}
            </button>
          </div>
        ) : (
          <div class={styles.urlTab}>
            <input
              class={styles.urlInput}
              type="url"
              placeholder="https://example.com/recipe"
              value={url()}
              onInput={(e) => setUrl(e.currentTarget.value)}
            />
            <button class={styles.parseBtn} onClick={handleUrl} disabled={loading()}>
              {loading() ? (importState.status === 'fetching' ? 'Fetching...' : 'Parsing...') : 'Fetch & Parse'}
            </button>
          </div>
        )}

        {importState.error != null && !importState.errorDismissed && (
          <div class={styles.error}>
            <p>{(importState.error as Error).message ?? "Error importing recipe"}</p>
            <button onClick={() => setImportState('errorDismissed', true)}>Dismiss</button>
          </div>
        )}
      </main>
    </div>
  );
}
