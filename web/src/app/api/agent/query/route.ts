import { type NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { buildRAGGraph } from '@/lib/agent/graph';
import { checkRateLimit } from '@/lib/agent/rate-limit';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { Citation } from '@/lib/agent/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('agent');

// Build the graph once at module init (not per-request)
const graph = buildRAGGraph();

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
}

export async function POST(req: NextRequest) {
  // Rate limit check
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip);

  if (!rate.allowed) {
    const limit = parseInt(process.env.AGENT_RATE_LIMIT ?? '20', 10);
    const retryAfterSec = Math.ceil((rate.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: `Rate limit exceeded. You can ask ${limit} questions per day.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  // Parse + validate body
  let query: string;
  try {
    const body = await req.json();
    query = String(body.query ?? '')
      .trim()
      .slice(0, 500);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!query) {
    return NextResponse.json({ error: 'query field is required' }, { status: 400 });
  }

  const startMs = Date.now();
  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream({
    cancel() {
      abortController.abort();
    },
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // client already disconnected
        }
      };

      let modelUsed = '';
      let docCount = 0;
      let wasBlocked = false;
      let blockedMessage = '';
      let citations: Citation[] = [];

      try {
        const eventStream = graph.streamEvents(
          { query },
          { version: 'v2', signal: abortController.signal },
        );

        for await (const { event, name, data } of eventStream) {
          // Stream tokens from the LLM as they arrive
          if (event === 'on_chat_model_stream') {
            const chunk = data?.chunk;
            const content = chunk?.content;
            if (typeof content === 'string' && content) {
              send({ type: 'token', content });
            } else if (Array.isArray(content)) {
              // Multi-part content (e.g. Anthropic-style)
              for (const part of content as Array<{ text?: string }>) {
                if (part.text) send({ type: 'token', content: part.text });
              }
            }
          }

          // Capture final state when the top-level graph finishes
          if (event === 'on_chain_end' && name === 'LangGraph') {
            const output = data?.output as
              | {
                  modelUsed?: string;
                  docs?: unknown[];
                  blocked?: boolean;
                  answer?: string;
                  citations?: Citation[];
                }
              | undefined;

            modelUsed = output?.modelUsed ?? '';
            docCount = output?.docs?.length ?? 0;
            wasBlocked = output?.blocked ?? false;
            citations = output?.citations ?? [];

            // Blocked queries: answer is set directly (no LLM tokens emitted),
            // so we must send it explicitly as a 'blocked' event.
            if (wasBlocked && output?.answer) {
              blockedMessage = output.answer;
            }
          }
        }

        // Send blocked message before done (no LLM tokens were streamed for blocked queries)
        if (wasBlocked && blockedMessage) {
          send({ type: 'blocked', message: blockedMessage });
        }

        // Send citations after streaming completes
        if (citations.length > 0) {
          send({ type: 'citations', docs: citations });
        }

        send({ type: 'done', model: modelUsed, remaining: rate.remaining });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Generation failed';
        logger.error('RAG generation failed', { error: message });
        send({ type: 'error', message });
      } finally {
        controller.close();

        // Log query asynchronously — no PII, hash only
        const durationMs = Date.now() - startMs;
        db.execute(
          sql`
          INSERT INTO query_logs
            (query_hash, ip_hash, doc_count, model_used, duration_ms, blocked)
          VALUES
            (${createHash('sha256').update(query).digest('hex')},
             ${createHash('sha256').update(ip).digest('hex')},
             ${docCount},
             ${modelUsed || null},
             ${durationMs},
             ${wasBlocked})
        `,
        ).catch(() => {});
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx/NPM buffering
    },
  });
}
