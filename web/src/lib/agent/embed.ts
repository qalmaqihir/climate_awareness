/**
 * Embedding provider: Jina AI v3 (1024-dim, OpenAI-compatible endpoint).
 * Free tier: 1M tokens/day — sufficient for event indexing + query time.
 * Get a free key at https://jina.ai
 *
 * To swap provider: change BASE_URL + MODEL_NAME. Dimension must match
 * the vector(1024) column in schema.ts; if it changes, run a new migration.
 */
import { OpenAIEmbeddings } from '@langchain/openai';

const JINA_BASE_URL = 'https://api.jina.ai/v1';
const JINA_MODEL = 'jina-embeddings-v3';
const DIMENSIONS = 1024;

let _embedder: OpenAIEmbeddings | null = null;

function getEmbedder(): OpenAIEmbeddings {
  if (_embedder) return _embedder;

  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error('JINA_API_KEY is not set');

  _embedder = new OpenAIEmbeddings({
    model: JINA_MODEL,
    apiKey,
    dimensions: DIMENSIONS,
    configuration: { baseURL: JINA_BASE_URL },
  });

  return _embedder;
}

export async function embedQuery(text: string): Promise<number[]> {
  return getEmbedder().embedQuery(text);
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  return getEmbedder().embedDocuments(texts);
}

export { DIMENSIONS };
