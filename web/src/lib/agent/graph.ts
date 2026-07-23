/**
 * LangGraph RAG pipeline for Climate Awareness GB.
 *
 * Graph flow:
 *   START → guardrails → [blocked? → END] or [retrieve → generate → END]
 *
 * Nodes:
 *   guardrails — fast keyword check; no LLM cost
 *   retrieve   — hybrid pgvector + full-text search with RRF fusion
 *   generate   — LLM answer grounded in retrieved context, with citations
 */
import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createChatModel } from './llm';
import { embedQuery } from './embed';
import { searchSimilar } from './vectorstore';
import { checkGuardrails } from './guardrails';
import type { RetrievedDoc, Citation } from './types';

function buildSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0];
  return `You are a factual research assistant for the Climate Awareness GB platform, \
which tracks verified GLOF (glacial lake outburst flood) events, flash floods, landslides, and \
extreme weather incidents in Gilgit-Baltistan (GB), Pakistan.

Today's date: ${today}. Use this when interpreting relative time references such as \
"last year", "recent", "this season", or "currently".

Your role:
- Answer questions using ONLY the verified event data provided below.
- Be specific: cite event IDs ([Event #N]), dates, districts, and affected counts when available.
- When comparing events, rank by severity or affected count and name the top results explicitly.
- If the data doesn't answer the question, say so plainly — do not invent or extrapolate facts.
- Refuse questions unrelated to GB climate/disasters with a brief, polite explanation.
- Keep responses concise (2-4 paragraphs), factual, and suitable for journalists and researchers.
- Format numbers with commas. Use "N/A" when a data field is missing.`;
}

// ─── Graph state ──────────────────────────────────────────────────────────────

const AgentState = Annotation.Root({
  query: Annotation<string>,
  blocked: Annotation<boolean>({
    default: () => false,
    reducer: (_: boolean, b: boolean) => b,
  }),
  blockReason: Annotation<string>({
    default: () => '',
    reducer: (_: string, r: string) => r,
  }),
  docs: Annotation<RetrievedDoc[]>({
    default: () => [],
    reducer: (_: RetrievedDoc[], d: RetrievedDoc[]) => d,
  }),
  answer: Annotation<string>({
    default: () => '',
    reducer: (_: string, a: string) => a,
  }),
  citations: Annotation<Citation[]>({
    default: () => [],
    reducer: (_: Citation[], c: Citation[]) => c,
  }),
  modelUsed: Annotation<string>({
    default: () => '',
    reducer: (_: string, m: string) => m,
  }),
});

// ─── Nodes ────────────────────────────────────────────────────────────────────

async function guardrailsNode(state: typeof AgentState.State) {
  const result = checkGuardrails(state.query);
  return { blocked: result.blocked, blockReason: result.reason ?? '' };
}

async function retrieveNode(state: typeof AgentState.State) {
  const embedding = await embedQuery(state.query);
  const docs = await searchSimilar(embedding, state.query, 6);
  return { docs };
}

async function generateNode(state: typeof AgentState.State) {
  const model = createChatModel(true); // streaming enabled

  const contextBlock =
    state.docs.length > 0
      ? state.docs
          .map((d: RetrievedDoc) => {
            const meta = [
              `Type: ${d.eventType}`,
              `Severity: ${d.severity}`,
              `District: ${d.district ?? 'Unknown'}`,
              `Date: ${d.reportedAt}`,
              d.affectedCount != null
                ? `Affected: ${d.affectedCount.toLocaleString()} people`
                : null,
            ]
              .filter(Boolean)
              .join(' | ');

            return `[Event #${d.id}] ${d.title}\n${meta}\nDetails: ${d.content}`;
          })
          .join('\n\n---\n\n')
      : 'No relevant verified events found in the database for this query. ' +
        'Do not speculate or invent events — tell the user the database has no matching data.';

  const response = await model.invoke([
    new SystemMessage(buildSystemPrompt()),
    new HumanMessage(
      `Verified GB Climate Event Data:\n\n${contextBlock}\n\nQuestion: ${state.query}`,
    ),
  ]);

  const answer =
    typeof response.content === 'string'
      ? response.content
      : (response.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('');

  const citations: Citation[] = state.docs.map((d: RetrievedDoc) => ({
    id: d.id,
    title: d.title,
    district: d.district,
    eventType: d.eventType,
    reportedAt: d.reportedAt,
    sourceUrl: d.sourceUrl,
    similarity: d.similarity,
  }));

  const modelUsed =
    (response as { response_metadata?: { model_name?: string } }).response_metadata?.model_name ??
    '';

  return { answer, citations, modelUsed };
}

async function blockedNode(state: typeof AgentState.State) {
  return {
    answer:
      state.blockReason ||
      'I can only answer questions about climate events and disasters in Gilgit-Baltistan.',
    citations: [] as Citation[],
  };
}

// ─── Routing ──────────────────────────────────────────────────────────────────

function routeAfterGuardrails(state: typeof AgentState.State): 'retrieve' | 'blocked' {
  return state.blocked ? 'blocked' : 'retrieve';
}

// ─── Graph ────────────────────────────────────────────────────────────────────

export function buildRAGGraph() {
  return new StateGraph(AgentState)
    .addNode('guardrails', guardrailsNode)
    .addNode('retrieve', retrieveNode)
    .addNode('generate', generateNode)
    .addNode('blocked', blockedNode)
    .addEdge(START, 'guardrails')
    .addConditionalEdges('guardrails', routeAfterGuardrails)
    .addEdge('retrieve', 'generate')
    .addEdge('generate', END)
    .addEdge('blocked', END)
    .compile();
}

export type RAGGraph = ReturnType<typeof buildRAGGraph>;
