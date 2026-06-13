import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { settings, setSettings, clearAll } from '@/lib/storage';
import type { LLMSettings } from '@/lib/types';
import ConfirmDialog from '@/components/ConfirmDialog';
import styles from './Settings.module.css';

export default function Settings() {
  const navigate = useNavigate();
  const [showClear, setShowClear] = createSignal(false);

  function update(field: keyof LLMSettings, value: string) {
    setSettings({ ...settings(), [field]: value });
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
            onClick={() => setShowClear(true)}
          >
            Clear All Data
          </button>
        </section>
      </main>

      {showClear() && (
        <ConfirmDialog
          message="Delete all recipes and settings?"
          onConfirm={() => {
            setShowClear(false);
            clearAll();
            navigate('/');
          }}
          onCancel={() => setShowClear(false)}
        />
      )}
    </div>
  );
}
