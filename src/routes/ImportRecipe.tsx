import { createSignal, createResource, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { settings, addRecipe } from '@/lib/storage';
import { getParser } from '@/lib/parser';
import { fetchUrlContent } from '@/lib/jina';
import type { Recipe } from '@/lib/types';
import styles from './ImportRecipe.module.css';

type ImportRequest =
  | { type: 'paste'; content: string }
  | { type: 'url'; url: string };

export default function ImportRecipe() {
  const navigate = useNavigate();

  const [tab, setTab] = createSignal<'paste' | 'url'>('paste');
  const [text, setText] = createSignal('');
  const [url, setUrl] = createSignal('');
  const [importReq, setImportReq] = createSignal<ImportRequest | null>(null);
  const [errorDismissed, setErrorDismissed] = createSignal(false);

  const [result] = createResource(importReq, async (req): Promise<Recipe> => {
    let content: string;
    let sourceUrl: string | undefined;

    if (req.type === 'paste') {
      content = req.content;
    } else {
      content = await fetchUrlContent(req.url);
      sourceUrl = req.url;
    }

    const s = settings();
    if (!s.apiKey) {
      throw new Error('Please set your API key in Settings first');
    }

    const parser = getParser(s.provider);
    const parsed = await parser.parse(content, s);

    return {
      id: String(Date.now()),
      content: parsed.content,
      sourceUrl,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  createEffect(() => {
    const recipe = result();
    if (!recipe) return;
    addRecipe(recipe);
    navigate(`/recipe/${recipe.id}`);
  });

  function handlePaste() {
    const content = text().trim();
    if (!content) return;
    setErrorDismissed(false);
    setImportReq({ type: 'paste', content });
  }

  function handleUrl() {
    const u = url().trim();
    if (!u) return;
    setErrorDismissed(false);
    setImportReq({ type: 'url', url: u });
  }

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
            <button class={styles.parseBtn} onClick={handlePaste} disabled={result.loading}>
              {result.loading ? 'Processing...' : 'Parse Recipe'}
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
            <button class={styles.parseBtn} onClick={handleUrl} disabled={result.loading}>
              {result.loading ? 'Processing...' : 'Fetch & Parse'}
            </button>
          </div>
        )}

        {result.error && !errorDismissed() && (
          <div class={styles.error}>
            <p>{result.error.message ?? String(result.error)}</p>
            <button onClick={() => setErrorDismissed(true)}>Dismiss</button>
          </div>
        )}
      </main>
    </div>
  );
}
