/**
 * Telegram Bot webhook handler.
 *
 * Registration: run once after deploy —
 *   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *        -H "Content-Type: application/json" \
 *        -d '{"url":"https://<domain>/api/telegram/webhook","secret_token":"<TELEGRAM_SECRET_TOKEN>"}'
 *
 * Security: incoming requests must include the X-Telegram-Bot-Api-Secret-Token
 * header matching TELEGRAM_SECRET_TOKEN env var.
 *
 * Commands handled:
 *   /start | /help       — welcome + command list
 *   /latest              — last 5 verified events
 *   /alerts [district]   — active alerts
 *   /weather [valley]    — latest weather snapshot
 *   /ask <question>      — RAG query (proxied to /api/agent/query)
 *   /subscribe [d1 d2…]  — opt-in for push alerts
 *   /unsubscribe         — opt-out
 *   /travel              — road status for KKH / Babusar / Skardu / Chitral
 */
import { type NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { GB_DISTRICTS } from '@/lib/constants';

const TELEGRAM_API = 'https://api.telegram.org/bot';
const SITE_URL = process.env.NEXTAUTH_URL ?? 'https://climate-awareness-gbc.qalmaq.cloud';

// ─── Telegram types ───────────────────────────────────────────────────────────

interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// ─── Bot API helpers ──────────────────────────────────────────────────────────

async function sendMessage(
  chatId: number,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML',
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4096),
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch((err) =>
    console.error('[tg] sendMessage failed:', err instanceof Error ? err.message : err),
  );
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function handleStart(chatId: number): Promise<void> {
  const text =
    `<b>Northern Pakistan Climate Watch</b> 🌏\n\n` +
    `Real-time GLOF, flood and disaster alerts for Gilgit-Baltistan &amp; Chitral.\n\n` +
    `<b>Commands:</b>\n` +
    `/latest — Last 5 verified disaster events\n` +
    `/alerts [district] — Active alerts (optional district filter)\n` +
    `/weather [valley] — Current weather for GB valleys\n` +
    `/ask &lt;question&gt; — Ask AI about events (RAG)\n` +
    `/subscribe [district…] — Get push alerts for your region\n` +
    `/unsubscribe — Stop push alerts\n` +
    `/travel — Road status: KKH, Babusar, Skardu, Chitral\n\n` +
    `<a href="${SITE_URL}">Open website</a>`;

  await sendMessage(chatId, text);
}

async function handleLatest(chatId: number): Promise<void> {
  const result = await db
    .execute(
      sql`
    SELECT title, district, event_type, severity, reported_at, id
    FROM   events
    WHERE  status = 'verified'
    ORDER  BY reported_at DESC
    LIMIT  5
  `,
    )
    .catch(() => null);

  if (!result || result.rows.length === 0) {
    await sendMessage(chatId, 'No verified events found yet. Check back soon.');
    return;
  }

  const lines = result.rows.map((r, i) => {
    const date = new Date(r.reported_at as string).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const district = r.district ? `${r.district} · ` : '';
    return `${i + 1}. <a href="${SITE_URL}/events/${r.id}">${r.title as string}</a>\n   ${district}${r.event_type as string} · ${date}`;
  });

  await sendMessage(chatId, `<b>Latest verified events:</b>\n\n${lines.join('\n\n')}`);
}

async function handleAlerts(chatId: number, districtArg: string | null): Promise<void> {
  const districtClause = districtArg ? sql`AND district ILIKE ${'%' + districtArg + '%'}` : sql``;

  const result = await db
    .execute(
      sql`
    SELECT title, level, district, issued_at, source_url
    FROM   alerts
    WHERE  is_active = true
      AND  (expires_at IS NULL OR expires_at > now())
      ${districtClause}
    ORDER  BY issued_at DESC
    LIMIT  10
  `,
    )
    .catch(() => null);

  if (!result || result.rows.length === 0) {
    const scope = districtArg ? ` for ${districtArg}` : '';
    await sendMessage(chatId, `No active alerts${scope} right now.`);
    return;
  }

  const LEVEL_EMOJI: Record<string, string> = {
    emergency: '🚨',
    warning: '⚠️',
    watch: '👁️',
    advisory: 'ℹ️',
  };

  const lines = result.rows.map((r) => {
    const emoji = LEVEL_EMOJI[r.level as string] ?? '📢';
    const region = r.district ? ` (${r.district as string})` : '';
    const date = new Date(r.issued_at as string).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
    const src = r.source_url ? ` — <a href="${r.source_url as string}">source</a>` : '';
    return `${emoji} <b>${(r.level as string).toUpperCase()}${region}</b> · ${date}\n${r.title as string}${src}`;
  });

  const header = districtArg ? `Active alerts for <b>${districtArg}</b>:` : 'Active alerts:';
  await sendMessage(chatId, `${header}\n\n${lines.join('\n\n')}`);
}

async function handleWeather(chatId: number, valleyArg: string | null): Promise<void> {
  const districtClause = valleyArg
    ? sql`WHERE district ILIKE ${'%' + valleyArg + '%'}`
    : sql`WHERE true`;

  const result = await db
    .execute(
      sql`
    SELECT DISTINCT ON (district)
      district, temperature_celsius, precipitation_mm, windspeed_kmh, fetched_at
    FROM weather_snapshots
    ${districtClause}
    ORDER BY district, fetched_at DESC
    LIMIT 12
  `,
    )
    .catch(() => null);

  if (!result || result.rows.length === 0) {
    await sendMessage(
      chatId,
      'Weather data not available yet. The worker refreshes every 6 hours.',
    );
    return;
  }

  const lines = result.rows.map((r) => {
    const temp =
      r.temperature_celsius != null ? `${(r.temperature_celsius as number).toFixed(1)}°C` : 'N/A';
    const rain =
      r.precipitation_mm != null ? `${(r.precipitation_mm as number).toFixed(1)}mm rain` : '';
    const wind =
      r.windspeed_kmh != null ? `${(r.windspeed_kmh as number).toFixed(0)} km/h wind` : '';
    const parts = [temp, rain, wind].filter(Boolean).join(' · ');
    return `<b>${r.district as string}</b>: ${parts}`;
  });

  const age = result.rows[0]?.fetched_at
    ? new Date(result.rows[0].fetched_at as string).toLocaleString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
      })
    : '';

  await sendMessage(chatId, `<b>Current weather</b> (updated ${age}):\n\n${lines.join('\n')}`);
}

