import { useNavigate } from '@solidjs/router';
import { useRecipes } from '@/lib/store';
import type { LLMSettings } from '@/lib/types';
import styles from './Settings.module.css';

export default function Settings() {
  const navigate = useNavigate();
  const ctx = useRecipes();
  if (!ctx) return null;

  const settings = ctx.settings;

  function update(field: keyof LLMSettings, value: string) {
    ctx!.setSettings({ ...settings(), [field]: value });
  }

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <button class={styles.back} onClick={() => navigate('/')} aria-label="Back">
          ←
        </button>
        <h1 class={styles.title}>Settings</h1>
        <div class={styles.spacer} />
      </header>

      <main class={styles.main}>
        <section class={styles.section}>
          <h2 class={styles.sectionTitle}>LLM Configuration</h2>

          <label class={styles.label}>
            Provider
            <input
              class={styles.input}
              value={settings().provider}
              onInput={(e) => update('provider', e.currentTarget.value)}
            />
          </label>

          <label class={styles.label}>
            API Key
            <input
              class={styles.input}
              type="password"
              value={settings().apiKey}
              onInput={(e) => update('apiKey', e.currentTarget.value)}
              placeholder="sk-..."
            />
          </label>

          <label class={styles.label}>
            Base URL
            <input
              class={styles.input}
              value={settings().baseUrl}
              onInput={(e) => update('baseUrl', e.currentTarget.value)}
            />
          </label>

          <label class={styles.label}>
            Model
            <input
              class={styles.input}
              value={settings().model}
              onInput={(e) => update('model', e.currentTarget.value)}
            />
          </label>
        </section>

        <section class={styles.section}>
          <h2 class={styles.sectionTitle}>Data</h2>
          <button
            class={styles.dangerBtn}
            onClick={() => {
              if (confirm('Delete all recipes and settings?')) {
                ctx!.clearAll();
                navigate('/');
              }
            }}
          >
            Clear All Data
          </button>
        </section>
      </main>
    </div>
  );
}
