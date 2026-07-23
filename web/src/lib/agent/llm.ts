/**
 * LLM factory: ChatOpenAI configured for OpenRouter with a fallback chain.
 *
 * Swap models by editing OPENROUTER_MODELS — no other code needs to change.
 * Primary model is tried first; on any error (rate limit, no credits, timeout)
 * the next model in the list is used automatically.
 */
import { ChatOpenAI } from '@langchain/openai';

// Free models on OpenRouter ordered by preference.
// All support tool-calling and instruction-following at high quality.
const OPENROUTER_MODELS = [
  'google/gemini-2.0-flash-exp:free', // fast, capable, good instruction-following
  'meta-llama/llama-3.3-70b-instruct:free', // strong reasoning + tool calling
  'deepseek/deepseek-r1:free', // excellent reasoning, slower
] as const;

export function createChatModel(streaming = false): ChatOpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const siteUrl = process.env.NEXTAUTH_URL ?? 'https://climate-gb.naseyou.nl';

  const makeModel = (model: string) =>
    new ChatOpenAI({
      model,
      apiKey,
      streaming,
      temperature: 0.1,
      maxRetries: 2,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': siteUrl,
          'X-Title': 'Climate Awareness GB',
        },
      },
    });

  const [primary, ...rest] = OPENROUTER_MODELS.map(makeModel);
  // withFallbacks: tries each fallback on any invocation error
  return primary.withFallbacks(rest) as unknown as ChatOpenAI;
}