async function handleAsk(chatId: number, question: string): Promise<void> {
  if (!question.trim()) {
    await sendMessage(chatId, 'Usage: /ask What districts had the most GLOF events in 2023?');
    return;
  }

  await sendMessage(chatId, '⏳ Searching our event database for an answer…');

  try {
    const res = await fetch(`${SITE_URL}/api/agent/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question.slice(0, 500) }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok || !res.body) {
      await sendMessage(chatId, 'The AI agent returned an error. Try again in a moment.');
      return;
    }

    // Consume the SSE stream and collect tokens into a full answer
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let answer = '';
    let citations: Array<{ title: string; url?: string }> = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        const trimmed = line.replace(/^data: /, '').trim();
        if (!trimmed) continue;

        try {
          const event = JSON.parse(trimmed) as {
            type: string;
            content?: string;
            message?: string;
            docs?: Array<{ title: string; sourceUrl?: string }>;
          };

          if (event.type === 'token' && event.content) answer += event.content;
          if (event.type === 'blocked' && event.message) answer = event.message;
          if (event.type === 'citations' && event.docs) {
            citations = event.docs.map((d) => ({ title: d.title, url: d.sourceUrl }));
          }
        } catch {
          // Non-JSON line — skip
        }
      }
    }

    if (!answer) {
      await sendMessage(chatId, 'No answer generated. The question may be out of scope.');
      return;
    }

    let response = answer.slice(0, 3800);

    if (citations.length > 0) {
      const citationText = citations
        .slice(0, 5)
        .map((c, i) => `${i + 1}. ${c.url ? `<a href="${c.url}">${c.title}</a>` : c.title}`)
        .join('\n');
      response += `\n\n<b>Sources:</b>\n${citationText}`;
    }

    await sendMessage(chatId, response);
  } catch (err) {
    console.error('[tg] /ask error:', err instanceof Error ? err.message : err);
    await sendMessage(chatId, 'Request timed out. The AI agent may be busy — try again.');
  }
}

async function handleSubscribe(chatId: number, args: string[]): Promise<void> {
  // Validate district names from args
  const requestedDistricts = args
    .map((a) => GB_DISTRICTS.find((d) => d.toLowerCase() === a.toLowerCase()))
    .filter((d): d is (typeof GB_DISTRICTS)[number] => d !== undefined);

  const districts = requestedDistricts.length > 0 ? requestedDistricts : [];
  const districtList = districts.length > 0 ? districts.join(', ') : 'all regions';

  try {
    // Upsert: if chat_id already exists update districts; otherwise insert
    await db.execute(sql`
      INSERT INTO subscribers (telegram_chat_id, districts, language)
      VALUES (${chatId}, ${districts}, 'en')
      ON CONFLICT (telegram_chat_id)
      DO UPDATE SET
        districts  = ${districts},
        active     = true,
        opt_out_at = NULL
    `);

    const districtHelp =
      districts.length === 0
        ? '\n\nYou will receive alerts for all regions. To limit to specific districts, use:\n/subscribe Hunza Gilgit'
        : '';

    await sendMessage(
      chatId,
      `✅ Subscribed to push alerts for <b>${districtList}</b>.${districtHelp}\n\nUse /unsubscribe to stop.`,
    );
  } catch (err) {
    console.error('[tg] /subscribe error:', err instanceof Error ? err.message : err);
    await sendMessage(chatId, 'Could not save subscription. Please try again.');
  }
}

async function handleUnsubscribe(chatId: number): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE subscribers
      SET    active     = false,
             opt_out_at = now()
      WHERE  telegram_chat_id = ${chatId}
    `);
    await sendMessage(
      chatId,
      '👋 You have been unsubscribed from push alerts.\n\nUse /subscribe to re-enable.',
    );
  } catch (err) {
    console.error('[tg] /unsubscribe error:', err instanceof Error ? err.message : err);
    await sendMessage(chatId, 'Could not update subscription. Please try again.');
  }
}

