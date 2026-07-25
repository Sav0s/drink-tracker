import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiFetchError, API_ACTION } from './apiFetch';

afterEach(() => vi.restoreAllMocks());

describe('ApiFetchError', () => {
  it('sets action=login for status 401', () => {
    const e = new ApiFetchError('msg', 401);
    expect(e.action).toBe(API_ACTION.LOGIN);
    expect(e.status).toBe(401);
  });

  it('sets action=retry for non-401 statuses', () => {
    expect(new ApiFetchError('msg', 500).action).toBe(API_ACTION.RETRY);
    expect(new ApiFetchError('msg', 403).action).toBe(API_ACTION.RETRY);
  });

  it('sets action=retry when no status given (network error)', () => {
    const e = new ApiFetchError('msg');
    expect(e.action).toBe(API_ACTION.RETRY);
    expect(e.status).toBeUndefined();
  });
});

describe('apiFetch', () => {
  it('returns parsed JSON on a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ hello: 'world' }),
    }));
    const result = await apiFetch('/test');
    expect(result).toEqual({ hello: 'world' });
  });

  it('throws ApiFetchError with action=login and German message on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(apiFetch('/test')).rejects.toMatchObject({
      name: 'ApiFetchError',
      status: 401,
      action: API_ACTION.LOGIN,
      message: 'Sitzung abgelaufen. Bitte neu einloggen.',
    });
  });

  it('throws ApiFetchError with action=retry on 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(apiFetch('/test')).rejects.toMatchObject({
      name: 'ApiFetchError',
      status: 500,
      action: API_ACTION.RETRY,
    });
  });

  it('throws ApiFetchError with no status and action=retry on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(apiFetch('/test')).rejects.toMatchObject({
      name: 'ApiFetchError',
      status: undefined,
      action: API_ACTION.RETRY,
      message: 'Keine Verbindung. Bitte Internetverbindung prüfen.',
    });
  });

  it('passes init options through to fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);
    await apiFetch('/test', { method: 'POST', body: '{}' });
    expect(mockFetch).toHaveBeenCalledWith('/test', { method: 'POST', body: '{}' });
  });
});
