import { createSignal, createMemo, createEffect, Show, For, onCleanup, onMount, type JSX } from 'solid-js';
import { RealtimeSession } from '@openai/agents/realtime';
import type { RealtimeItem } from '@openai/agents/realtime';
import { recipes, getProgress, updateProgress, settings } from '@/lib/storage';
import { createRecipeAgent } from '@/lib/chat';
import upChevronSvg from '/up-chevron.svg';
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

// The server's history_updated events include `audio: null` in input_audio /
// output_audio content entries (no audio bytes are returned in history). When we
// restore saved messages via session.updateHistory(), the library sends
// conversation.item.create events to the server, which rejects `audio: null`.
// Convert these entries to their text equivalents using the transcript instead.
function sanitizeItemsForRestore(items: RealtimeItem[]): RealtimeItem[] {
  return items.map((item) => {
    const raw = item as unknown as Record<string, unknown>;
    if (raw.type !== 'message') return item;
    const role = raw.role as string;
    if (role !== 'user' && role !== 'assistant') return item;
    const content = raw.content as Record<string, unknown>[] | undefined;
    if (!content) return item;
    let changed = false;
    const cleaned = content.map((part) => {
      const partType = part.type as string;
      const isInputAudio = partType === 'input_audio';
      const isOutputAudio = partType === 'output_audio';
      if ((isInputAudio || isOutputAudio) && (part.audio === null || part.audio === undefined)) {
        changed = true;
        const transcript = part.transcript;
        if (typeof transcript === 'string' && transcript.trim()) {
          return { type: isInputAudio ? 'input_text' : 'output_text', text: transcript };
        }
        return null;
      }
      return part;
    }).filter((p): p is Record<string, unknown> => p !== null);
    if (!changed) return item;
    return { ...raw, content: cleaned } as unknown as RealtimeItem;
  });
}

interface DisplayMessage {
  id: string;
  role: string;
  text: string;
}

export default function AiChat(props: AiChatProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [input, setInput] = createSignal('');
  const [isConnecting, setIsConnecting] = createSignal(false);
  const [isConnected, setIsConnected] = createSignal(false);
  const [isListening, setIsListening] = createSignal(false);
  const [isUserSpeaking, setIsUserSpeaking] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal('');
  let messagesEnd!: HTMLDivElement;
  let inputRef!: HTMLInputElement;
  let session: RealtimeSession | null = null;

  const recipe = createMemo(() => recipes.find((r) => r.id === props.recipeId));
  const progress = createMemo(() => getProgress(props.recipeId));
  const messages = createMemo(() => progress()?.chatMessages ?? []);

  const displayMessages = createMemo(() => {
    const items = messages();
    const result: DisplayMessage[] = [];
    for (const item of items) {
      const text = getMessageText(item as unknown as Record<string, unknown>);
      if (!text) continue;
      result.push({
        id: (item as unknown as Record<string, unknown>).itemId as string,
        role: (item as unknown as Record<string, unknown>).role as string,
        text,
      });
    }
    return result;
  });

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
    console.log('[ai-chat] connecting...');

    try {
      const agent = createRecipeAgent(
        r,
        p,
        {
          setStep(stepId, checked) {
            const cp = getProgress(props.recipeId);
            if (!cp) return;
            const current = new Set(cp.checkedSteps);
            if (checked) current.add(stepId);
            else current.delete(stepId);
            updateProgress(props.recipeId, (pp) => { pp.checkedSteps = [...current]; });
          },
          goToSection(sectionIndex) {
            updateProgress(props.recipeId, (pp) => { pp.currentCookingSection = sectionIndex; });
          },
          getProgress() {
            const cp = getProgress(props.recipeId);
            return cp ?? {
              recipeId: props.recipeId,
              currentServings: 0,
              currentCookingSection: 0,
              checkedShoppingItems: [],
              checkedSteps: [],
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
            input: {
              turnDetection: {
                type: 'semantic_vad',
                eagerness: 'high',
              },
            },
            output: {
              speed: 1.5,
            },
          },
        },
// Don't store audio recordings locally
        historyStoreAudio: false,
      });

      session.on('history_updated', (history: RealtimeItem[]) => {
        updateProgress(props.recipeId, (pp) => {
          pp.chatMessages = history;
        });
        queueMicrotask(scrollToBottom);
      });

      session.on('error', (err: { type: string; error: unknown }) => {
        console.error("Error from RealtimeSession", err);
        const msg = err.error instanceof Error ? err.error.message : String(err.error);
        setErrorMsg(msg);
      });

      session.on('transport_event', (event: { type: string }) => {
        if (event.type === 'input_audio_buffer.speech_started') {
          console.log('[ai-chat] speech detected');
          setIsUserSpeaking(true);
        } else if (event.type === 'input_audio_buffer.speech_stopped') {
          console.log('[ai-chat] speech ended');
          setIsUserSpeaking(false);
        }
      });

      const token = await getEphemeralToken(s.apiKey);
      const savedMessages = p.chatMessages;
      await session.connect({ apiKey: token });

      setIsConnected(true);
      console.log('[ai-chat] connected');
      session.mute(!isListening());

      if (savedMessages.length > 0) {
        session.updateHistory(sanitizeItemsForRestore(savedMessages));
      }
    } catch (err: unknown) {
      console.log("Error connecting session", err);
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setErrorMsg(msg);
      session?.close();
      session = null;
    } finally {
      setIsConnecting(false);
    }
  }

  function disconnectSession() {
    console.log('[ai-chat] disconnected');
    if (session) {
      session.close();
      session = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }

  createEffect(() => {
    const open = isOpen();
    const listening = isListening();
    if ((open || listening) && !isConnected() && !isConnecting()) {
      void connectSession();
    }
  });

  createEffect(() => {
    const connected = isConnected();
    const muted = !isListening();
    if (session && connected) {
      session.mute(muted);
    }
  });

  function toggleVoice() {
    if (isConnecting()) return;
    const next = !isListening();
    setIsListening(next);
    console.log(`[ai-chat] listening ${next ? 'started' : 'stopped'}`);
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
            <For each={displayMessages()}>
              {(msg) => (
                <div
                  class={styles.bubble}
                  classList={{
                    [styles.user]: msg.role === 'user',
                    [styles.assistant]: msg.role === 'assistant',
                  }}
                >
                  {msg.text}
                </div>
              )}
            </For>
            <Show when={isUserSpeaking()}>
              <div class={styles.bubble} classList={{ [styles.user]: true }}>
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
          classList={{ [styles.active]: isOpen() }}
          onClick={toggle}
          aria-label="AI Chat"
        >
          <img src={upChevronSvg} width="35" height="35" alt="" />
        </button>
        <button
          class={styles.voiceBtn}
          classList={{ [styles.listening]: isListening(), [styles.speaking]: isUserSpeaking() }}
          onClick={toggleVoice}
          disabled={isConnecting()}
          aria-label={isListening() ? 'Stop listening' : 'Start voice input'}
        >
          <Show
            when={isUserSpeaking()}
            fallback={<span class={styles.voiceBtnMic} />}
          >
            <span class={styles.voiceBtnDots}>
              <span class={styles.voiceBtnDot} />
              <span class={styles.voiceBtnDot} />
              <span class={styles.voiceBtnDot} />
            </span>
          </Show>
        </button>
        {props.children}
      </div>
    </>
  );
}