async function handleTravel(chatId: number): Promise<void> {
  const text =
    `<b>Northern Pakistan Road Status</b> 🛣️\n\n` +
    `<i>This information is based on general seasonal patterns. ` +
    `Always verify with official sources before travel.</i>\n\n` +
    `<b>KKH (Karakoram Highway)</b>\n` +
    `ISB → Gilgit: Generally open year-round. Landslide-prone near Chilas (Diamer) during monsoon (Jul–Sep). ` +
    `Check NHSHA or local reports for real-time closures.\n\n` +
    `<b>Babusar Pass (N-35)</b>\n` +
    `Naran → Chilas: Open Jun–Oct only. Typically closes Oct–May due to snow. ` +
    `Elevation 4,173m — check PMD forecast before crossing.\n\n` +
    `<b>Skardu Road</b>\n` +
    `Gilgit → Skardu: Generally open. Prone to flooding and landslides at Indus River crossings during monsoon.\n\n` +
    `<b>Chitral (via Lowari Tunnel)</b>\n` +
    `ISB → Dir → Lowari Tunnel → Chitral: Lowari Tunnel is open year-round (8km, no snow). ` +
    `Road from Dir to Chitral may close in heavy snowfall.\n\n` +
    `<b>Official Sources:</b>\n` +
    `• <a href="https://nhsha.gov.pk">NHSHA Road Conditions</a>\n` +
    `• <a href="https://pmd.gov.pk">PMD Weather Forecast</a>\n` +
    `• <a href="https://pdma.gob.pk">PDMA GB Alerts</a>\n\n` +
    `For live event-based closures use /alerts.`;

  await sendMessage(chatId, text);
}

// ─── Update dispatcher ─────────────────────────────────────────────────────────

async function processUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.text || !message.chat) return;

  const chatId = message.chat.id;
  const text = message.text.trim();

  // Parse command and arguments — handle bot mention suffix (e.g. /start@MyBot)
  const [rawCmd, ...args] = text.split(/\s+/);
  const cmd = rawCmd.replace(/@\w+$/, '').toLowerCase();

  console.log(`[tg] chat=${chatId} cmd=${cmd} args=${args.join(',')}`);

  switch (cmd) {
    case '/start':
    case '/help':
      await handleStart(chatId);
      break;

    case '/latest':
      await handleLatest(chatId);
      break;

    case '/alerts':
      await handleAlerts(chatId, args[0] ?? null);
      break;

    case '/weather':
      await handleWeather(chatId, args[0] ?? null);
      break;

    case '/ask':
      await handleAsk(chatId, args.join(' '));
      break;

    case '/subscribe':
      await handleSubscribe(chatId, args);
      break;

    case '/unsubscribe':
      await handleUnsubscribe(chatId);
      break;

    case '/travel':
      await handleTravel(chatId);
      break;

    default:
      await sendMessage(chatId, 'Unknown command. Use /help to see available commands.');
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, service: 'telegram-webhook' });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify the secret token header Telegram sends on every webhook request
  const secretToken = process.env.TELEGRAM_SECRET_TOKEN;
  if (secretToken) {
    const provided = req.headers.get('x-telegram-bot-api-secret-token');
    if (provided !== secretToken) {
      console.warn('[tg] Webhook request rejected — invalid secret token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Respond immediately so Telegram does not retry.
  // Command processing happens in a fire-and-forget promise — safe because
  // we run on a persistent Node.js process (VPS), not a serverless function.
  processUpdate(update).catch((err) =>
    console.error('[tg] Unhandled error in processUpdate:', err),
  );

  return NextResponse.json({ ok: true });
}
