import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
const getUser = vi.fn();
// Stable across renders — this page's data-fetch effect depends on [router].
const router = { push };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser, signOut: vi.fn() },
  }),
}));

const { default: BookingsPage } = await import('./page');

const periods = [
  {
    id: 'active1',
    range: '01.07. – heute',
    status: 'active',
    count: 2,
    total_cents: 300,
    rows: [{ date: '02.07.', drink: 'Bier', price_cents: 150 }],
  },
  {
    id: 'pending1',
    range: '01.06. – 01.07.2026',
    status: 'pending',
    count: 1,
    total_cents: 200,
    rows: [{ date: '15.06.', drink: 'Energy', price_cents: 200 }],
  },
  {
    id: 'paid1',
    range: '01.05. – 01.06.2026',
    status: 'paid',
    count: 1,
    total_cents: 100,
    rows: [{ date: '10.05.', drink: 'Anti alkoholisch', price_cents: 100 }],
  },
];

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/me') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'Fabi', isAdmin: false }) });
      }
      if (url === '/api/bookings') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ periods }) });
      }
      if (url === '/api/payments' && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    })
  );
}

describe('BookingsPage', () => {
  beforeEach(() => {
    push.mockReset();
    getUser.mockResolvedValue({ data: { user: { email: 'fabi@example.com' } } });
    mockFetch();
  });

  it('shows a loading state before the initial fetch resolves', () => {
    const { container } = render(<BookingsPage />);
    expect(container.querySelector('.chakra-spinner')).toBeInTheDocument();
  });

  it('renders the total balance and all periods once loaded', async () => {
    render(<BookingsPage />);

    // active (3,00€) + pending (2,00€) = 5,00€; the still-paid period isn't owed.
    expect(await screen.findByText('5,00 €')).toBeInTheDocument();
    expect(screen.getByText('01.07. – heute')).toBeInTheDocument();
    expect(screen.getByText('01.06. – 01.07.2026')).toBeInTheDocument();
    expect(screen.getByText('01.05. – 01.06.2026')).toBeInTheDocument();
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
    expect(screen.getByText('Ausstehend')).toBeInTheDocument();
    expect(screen.getByText('Bezahlt')).toBeInTheDocument();
  });

  it('expands a period to show its bookings', async () => {
    const user = userEvent.setup();
    render(<BookingsPage />);
    await screen.findByText('01.06. – 01.07.2026');

    await user.click(screen.getByText('01.06. – 01.07.2026'));

    expect(screen.getByText('Energy')).toBeInTheDocument();
  });

  it('marks a pending period as paid', async () => {
    const user = userEvent.setup();
    render(<BookingsPage />);
    await screen.findByText('01.06. – 01.07.2026');

    await user.click(screen.getByText('01.06. – 01.07.2026'));
    await user.click(screen.getByText('Ich hab bezahlt'));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/payments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ periodId: 'pending1', paid: true }),
        })
      )
    );
  });

  it('resets a paid period back to open', async () => {
    const user = userEvent.setup();
    render(<BookingsPage />);
    await screen.findByText('01.05. – 01.06.2026');

    await user.click(screen.getByText('01.05. – 01.06.2026'));
    await user.click(screen.getByText('Zurücksetzen'));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/payments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ periodId: 'paid1', paid: false }),
        })
      )
    );
  });

  it('shows an error banner with Neu-laden action when /api/bookings fails with a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/me') return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'Fabi' }) });
        if (url === '/api/bookings') return Promise.reject(new Error('network error'));
        return Promise.reject(new Error(`Unhandled: ${url}`));
      })
    );

    render(<BookingsPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Keine Verbindung/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeInTheDocument();
  });

  it('shows an error banner with Einloggen action when /api/bookings returns 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/me') return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'Fabi' }) });
        if (url === '/api/bookings') return Promise.resolve({ ok: false, status: 401 });
        return Promise.reject(new Error(`Unhandled: ${url}`));
      })
    );

    render(<BookingsPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Sitzung abgelaufen/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Einloggen' })).toBeInTheDocument();
  });
});
