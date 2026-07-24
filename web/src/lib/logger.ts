type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const IS_PROD = process.env.NODE_ENV === 'production';

// Allow ops to override verbosity via LOG_LEVEL env var.
// Defaults: debug in dev, info in prod.
const configuredLevel = (process.env.LOG_LEVEL ?? (IS_PROD ? 'info' : 'debug')) as Level;

function shouldEmit(level: Level): boolean {
  return LEVELS[level] >= (LEVELS[configuredLevel] ?? LEVELS.info);
}

function emit(level: Level, module: string, msg: string, ctx?: Record<string, unknown>): void {
  if (!shouldEmit(level)) return;

  const out = level === 'error' || level === 'warn' ? console.error : console.log;

  if (IS_PROD) {
    // Structured JSON — easy to ingest with Loki / Datadog / any log aggregator.
    out(JSON.stringify({ ts: new Date().toISOString(), level, module, msg, ...ctx }));
  } else {
    const time = new Date().toISOString().split('T')[1]?.slice(0, 8) ?? '';
    const ctxStr = ctx && Object.keys(ctx).length ? ' ' + JSON.stringify(ctx) : '';
    out(`[${time}] ${level.toUpperCase().padEnd(5)} [${module}] ${msg}${ctxStr}`);
  }
}

export function createLogger(module: string) {
  return {
    debug: (msg: string, ctx?: Record<string, unknown>) => emit('debug', module, msg, ctx),
    info: (msg: string, ctx?: Record<string, unknown>) => emit('info', module, msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => emit('warn', module, msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => emit('error', module, msg, ctx),
  };
}

export type Logger = ReturnType<typeof createLogger>;
