import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('info() calls console.info with event/meta/timestamp and omits userId when not given', () => {
    logger.info('drink_created', { meta: { drinkId: 'd1' } });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(infoSpy.mock.calls[0][0] as string);

    expect(Object.keys(parsed).sort()).toEqual(['event', 'meta', 'timestamp']);
    expect(parsed.event).toBe('drink_created');
    expect(parsed.meta).toEqual({ drinkId: 'd1' });
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
  });

  it('warn() calls console.warn and includes userId when provided', () => {
    logger.warn('auth_failure', { userId: 'u1', meta: { reason: 'exchange_failed' } });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);

    expect(Object.keys(parsed).sort()).toEqual(['event', 'meta', 'timestamp', 'userId']);
    expect(parsed.userId).toBe('u1');
  });

  it('error() calls console.error and defaults meta to {} when omitted entirely', () => {
    logger.error('server_error');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);

    expect(parsed.event).toBe('server_error');
    expect(parsed.meta).toEqual({});
    expect(parsed.userId).toBeUndefined();
  });
});
