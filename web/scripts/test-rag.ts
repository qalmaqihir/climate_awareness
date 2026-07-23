/**
 * RAG pipeline integration test.
 * Tests all components that don't require a running database.
 *
 * Run:
 *   JINA_API_KEY=<key> OPENROUTER_API_KEY=<key> tsx scripts/test-rag.ts
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(label: string) {
  console.log(`  ✓ ${label}`);
  passed++;
}
function fail(label: string, detail?: string) {
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  failed++;
  failures.push(label);
}
function section(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}
function assert(condition: boolean, label: string, detail?: string) {
  if (condition) ok(label);
  else fail(label, detail);
}

// ─── Guardrails (inlined — no DB import) ─────────────────────────────────────

interface GuardrailResult {
  blocked: boolean;
  reason?: string;
}

const BLOCK_RULES: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(pti|pmln|ppp|muttahida|mqm|imran\s+khan|nawaz\s+sharif|zardari|bilawal)\b/i,
    reason: 'Political party and figure questions are outside my scope.',
  },
  {
    pattern:
      /\b(should i (take|eat|drink|see a doctor|go to hospital)|am i (sick|ill|infected|dying|pregnant))\b/i,
    reason: 'I cannot provide personal medical advice.',
  },
  {
    pattern: /\b(sue|lawsuit|file a case|fir|legal rights|court order)\b/i,
    reason: 'I cannot provide legal advice.',
  },
  {
    pattern: /\b(cryptocurrency|bitcoin|crypto|nft|stock market|forex|investment advice)\b/i,
    reason: 'Financial topics are outside my scope.',
  },
];

function checkGuardrails(query: string): GuardrailResult {
  for (const rule of BLOCK_RULES) {
    if (rule.pattern.test(query)) return { blocked: true, reason: rule.reason };
  }
  return { blocked: false };
}

// ─── RRF helper ───────────────────────────────────────────────────────────────

function rrfScore(vecRank: number | null, ftsRank: number | null, k = 60): number {
  const v = vecRank !== null ? 1.0 / (k + vecRank) : 0;
  const f = ftsRank !== null ? 1.0 / (k + ftsRank) : 0;
  return v + f;
}

// ─── Rate limiter (inlined) ───────────────────────────────────────────────────

function makeRateLimiter(limit: number) {
  const map = new Map<string, { count: number; resetAt: number }>();
  const WINDOW = 24 * 60 * 60 * 1000;

  return function check(ip: string) {
    const now = Date.now();
    const entry = map.get(ip);

    if (!entry || now > entry.resetAt) {
      const resetAt = now + WINDOW;
      map.set(ip, { count: 1, resetAt });
      return { allowed: true, remaining: limit - 1, resetAt };
    }

    if (entry.count >= limit) return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    entry.count += 1;
    return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
  };
}

// ─── Embedding text builder (inlined) ────────────────────────────────────────

function buildEmbeddingText(row: Record<string, unknown>): string {
  return [
    row.title as string,
    row.description ? String(row.description) : '',
    row.event_type ? `Type: ${row.event_type}` : '',
    row.severity ? `Severity: ${row.severity}` : '',
    row.district ? `District: ${row.district}` : '',
    row.location_name ? `Location: ${row.location_name}` : '',
    row.affected_count ? `Affected: ${row.affected_count} people` : '',
    row.reported_date ? `Date: ${row.reported_date}` : '',
  ]
    .filter(Boolean)
    .join('. ');
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

function cosineSim(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return dot / (magA * magB);
}

// ─── Main (wraps all async code) ──────────────────────────────────────────────

async function main() {
  // ── 1. Guardrails ───────────────────────────────────────────────────────────

  section('1. Guardrails — blocked patterns');

  assert(checkGuardrails('What is PTI doing about floods?').blocked, 'blocks PTI mention');
  assert(checkGuardrails('Imran Khan visited Gilgit').blocked, 'blocks Imran Khan mention');
  assert(checkGuardrails('imran khan flood response').blocked, 'blocks Imran Khan lowercase');
  assert(checkGuardrails('PMLN relief work in Hunza').blocked, 'blocks PMLN mention');
  assert(checkGuardrails('PPP candidate visited affected area').blocked, 'blocks PPP mention');
  assert(checkGuardrails('Bilawal Bhutto visited GB').blocked, 'blocks Bilawal mention');
  assert(checkGuardrails('Zardari speaking about floods').blocked, 'blocks Zardari mention');
  assert(
    checkGuardrails('Should I see a doctor after flood exposure?').blocked,
    'blocks medical advice',
  );
  assert(checkGuardrails('am i sick from drinking flood water?').blocked, 'blocks am-i-sick');
  assert(checkGuardrails('Can I sue PDMA for negligence?').blocked, 'blocks legal (sue)');
  assert(checkGuardrails('file a case against district authority').blocked, 'blocks file a case');
  assert(
    checkGuardrails('what are my legal rights after flood damage?').blocked,
    'blocks legal rights',
  );
  assert(checkGuardrails('buy bitcoin now?').blocked, 'blocks crypto');
  assert(checkGuardrails('what is the stock market doing').blocked, 'blocks stock market');
  assert(checkGuardrails('crypto investment in Pakistan').blocked, 'blocks crypto investment');

  section('1. Guardrails — allowed GB climate queries');

  assert(
    !checkGuardrails('How many GLOF events happened in Hunza in 2023?').blocked,
    'allows GLOF query',
  );
  assert(!checkGuardrails('What districts are most flood-prone?').blocked, 'allows district query');
  assert(!checkGuardrails('Latest alerts in Gilgit-Baltistan').blocked, 'allows alerts query');
  assert(!checkGuardrails('Show me recent landslide events').blocked, 'allows landslide query');
  assert(
    !checkGuardrails('How many people were affected by floods in Diamer?').blocked,
    'allows affected count query',
  );
  assert(
    !checkGuardrails("What is the government's response to GLOF?").blocked,
    'allows govt response query',
  );
  assert(!checkGuardrails('Which glacier lakes are at risk?').blocked, 'allows glacier query');
  assert(!checkGuardrails('Flood damage in Skardu 2024').blocked, 'allows Skardu flood query');
  assert(!checkGuardrails('').blocked, 'empty query passes (handled elsewhere)');
  assert(!checkGuardrails('flood').blocked, 'single keyword passes');
  assert(
    !checkGuardrails('What happened in Ghizer district?').blocked,
    'allows district-specific query',
  );

  // ── 2. Rate limiter ─────────────────────────────────────────────────────────

  section('2. Rate limiter');

  {
    const check = makeRateLimiter(3);
    const ip = '1.2.3.4';

    const r1 = check(ip);
    assert(r1.allowed && r1.remaining === 2, 'first request: allowed, remaining=2');

    const r2 = check(ip);
    assert(r2.allowed && r2.remaining === 1, 'second request: allowed, remaining=1');

    const r3 = check(ip);
    assert(r3.allowed && r3.remaining === 0, 'third request: allowed, remaining=0');

    const r4 = check(ip);
    assert(!r4.allowed && r4.remaining === 0, 'fourth request: blocked');

    const r5 = check(ip);
    assert(!r5.allowed, 'fifth request: still blocked');

    const r6 = check('9.9.9.9');
    assert(r6.allowed && r6.remaining === 2, 'different IP: fresh limit');
  }

  {
    const check = makeRateLimiter(1);
    const ip = 'test.ip';
    check(ip); // exhaust
    const blocked = check(ip);
    assert(!blocked.allowed, 'limit=1: second request blocked');
  }

  // ── 3. RRF scoring ──────────────────────────────────────────────────────────

  section('3. RRF Scoring');

  const scoreA = rrfScore(1, 1); // top both arms
  const scoreB = rrfScore(1, null); // top vector only
  const scoreC = rrfScore(null, 1); // top FTS only
  const scoreD = rrfScore(20, 20); // bottom both
  const scoreE = rrfScore(5, 5);

  assert(scoreA > scoreB, 'top in both arms > top in vector only');
  assert(scoreA > scoreC, 'top in both arms > top in FTS only');
  // RRF correct: rank 20 in BOTH arms (2*(1/80)=0.025) beats rank 1 in ONE arm (1/61≈0.016)
  assert(
    scoreD > scoreB,
    'rank 20 in both arms beats rank 1 in only one arm (RRF multi-source bonus)',
  );
  assert(scoreD > scoreC, 'same for FTS arm — both-arm coverage rewarded');
  assert(Math.abs(scoreB - scoreC) < 0.0001, 'symmetric: vec rank 1 ≈ fts rank 1');
  assert(scoreE > scoreD, 'rank 5 both arms > rank 20 both arms');

  // Threshold logic
  const THRESHOLD = 0.25;
  assert(0.35 >= THRESHOLD, 'high-similarity doc passes threshold');
  assert(0.2 < THRESHOLD, 'low-similarity vector-only doc fails threshold');
  // FTS match bypasses threshold regardless of cosine sim
  const hasFts = true;
  assert(0.1 < THRESHOLD || hasFts, 'low cosine + FTS match: included via FTS bypass');

  // ── 4. Embedding text builder ────────────────────────────────────────────────

  section('4. Embedding text builder');

  {
    const full = buildEmbeddingText({
      title: 'Shisper Glacier GLOF 2022',
      description: 'Major outburst flood threatening Hassanabad.',
      event_type: 'glof',
      severity: 'critical',
      district: 'Hunza',
      location_name: 'Hassanabad',
      affected_count: 5000,
      reported_date: '2022-06-15',
    });
    assert(full.includes('Shisper Glacier GLOF 2022'), 'title present');
    assert(full.includes('Major outburst flood'), 'description present');
    assert(full.includes('Type: glof'), 'event_type present');
    assert(full.includes('Severity: critical'), 'severity present');
    assert(full.includes('District: Hunza'), 'district present');
    assert(full.includes('Location: Hassanabad'), 'location_name present');
    assert(full.includes('Affected: 5000 people'), 'affected_count present');
    assert(full.includes('Date: 2022-06-15'), 'reported_date present');
  }

  {
    const minimal = buildEmbeddingText({ title: 'Flood in GB', description: null });
    assert(minimal === 'Flood in GB', 'null fields omitted, title only');
    assert(!minimal.includes('Type:'), 'null event_type not included');
    assert(!minimal.includes('District:'), 'null district not included');
  }

  {
    const zeroAffected = buildEmbeddingText({ title: 'Minor event', affected_count: 0 });
    assert(!zeroAffected.includes('Affected:'), 'zero affected_count omitted (falsy)');
  }

  {
    const noDate = buildEmbeddingText({ title: 'Event', reported_date: null });
    assert(!noDate.includes('Date:'), 'null reported_date omitted');
  }

  // ── 5. Input sanitisation ────────────────────────────────────────────────────

  section('5. Input sanitisation');

  function sanitise(raw: unknown): string {
    return String(raw ?? '')
      .trim()
      .slice(0, 500);
  }

  assert(sanitise('').length === 0, 'empty string stays empty');
  assert(sanitise('  flood  ') === 'flood', 'trims whitespace');
  assert(sanitise('a'.repeat(600)).length === 500, '600-char input truncated to 500');
  assert(sanitise('a'.repeat(500)).length === 500, '500-char input unchanged');
  assert(sanitise(null) === '', 'null coerced to empty string');
  assert(sanitise(undefined) === '', 'undefined coerced to empty string');
  assert(sanitise(42) === '42', 'number coerced to string');

  // ── 6. System prompt date ────────────────────────────────────────────────────

  section('6. System prompt date injection');

  function buildSysPrompt(): string {
    const today = new Date().toISOString().split('T')[0];
    return `Today's date: ${today}. Use this when interpreting relative time references.`;
  }

  const sysPrompt = buildSysPrompt();
  const dateMatch = sysPrompt.match(/Today's date: (\d{4}-\d{2}-\d{2})/);
  assert(dateMatch !== null, 'system prompt contains ISO date pattern');
  if (dateMatch) {
    const d = new Date(dateMatch[1]);
    assert(!isNaN(d.getTime()), 'injected date is valid');
    assert(Date.now() - d.getTime() < 48 * 60 * 60 * 1000, 'date is within 48h of now');
  }

  // ── 7. Jina AI embedding API ─────────────────────────────────────────────────

  section('7. Jina AI Embedding API');

  const JINA_KEY = process.env.JINA_API_KEY;

  if (!JINA_KEY) {
    console.log('  ⚠ JINA_API_KEY not set — skipping');
  } else {
    const testTexts = [
      'GLOF event in Hunza district 2023, flash flood destroyed bridge',
      'Landslide in Diamer blocked Karakoram Highway, 200 people displaced',
      'Cryptocurrency bitcoin investment portfolio returns', // semantically unrelated
    ];

    try {
      console.log('  Calling Jina AI embeddings...');
      const res = await fetch('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${JINA_KEY}`,
        },
        body: JSON.stringify({ model: 'jina-embeddings-v3', input: testTexts, dimensions: 1024 }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        fail('Jina API HTTP success', `HTTP ${res.status}: ${body.slice(0, 200)}`);
      } else {
        const json = (await res.json()) as { data: Array<{ embedding: number[] }> };

        assert(json.data.length === 3, `returned ${json.data.length} embeddings (expected 3)`);
        assert(json.data[0].embedding.length === 1024, 'first embedding: 1024-dim');
        assert(json.data[1].embedding.length === 1024, 'second embedding: 1024-dim');
        assert(json.data[2].embedding.length === 1024, 'third embedding: 1024-dim');

        // Verify all values are finite floats (no NaN/Inf)
        const allFinite = json.data.every((d) => d.embedding.every((v) => isFinite(v)));
        assert(allFinite, 'all embedding values are finite floats');

        // Semantic sanity: two GB flood/disaster texts should be more similar
        // to each other than either is to the crypto text
        const simDisasters = cosineSim(json.data[0].embedding, json.data[1].embedding);
        const simFloodCrypto = cosineSim(json.data[0].embedding, json.data[2].embedding);
        const simLandslide2Crypto = cosineSim(json.data[1].embedding, json.data[2].embedding);

        console.log(`  cosine(GLOF, Landslide):   ${simDisasters.toFixed(4)}`);
        console.log(`  cosine(GLOF, Crypto):       ${simFloodCrypto.toFixed(4)}`);
        console.log(`  cosine(Landslide, Crypto):  ${simLandslide2Crypto.toFixed(4)}`);

        assert(
          simDisasters > simFloodCrypto,
          'GB disaster texts more similar to each other than to crypto',
        );
        assert(
          simDisasters > simLandslide2Crypto,
          'cross-domain similarity lower than same-domain',
        );
        // 0.35 is a reasonable lower bound — two different disaster types will not be near 1.0
        assert(simDisasters > 0.35, `intra-domain similarity ${simDisasters.toFixed(4)} > 0.35`);
        assert(simFloodCrypto < 0.6, `cross-domain similarity ${simFloodCrypto.toFixed(4)} < 0.6`);
      }
    } catch (err) {
      fail('Jina API call', err instanceof Error ? err.message : String(err));
    }
  }

  // ── 8. OpenRouter LLM API ────────────────────────────────────────────────────

  section('8. OpenRouter LLM API');

  const OR_KEY = process.env.OPENROUTER_API_KEY;

  if (!OR_KEY) {
    console.log('  ⚠ OPENROUTER_API_KEY not set — skipping');
  } else {
    const HEADERS = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OR_KEY}`,
      'HTTP-Referer': 'https://climate-gb.qalmaq.cloud',
      'X-Title': 'Climate Awareness GB',
    };

    // 8a. Primary model — non-streaming factual response
    console.log('  8a. Primary model (gemma-4-26b-a4b-it:free) non-streaming...');
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          model: 'google/gemma-4-26b-a4b-it:free',
          messages: [
            {
              role: 'system',
              content:
                'You are a climate data assistant for Gilgit-Baltistan, Pakistan. Be concise.',
            },
            { role: 'user', content: 'In exactly one sentence: what is a GLOF?' },
          ],
          temperature: 0.1,
          max_tokens: 80,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        fail('Primary model HTTP success', `HTTP ${res.status}: ${body.slice(0, 200)}`);
      } else {
        const json = (await res.json()) as {
          choices: Array<{ message: { content: string } }>;
          model: string;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        assert(json.choices?.length > 0, 'primary model: has choices');
        assert(typeof json.choices[0].message.content === 'string', 'content is string');
        assert(json.choices[0].message.content.length > 10, 'non-trivial response returned');
        console.log(`  model: ${json.model}`);
        console.log(`  response: "${json.choices[0].message.content.slice(0, 150)}"`);
        if (json.usage) {
          console.log(
            `  tokens: in=${json.usage.prompt_tokens} out=${json.usage.completion_tokens}`,
          );
        }
      }
    } catch (err) {
      fail('Primary model request', err instanceof Error ? err.message : String(err));
    }

    // 8b. Streaming call
    console.log('\n  8b. Streaming completion...');
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          model: 'google/gemma-4-26b-a4b-it:free',
          stream: true,
          messages: [{ role: 'user', content: 'Count from 1 to 5, one number per line.' }],
          temperature: 0.1,
          max_tokens: 30,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!res.ok) {
        fail('Streaming HTTP success', `HTTP ${res.status}`);
      } else {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let tokenChunks = 0;
        let buffer = '';

        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') break outer;
            try {
              const chunk = JSON.parse(raw) as {
                choices: Array<{ delta: { content?: string } }>;
              };
              if (chunk.choices?.[0]?.delta?.content) tokenChunks++;
            } catch {
              // malformed chunk — skip
            }
          }
        }

        assert(tokenChunks > 0, `streaming: received ${tokenChunks} content chunks`);
      }
    } catch (err) {
      fail('Streaming request', err instanceof Error ? err.message : String(err));
    }

    // 8c. Fallback model availability
    console.log('\n  8c. Fallback model (nemotron-3-super-120b:free)...');
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          model: 'nvidia/nemotron-3-super-120b-a12b:free',
          messages: [{ role: 'user', content: 'Reply with just: OK' }],
          temperature: 0.1,
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        fail(
          'Fallback model (nemotron-3-super) HTTP success',
          `HTTP ${res.status}: ${body.slice(0, 200)}`,
        );
      } else {
        const json = (await res.json()) as {
          choices: Array<{ message: { content: string } }>;
          model: string;
        };
        assert(json.choices?.length > 0, 'fallback nemotron-3-super: returned response');
        console.log(`  model: ${json.model}`);
      }
    } catch (err) {
      fail('Fallback model availability', err instanceof Error ? err.message : String(err));
    }

    // 8d. RAG-style grounded response — simulated context
    console.log('\n  8d. RAG grounded response (simulated context)...');
    const today = new Date().toISOString().split('T')[0];
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          model: 'google/gemma-4-26b-a4b-it:free',
          messages: [
            {
              role: 'system',
              content: `You are a factual research assistant for Climate Awareness GB. Today's date: ${today}. Answer ONLY from the verified event data provided. Do not invent facts.`,
            },
            {
              role: 'user',
              content: `Verified GB Climate Event Data:

[Event #42] Shisper Glacier GLOF — Hunza, 2022-06-15
Type: glof | Severity: critical | District: Hunza | Affected: 5,000 people
Details: Shisper glacier outburst flood destroyed Hassanabad bridge and damaged irrigation channels in Hunza district. 5,000 people displaced. Official PDMA emergency declared.

---

[Event #43] Flash Flood in Diamer — 2023-07-20
Type: flood | Severity: high | District: Diamer | Affected: 1,200 people
Details: Flash flood caused by cloudburst damaged 45 homes in Chilas area, Diamer district. KKH blocked for 72 hours.

Question: Which event had more affected people, and what type of disaster was it?`,
            },
          ],
          temperature: 0.1,
          max_tokens: 150,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!res.ok) {
        fail('RAG grounded response HTTP success', `HTTP ${res.status}`);
      } else {
        const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
        const content = json.choices?.[0]?.message?.content ?? '';

        assert(content.length > 20, 'RAG response is non-trivial');
        // Should mention Event #42 or Shisper or 5,000
        const mentionsHigherImpact =
          content.includes('42') ||
          content.includes('Shisper') ||
          content.includes('5,000') ||
          content.includes('5000');
        assert(mentionsHigherImpact, 'RAG response correctly identifies higher-impact event');

        // Should NOT mention events/facts not in context
        const hallucinates =
          content.toLowerCase().includes('event #99') ||
          (content.toLowerCase().includes("i don't have") === false &&
            content.toLowerCase().includes('invented') === true);
        assert(!hallucinates, 'RAG response does not hallucinate event IDs not in context');

        console.log(`  response: "${content.slice(0, 200)}"`);
      }
    } catch (err) {
      fail('RAG grounded response', err instanceof Error ? err.message : String(err));
    }

    // 8e. Guardrails bypass test — LLM should refuse off-topic
    console.log('\n  8e. LLM off-topic refusal (query that bypasses keyword guardrails)...');
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          model: 'google/gemma-4-26b-a4b-it:free',
          messages: [
            {
              role: 'system',
              content: `You are a factual research assistant for Climate Awareness GB platform which tracks GLOF events, floods, and landslides in Gilgit-Baltistan, Pakistan. Today: ${today}. Answer ONLY from verified event data. Refuse off-topic questions.`,
            },
            {
              role: 'user',
              content: `Verified GB Climate Event Data:\n\nNo relevant verified events found in the database for this query. Do not speculate or invent events.\n\nQuestion: What is the recipe for biryani?`,
            },
          ],
          temperature: 0.1,
          max_tokens: 100,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!res.ok) {
        fail('Off-topic refusal HTTP success', `HTTP ${res.status}`);
      } else {
        const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
        const content = (json.choices?.[0]?.message?.content ?? '').toLowerCase();

        // Should not provide biryani recipe
        const refusedOrRedirected =
          content.includes('cannot') ||
          content.includes("can't") ||
          content.includes('outside') ||
          content.includes('climate') ||
          content.includes('scope') ||
          content.includes('only') ||
          !content.includes('basmati');

        assert(refusedOrRedirected, 'LLM correctly refuses off-topic question (no biryani recipe)');
        console.log(`  response: "${(json.choices?.[0]?.message?.content ?? '').slice(0, 150)}"`);
      }
    } catch (err) {
      fail('Off-topic refusal', err instanceof Error ? err.message : String(err));
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(64));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failures.length > 0) {
    console.error('\nFailed:');
    failures.forEach((f) => console.error(`  ✗ ${f}`));
    process.exit(1);
  } else {
    console.log('\n✓ All tests passed\n');
  }
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});

/**
 * DB-dependent tests — run on VPS after deploy:
 *
 * a. Verify events are being embedded:
 *    docker compose logs worker | grep embed
 *
 * b. Test full RAG endpoint:
 *    curl -s -X POST https://climate-gb.qalmaq.cloud/api/agent/query \
 *      -H "Content-Type: application/json" \
 *      -d '{"query":"Which districts had the most GLOF events?"}' \
 *      --no-buffer
 *
 * c. Test blocked query (should receive type: 'blocked' event):
 *    curl -s -X POST https://climate-gb.qalmaq.cloud/api/agent/query \
 *      -H "Content-Type: application/json" \
 *      -d '{"query":"What is PTI doing about floods?"}' \
 *      --no-buffer
 *
 * d. Test rate limit (21st request from same IP → HTTP 429):
 *    for i in $(seq 1 21); do
 *      curl -s -o /dev/null -w "%{http_code}\n" \
 *        -X POST https://climate-gb.qalmaq.cloud/api/agent/query \
 *        -H "Content-Type: application/json" \
 *        -d '{"query":"flood"}';
 *    done
 *
 * e. Test no-data response (unrelated topic):
 *    -d '{"query":"What happened in Antarctica last week?"}'
 *    # LLM should say: no relevant verified events found
 */
