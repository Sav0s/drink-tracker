export const API_ACTION = {
  RETRY: 'retry',
  LOGIN: 'login',
} as const;

export type ApiAction = typeof API_ACTION[keyof typeof API_ACTION];

export class ApiFetchError extends Error {
  readonly status?: number;
  readonly action: ApiAction;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiFetchError';
    this.status = status;
    this.action = status === 401 ? API_ACTION.LOGIN : API_ACTION.RETRY;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiFetchError('Keine Verbindung. Bitte Internetverbindung prüfen.');
  }
  if (!response.ok) {
    if (response.status === 401) {
      throw new ApiFetchError('Sitzung abgelaufen. Bitte neu einloggen.', 401);
    }
    throw new ApiFetchError(
      `Serverfehler (${response.status}). Bitte versuche es später erneut.`,
      response.status,
    );
  }
  return response.json() as Promise<T>;
}
