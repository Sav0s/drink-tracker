export type LogFields = { userId?: string; meta?: Record<string, unknown> };

type LogEntry =
  | { event: string; userId: string; meta: Record<string, unknown>; timestamp: string }
  | { event: string; meta: Record<string, unknown>; timestamp: string };

function buildEntry(event: string, fields?: LogFields): LogEntry {
  const timestamp = new Date().toISOString();
  const meta = fields?.meta ?? {};
  if (fields?.userId !== undefined) {
    return { event, userId: fields.userId, meta, timestamp };
  }
  return { event, meta, timestamp };
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
