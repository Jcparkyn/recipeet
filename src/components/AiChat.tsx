import { createSignal, createMemo, createEffect, Show, For, onCleanup, onMount, type JSX } from 'solid-js';
import { RealtimeSession } from '@openai/agents/realtime';
import type { RealtimeItem } from '@openai/agents/realtime';
import { recipes, getProgress, updateProgress, settings } from '@/lib/storage';
import { createRecipeAgent } from '@/lib/chat';
import type { ChatMessage } from '@/lib/types';
import styles from './AiChat.module.css';

interface AiChatProps {
  recipeId: string;
  isCookMode: boolean;
  children?: JSX.Element;
}

const REALTIME_MODEL = 'gpt-realtime-2.1-mini';

function getMessageText(item: Record<string, unknown>): string | null {
  if (item.type !== 'message') return null;
  if (item.role !== 'user' && item.role !== 'assistant') return null;
  const content = item.content as Record<string, unknown>[] | undefined;
  if (!content) return null;
  for (const part of content) {
    if (part.type === 'input_text' || part.type === 'output_text') {
      const text = part.text;
      if (typeof text === 'string' && text.trim()) return text.trim();
    }
  }
  for (const part of content) {
    if (part.type === 'input_audio' || part.type === 'output_audio') {
      const transcript = part.transcript;
      if (typeof transcript === 'string' && transcript.trim()) return transcript.trim();
    }
  }
  return null;
}

function extractChatMessages(history: RealtimeItem[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const item of history) {
    const text = getMessageText(item as unknown as Record<string, unknown>);
    if (!text) continue;
    const role = (item as Record<string, unknown>).role as string;
    messages.push({
      id: (item as Record<string, unknown>).itemId as string,
      role: role === 'user' ? 'user' : 'assistant',
      content: text,
      timestamp: Date.now(),
    });
  }
  return messages;
}

export default function AiChat(props: AiChatProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [input, setInput] = createSignal('');
  const [isConnecting, setIsConnecting] = createSignal(false);
  const [isConnected, setIsConnected] = createSignal(false);
  const [isMuted, setIsMuted] = createSignal(false);
  const [isSpeaking, setIsSpeaking] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal('');
  let messagesEnd!: HTMLDivElement;
  let inputRef!: HTMLInputElement;
  let session: RealtimeSession | null = null;

  const recipe = createMemo(() => recipes.find((r) => r.id === props.recipeId));
  const progress = createMemo(() => getProgress(props.recipeId));
  const messages = createMemo(() => progress()?.chatMessages ?? []);

  onMount(() => {
    void navigator.mediaDevices?.getUserMedia;
  });

  function scrollToBottom() {
    messagesEnd?.scrollIntoView({ behavior: 'smooth' });
  }

  createEffect(() => {
    messages();
    if (isOpen()) queueMicrotask(scrollToBottom);
  });

  async function getEphemeralToken(apiKey: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: REALTIME_MODEL,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to get ephemeral token: ${res.status} ${text}`);
    }

    const data = await res.json();
    if (!data.value) {
      throw new Error('No ephemeral token in response');
    }
    return data.value;
  }

  async function connectSession() {
    const r = recipe();
    const p = progress();
    const s = settings();
    if (!r || !p) return;

    if (!s.apiKey) {
      setErrorMsg('Please configure your API key in Settings first.');
      return;
    }

    setIsConnecting(true);
    setErrorMsg('');

    try {
      const agent = createRecipeAgent(
        r,
        p,
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
      );

      session = new RealtimeSession(agent, {
        model: REALTIME_MODEL,
        config: {
          audio: {
            output: {
              speed: 1.5,
            },
          },
        },
      });

      session.on('history_updated', (history: RealtimeItem[]) => {
        const chatMessages = extractChatMessages(history);
        updateProgress(props.recipeId, (pp) => {
          pp.chatMessages = chatMessages;
        });
        queueMicrotask(scrollToBottom);
      });

      session.on('audio_start', () => setIsSpeaking(true));
      session.on('audio_stopped', () => setIsSpeaking(false));

      session.on('error', (err: { type: string; error: unknown }) => {
        const msg = err.error instanceof Error ? err.error.message : String(err.error);
        setErrorMsg(msg);
      });

      const token = await getEphemeralToken(s.apiKey);
      await session.connect({ apiKey: token });

      setIsConnected(true);
      setIsMuted(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setErrorMsg(msg);
      session?.close();
      session = null;
    } finally {
      setIsConnecting(false);
    }
  }

  function disconnectSession() {
    if (session) {
      session.close();
      session = null;
    }
    setIsConnected(false);
    setIsMuted(false);
    setIsSpeaking(false);
  }

  createEffect(() => {
    const open = isOpen();
    if (open && !isConnected() && !isConnecting()) {
      void connectSession();
    } else if (!open && isConnected()) {
      disconnectSession();
    }
  });

  function toggleMute() {
    if (!session) return;
    const newMuted = !isMuted();
    session.mute(newMuted);
    setIsMuted(newMuted);
  }

  function send(e: Event) {
    e.preventDefault();
    const text = input().trim();
    if (!text || !session) return;
    setInput('');
    session.sendMessage(text);
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
    disconnectSession();
  });

  return (
    <>
      <Show when={isOpen()}>
        <div class={styles.panel}>
          <div class={styles.header}>
            <span class={styles.headerTitle}>
              AI Assistant
              <Show when={isConnecting()}>
                <span style="font-weight: normal; color: #999; margin-left: 8px; font-size: 0.8rem;">
                  connecting...
                </span>
              </Show>
            </span>
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
            <Show when={isSpeaking()}>
              <div class={styles.bubble} classList={{ [styles.assistant]: true }}>
                <span class={styles.typing}>
                  <span class={styles.dot} />
                  <span class={styles.dot} />
                  <span class={styles.dot} />
                </span>
              </div>
            </Show>
            <Show when={errorMsg()}>
              <div class={styles.error}>{errorMsg()}</div>
            </Show>
            <div ref={(el) => { messagesEnd = el; }} />
          </div>
          <form class={styles.inputArea} onSubmit={send}>
            <button
              type="button"
              class={styles.micBtn}
              classList={{
                [styles.listening]: isConnected() && !isMuted(),
                [styles.muted]: isMuted(),
              }}
              onClick={toggleMute}
              disabled={!isConnected() || isConnecting()}
              aria-label={isMuted() ? 'Unmute microphone' : 'Mute microphone'}
              title={isMuted() ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted() ? '🔇' : '🎤'}
            </button>
            <input
              ref={(el) => { inputRef = el; }}
              class={styles.input}
              type="text"
              value={input()}
              onInput={(e) => setInput(e.currentTarget.value)}
              placeholder={isConnected() ? 'Ask about this recipe...' : 'Connecting...'}
              disabled={!isConnected() || isConnecting()}
            />
            <button
              class={styles.sendBtn}
              type="submit"
              disabled={!isConnected() || isConnecting() || !input().trim()}
            >
              Send
            </button>
          </form>
        </div>
      </Show>
      <div class={styles.bottomBar}>
        <button
          class={styles.chatBtn}
          classList={{ [styles.active]: isOpen() || isConnecting() }}
          onClick={toggle}
          aria-label="AI Chat"
        >
          <img src="/chef-hat.svg" width="24" height="24" alt="" />
        </button>
        {props.children}
      </div>
    </>
  );
}
