'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { Playfair_Display } from 'next/font/google';
import type { Citation, SSEEvent } from '@/lib/agent/types';

const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', weight: ['700'] });

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  model?: string;
  error?: boolean;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  glof: 'GLOF',
  flood: 'Flood',
  landslide: 'Landslide',
  infrastructure_damage: 'Infrastructure',
  casualty: 'Casualty',
  displacement: 'Displacement',
  other: 'Event',
};

const EXAMPLE_QUESTIONS = [
  'Which districts had the most GLOF events in the last year?',
  'How many people were affected by floods in Hunza?',
  'What are the most severe events recorded in Diamer?',
  'Are there any active GLOF warnings in Gilgit-Baltistan?',
];

async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6)) as SSEEvent;
        } catch {
          // malformed chunk — skip
        }
      }
    }
  }
}

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const msgIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(e: FormEvent | null, overrideQuery?: string) {
    e?.preventDefault();
    const query = (overrideQuery ?? input).trim();
    if (!query || loading) return;

    setInput('');
    setLoading(true);

    const userMsg: Message = { id: ++msgIdRef.current, role: 'user', content: query };
    const assistantMsgId = ++msgIdRef.current;
    const assistantMsg: Message = { id: assistantMsgId, role: 'assistant', content: '' };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const res = await fetch('/api/agent/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: err.error ?? 'Something went wrong.', error: true }
              : m,
          ),
        );
        return;
      }

      const reader = res.body!.getReader();

      for await (const event of parseSSEStream(reader)) {
        if (event.type === 'token' && event.content) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: m.content + event.content } : m,
            ),
          );
        } else if (event.type === 'citations' && event.docs) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, citations: event.docs } : m)),
          );
        } else if (event.type === 'done') {
          if (event.remaining !== undefined) setRemaining(event.remaining);
          if (event.model) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, model: event.model } : m)),
            );
          }
        } else if (event.type === 'error' && event.message) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: event.message ?? 'Generation failed.', error: true }
                : m,
            ),
          );
        } else if (event.type === 'blocked' && event.message) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: event.message ?? '', error: false } : m,
            ),
          );
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: 'Network error. Please try again.', error: true }
            : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">
          Climate Awareness GB · AI Assistant
        </p>
        <h1 className={`${playfair.className} mt-2 text-3xl font-bold text-slate-900 sm:text-4xl`}>
          Ask about GB climate data
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Answers are grounded in verified flood and GLOF event records — no hallucination, no
          speculation. Each response cites the source events.{' '}
          <Link href="/map" className="text-teal-700 hover:underline">
            Explore the map →
          </Link>
        </p>
        {remaining !== null && (
          <p className="mt-2 text-xs text-slate-400">{remaining} questions remaining today</p>
        )}
      </div>

      {/* Example chips — show only when no conversation yet */}
      {messages.length === 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSubmit(null, q)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm transition hover:border-teal-300 hover:text-teal-700"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Message thread */}
      <div className="flex-1 space-y-6 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex'}>
            {msg.role === 'user' ? (
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-teal-700 px-4 py-3 text-sm text-white">
                {msg.content}
              </div>
            ) : (
              <div className="w-full">
                <div
                  className={`rounded-2xl rounded-tl-sm border px-5 py-4 text-sm leading-relaxed text-slate-700 ${
                    msg.error
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {msg.content || (
                    <span className="inline-flex items-center gap-1.5 text-slate-400">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                    </span>
                  )}
                </div>

                {/* Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      Source events
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {msg.citations.map((c) => (
                        <a
                          key={c.id}
                          href={`/events/${c.id}`}
                          className="group block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-teal-300 hover:bg-white"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium text-slate-700 group-hover:text-teal-700 line-clamp-2">
                              {c.title}
                            </p>
                            <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                              #{c.id}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700">
                              {EVENT_TYPE_LABELS[c.eventType] ?? c.eventType}
                            </span>
                            {c.district && (
                              <span className="text-[9px] text-slate-400">{c.district}</span>
                            )}
                            <span className="text-[9px] text-slate-400">{c.reportedAt}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Model attribution */}
                {msg.model && <p className="mt-2 text-[9px] text-slate-300">via {msg.model}</p>}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="mt-6 flex items-end gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(null);
            }
          }}
          placeholder="Ask about floods, GLOFs, affected districts…"
          rows={2}
          disabled={loading}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="shrink-0 rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:opacity-40"
        >
          {loading ? '…' : 'Ask'}
        </button>
      </form>

      <p className="mt-3 text-center text-[10px] text-slate-400">
        Answers grounded in verified events only · Max 20 questions/day per IP ·{' '}
        <Link href="/about" className="hover:text-slate-500">
          About the data
        </Link>
      </p>
    </div>
  );
}
