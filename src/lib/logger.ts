export type LogFields = { userId?: string; meta?: Record<string, unknown> };

// JSON.stringify drops object keys whose value is undefined, so this
// naturally omits userId from the emitted line when it wasn't provided.
function buildEntry(event: string, fields?: LogFields) {
  return {
    event,
    userId: fields?.userId,
    meta: fields?.meta ?? {},
    timestamp: new Date().toISOString(),
  };
}

/** Extracts a message from a caught value, whether or not it's an Error. */
export function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Structured JSON-line logger. Each call emits exactly one console line via
 * the console method matching its severity, so Vercel's log-severity filter
 * (and any future Sentry/Axiom ingestion) can distinguish them.
 */
export const logger = {
  info(event: string, fields?: LogFields) {
    console.info(JSON.stringify(buildEntry(event, fields)));
  },
  warn(event: string, fields?: LogFields) {
    console.warn(JSON.stringify(buildEntry(event, fields)));
  },
  error(event: string, fields?: LogFields) {
    console.error(JSON.stringify(buildEntry(event, fields)));
  },
};
