import { createSignal, createMemo, createEffect, Show, For, onCleanup, type JSX } from 'solid-js';
import { recipes, getProgress, updateProgress, settings } from '@/lib/storage';
import { createChatStream } from '@/lib/chat';
import type { ChatMessage } from '@/lib/types';
import styles from './AiChat.module.css';

interface AiChatProps {
  recipeId: string;
  isCookMode: boolean;
  children?: JSX.Element;
}

let chatMsgId = 0;

export default function AiChat(props: AiChatProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [input, setInput] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [streamText, setStreamText] = createSignal('');
  const [errorMsg, setErrorMsg] = createSignal('');
  let messagesEnd!: HTMLDivElement;
  let inputRef!: HTMLInputElement;
  let abortController: AbortController | null = null;

  const recipe = createMemo(() => recipes.find((r) => r.id === props.recipeId));
  const progress = createMemo(() => getProgress(props.recipeId));
  const messages = createMemo(() => progress()?.chatMessages ?? []);

  function scrollToBottom() {
    messagesEnd?.scrollIntoView({ behavior: 'smooth' });
  }

  createEffect(() => {
    messages();
    streamText();
    if (isOpen()) queueMicrotask(scrollToBottom);
  });

  function addMessage(role: 'user' | 'assistant', content: string) {
    const msg: ChatMessage = {
      id: `m${++chatMsgId}`,
      role,
      content,
      timestamp: Date.now(),
    };
    updateProgress(props.recipeId, (p) => {
      p.chatMessages = [...p.chatMessages, msg];
    });
    return msg;
  }

  function send(e: Event) {
    e.preventDefault();
    const text = input().trim();
    if (!text || loading()) return;

    const r = recipe();
    const p = progress();
    const s = settings();
    if (!r || !p) return;

    if (!s.apiKey) {
      setErrorMsg('Please configure your API key in Settings first.');
      return;
    }

    setInput('');
    setErrorMsg('');
    setStreamText('');
    setLoading(true);

    const history = messages();
    addMessage('user', text);

    abortController = new AbortController();

    void (async () => {
      try {
        const result = createChatStream(
          r,
          p,
          history,
          text,
          {
            setSubstep(substepId, checked) {
              const cp = getProgress(props.recipeId);
              if (!cp) return;
              const current = new Set(cp.checkedSubsteps);
              if (checked) current.add(substepId);
              else current.delete(substepId);
              updateProgress(props.recipeId, (pp) => { pp.checkedSubsteps = [...current]; });
            },
            completeStep(stepIndex) {
              const cr = recipes.find((r2) => r2.id === props.recipeId);
              if (!cr) return;
              const step = cr.content.steps[stepIndex];
              if (!step) return;
              const cp = getProgress(props.recipeId);
              if (!cp) return;
              const current = new Set(cp.checkedSubsteps);
              for (const sub of step.substeps) current.add(sub.id);
              updateProgress(props.recipeId, (pp) => { pp.checkedSubsteps = [...current]; });
            },
            goToStep(stepIndex) {
              updateProgress(props.recipeId, (pp) => { pp.currentCookingStep = stepIndex; });
            },
            getProgress() {
              const cp = getProgress(props.recipeId);
              return cp ?? {
                recipeId: props.recipeId,
                currentServings: 0,
                currentCookingStep: 0,
                checkedShoppingItems: [],
                checkedSubsteps: [],
                checkedIngredients: [],
                ingredientUnitModes: {},
                chatMessages: [],
              };
            },
          },
          props.isCookMode,
          s.apiKey,
          s.baseUrl,
          s.model,
        );

        let fullText = '';
        for await (const textPart of result.textStream) {
          fullText += textPart;
          setStreamText(fullText);
        }

        if (fullText) {
          addMessage('assistant', fullText);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'An error occurred';
        setErrorMsg(msg);
      } finally {
        setLoading(false);
        setStreamText('');
        abortController = null;
      }
    })();
  }

  function toggle() {
    setIsOpen(!isOpen());
    setErrorMsg('');
    if (!isOpen()) {
      queueMicrotask(() => {
        inputRef?.focus();
        scrollToBottom();
      });
    }
  }

  onCleanup(() => {
    abortController?.abort();
  });

  return (
    <>
      <Show when={isOpen()}>
        <div class={styles.panel}>
          <div class={styles.header}>
            <span class={styles.headerTitle}>AI Assistant</span>
            <button class={styles.closeBtn} onClick={toggle} aria-label="Close chat">
              ✕
            </button>
          </div>
          <div class={styles.messages}>
            <For each={messages()}>
              {(msg) => (
                <div
                  class={styles.bubble}
                  classList={{
                    [styles.user]: msg.role === 'user',
                    [styles.assistant]: msg.role === 'assistant',
                  }}
                >
                  {msg.content}
                </div>
              )}
            </For>
            <Show when={loading()}>
              <div class={styles.bubble} classList={{ [styles.assistant]: true }}>
                {streamText() || (
                  <span class={styles.typing}>
                    <span class={styles.dot} />
                    <span class={styles.dot} />
                    <span class={styles.dot} />
                  </span>
                )}
              </div>
            </Show>
            <Show when={errorMsg()}>
              <div class={styles.error}>{errorMsg()}</div>
            </Show>
            <div ref={(el) => { messagesEnd = el; }} />
          </div>
          <form class={styles.inputArea} onSubmit={send}>
            <input
              ref={(el) => { inputRef = el; }}
              class={styles.input}
              type="text"
              value={input()}
              onInput={(e) => setInput(e.currentTarget.value)}
              placeholder="Ask about this recipe..."
              disabled={loading()}
            />
            <button
              class={styles.sendBtn}
              type="submit"
              disabled={loading() || !input().trim()}
            >
              Send
            </button>
          </form>
        </div>
      </Show>
      <div class={styles.bottomBar}>
        <button
          class={styles.chatBtn}
          classList={{ [styles.active]: isOpen() }}
          onClick={toggle}
          aria-label="AI Chat"
        >
          💬
        </button>
        {props.children}
      </div>
    </>
  );
}
