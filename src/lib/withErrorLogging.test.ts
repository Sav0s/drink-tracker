import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/logger');

const { withErrorLogging } = await import('./withErrorLogging');
const { logger } = await import('./logger');

describe('withErrorLogging', () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockReset();
  });

  it('passes the handler response through unchanged on success and never logs', async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }, { status: 200 }));
    const wrapped = withErrorLogging('GET /api/example', handler);

    const res = await wrapped();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('catches a thrown exception, logs server_error with the route and message, and returns a 500', async () => {
    const handler = vi.fn(async () => {
      throw new Error('boom');
    });
    const wrapped = withErrorLogging('POST /api/example', handler);

    const res = await wrapped();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error' });
    expect(logger.error).toHaveBeenCalledWith('server_error', {
      meta: { route: 'POST /api/example', message: 'boom' },
    });
  });

  it('stringifies a non-Error throw', async () => {
    const handler = vi.fn(async () => {
      throw 'raw string failure';
    });
    const wrapped = withErrorLogging('POST /api/example', handler);

    await wrapped();

    expect(logger.error).toHaveBeenCalledWith('server_error', {
      meta: { route: 'POST /api/example', message: 'raw string failure' },
    });
  });

  it('forwards arguments to the wrapped handler (dynamic-route signature)', async () => {
    const handler = vi.fn(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
      const { id } = await ctx.params;
      return NextResponse.json({ id });
    });
    const wrapped = withErrorLogging('PATCH /api/example/[id]', handler);

    const res = await wrapped(new Request('http://localhost'), { params: Promise.resolve({ id: 'abc' }) });

    expect(await res.json()).toEqual({ id: 'abc' });
  });
});
