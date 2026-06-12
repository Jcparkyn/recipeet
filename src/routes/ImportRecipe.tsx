import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { settings, addRecipe } from '@/lib/storage';
import { getParser } from '@/lib/parser';
import { fetchUrlContent } from '@/lib/jina';
import type { Recipe } from '@/lib/types';
import styles from './ImportRecipe.module.css';

export default function ImportRecipe() {
  const navigate = useNavigate();

  const [tab, setTab] = createSignal<'paste' | 'url'>('paste');
  const [text, setText] = createSignal('');
  const [url, setUrl] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [status, setStatus] = createSignal('');

  async function handlePaste() {
    const content = text().trim();
    if (!content) return;
    setLoading(true);
    setStatus('Parsing recipe...');
    await parseAndSave(content);
  }

  async function handleUrl() {
    const u = url().trim();
    if (!u) return;
    setError('');
    setLoading(true);
    try {
      setStatus('Fetching page...');
      const content = await fetchUrlContent(u);
      setStatus('Parsing recipe...');
      await parseAndSave(content, u);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch URL');
      setStatus('');
      setLoading(false);
    }
  }

  async function parseAndSave(content: string, sourceUrl?: string) {
    const s = settings();
    if (!s.apiKey) {
      setError('Please set your API key in Settings first');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setStatus('Parsing recipe...');
    try {
      const parser = getParser(s.provider);
      const result = await parser.parse(content, s);
      const recipe: Recipe = {
        id: crypto.randomUUID(),
        content: result.content,
        sourceUrl,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addRecipe(recipe);
      navigate(`/recipe/${recipe.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parsing failed');
      setStatus('');
    } finally {
      setLoading(false);
    }
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
            <button class={styles.parseBtn} onClick={handlePaste} disabled={loading()}>
              {loading() ? status() : 'Parse Recipe'}
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
              {loading() ? status() : 'Fetch & Parse'}
            </button>
          </div>
        )}

        {error() && (
          <div class={styles.error}>
            <p>{error()}</p>
            <button onClick={() => setError('')}>Dismiss</button>
          </div>
        )}
      </main>
    </div>
  );
}
