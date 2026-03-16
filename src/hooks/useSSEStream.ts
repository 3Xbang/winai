'use client';

import { useState, useCallback, useRef } from 'react';

export interface SSEStreamOptions {
  /** URL of the SSE endpoint */
  url: string;
  /** Request body to send */
  body?: Record<string, unknown>;
  /** Callback for each text chunk received */
  onChunk?: (chunk: string) => void;
  /** Callback when streaming completes */
  onComplete?: (fullText: string) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface SSEStreamState {
  isStreaming: boolean;
  text: string;
  error: Error | null;
}

/**
 * Hook for consuming Server-Sent Events (SSE) streams.
 * Supports character-by-character rendering via onChunk callback.
 * Falls back gracefully if the endpoint is unavailable.
 */
export function useSSEStream() {
  const [state, setState] = useState<SSEStreamState>({
    isStreaming: false,
    text: '',
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (options: SSEStreamOptions) => {
    // Abort any existing stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ isStreaming: true, text: '', error: null });

    try {
      const response = await fetch(options.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.content ?? parsed.text ?? data;
              accumulated += content;
              options.onChunk?.(content);
              setState((prev) => ({ ...prev, text: accumulated }));
            } catch {
              // Plain text SSE data
              accumulated += data;
              options.onChunk?.(data);
              setState((prev) => ({ ...prev, text: accumulated }));
            }
          }
        }
      }

      setState((prev) => ({ ...prev, isStreaming: false }));
      options.onComplete?.(accumulated);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const error = err instanceof Error ? err : new Error(String(err));
      setState((prev) => ({ ...prev, isStreaming: false, error }));
      options.onError?.(error);
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  return { ...state, start, stop };
}
