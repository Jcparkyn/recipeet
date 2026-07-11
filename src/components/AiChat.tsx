import { createSignal, createMemo, createEffect, Show, For, onCleanup, onMount, type JSX } from 'solid-js';
import { experimental_transcribe as transcribe } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
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
  const [voiceSupported, setVoiceSupported] = createSignal(false);
  const [isRecording, setIsRecording] = createSignal(false);
  const [voiceLoading, setVoiceLoading] = createSignal(false);
  let messagesEnd!: HTMLDivElement;
  let inputRef!: HTMLInputElement;
  let abortController: AbortController | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let audioContext: AudioContext | null = null;
  let silenceTimeout: ReturnType<typeof setTimeout> | null = null;
  let silenceRaf: number | null = null;
  let shouldSpeakResponse = false;

  const recipe = createMemo(() => recipes.find((r) => r.id === props.recipeId));
  const progress = createMemo(() => getProgress(props.recipeId));
  const messages = createMemo(() => progress()?.chatMessages ?? []);

  onMount(() => {
    setVoiceSupported(!!navigator.mediaDevices?.getUserMedia);
  });

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

  function doSend(text: string, voiceInput = false) {
    if (!text || loading()) return;

    speechSynthesis.cancel();
    shouldSpeakResponse = voiceInput;

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
          if (shouldSpeakResponse) {
            const utterance = new SpeechSynthesisUtterance(fullText);
            utterance.lang = navigator.language || 'en-US';
            speechSynthesis.speak(utterance);
            shouldSpeakResponse = false;
          }
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

  function send(e: Event) {
    e.preventDefault();
    doSend(input().trim());
  }

  async function toggleRecording() {
    if (!voiceSupported() || voiceLoading() || loading()) return;

    if (isRecording()) {
      stopRecording();
    } else {
      await startRecording();
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        setIsRecording(false);
        cleanupAudio();
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
        audioChunks = [];

        if (audioBlob.size === 0) return;

        setVoiceLoading(true);

        void (async () => {
          try {
            const s = settings();
            if (!s.apiKey) {
              setErrorMsg('Please configure your API key in Settings first.');
              return;
            }

            const provider = createOpenAI({ apiKey: s.apiKey, baseURL: s.baseUrl });
            const buffer = await audioBlob.arrayBuffer();
            const transcript = await transcribe({
              model: provider.transcription('gpt-4o-mini-transcribe'),
              audio: new Uint8Array(buffer),
            });

            if (transcript.text) {
              doSend(transcript.text.trim(), true);
            }
          } catch (err) {
            setErrorMsg(`Transcription error: ${err instanceof Error ? err.message : 'Unknown error'}`);
          } finally {
            setVoiceLoading(false);
          }
        })();
      };

      startSilenceDetection(stream);
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setErrorMsg(`Microphone error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function startSilenceDetection(stream: MediaStream) {
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const SILENCE_THRESHOLD = 15;
    const SILENCE_MS = 2000;
    let hasSpoken = false;

    function check() {
      if (!mediaRecorder || mediaRecorder.state !== 'recording') {
        cleanupAudio();
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

      if (avg > SILENCE_THRESHOLD) {
        hasSpoken = true;
        if (silenceTimeout) {
          clearTimeout(silenceTimeout);
          silenceTimeout = null;
        }
      } else if (hasSpoken && !silenceTimeout) {
        silenceTimeout = setTimeout(() => {
          stopRecording();
        }, SILENCE_MS);
      }

      silenceRaf = requestAnimationFrame(check);
    }

    check();
  }

  function cleanupAudio() {
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
      silenceTimeout = null;
    }
    if (silenceRaf != null) {
      cancelAnimationFrame(silenceRaf);
      silenceRaf = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
      audioContext = null;
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
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
    stopRecording();
    cleanupAudio();
    speechSynthesis.cancel();
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
            <Show when={voiceSupported()}>
              <button
                type="button"
                class={styles.micBtn}
                classList={{ [styles.listening]: isRecording() }}
                onClick={toggleRecording}
                disabled={loading() || voiceLoading()}
                aria-label={isRecording() ? 'Stop recording' : 'Start voice input'}
                title={isRecording() ? 'Stop recording' : 'Start voice input'}
              >
                🎤
              </button>
            </Show>
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
          <img src="/chef-hat.svg" width="24" height="24" alt="" />
        </button>
        {props.children}
      </div>
    </>
  );
}
