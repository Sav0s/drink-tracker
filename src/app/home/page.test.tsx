import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
const getUser = vi.fn();
// next/navigation's useRouter() returns a stable object across renders in the
// real app; a fresh object per call would make effects keyed on `[router]`
// (e.g. this page's data fetch) re-fire on every re-render.
const router = { push };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser, signOut: vi.fn() },
  }),
}));

const { default: HomePage } = await import('./page');

const homeResponse = {
  periodId: 'period-1',
  periodStart: '01.07.',
  playerName: 'Fabi',
  firstVisit: false,
  drinks: [
    { id: 'bier', name: 'Bier', price_cents: 150, count: 0 },
    { id: 'energy', name: 'Energy', price_cents: 200, count: 2 },
  ],
  closedPeriod: null,
};

const meResponse = { name: 'Fabi', isAdmin: false };

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/home') {
        return Promise.resolve({ json: () => Promise.resolve(homeResponse) });
      }
      if (url === '/api/me') {
        return Promise.resolve({ json: () => Promise.resolve(meResponse) });
      }
      if (url === '/api/bookings') {
        return Promise.resolve({ json: () => Promise.resolve({ id: 'booking-1' }) });
      }
      if (typeof url === 'string' && url.startsWith('/api/bookings/last')) {
        return Promise.resolve({ json: () => Promise.resolve({}) });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url} ${init?.method ?? 'GET'}`));
    })
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    push.mockReset();
    getUser.mockResolvedValue({ data: { user: { email: 'fabi@example.com' } } });
    mockFetch();
  });

  it('shows a loading state before the initial fetch resolves', () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector('.chakra-spinner')).toBeInTheDocument();
  });

  it('renders drinks and the current balance once loaded', async () => {
    render(<HomePage />);

    await waitFor(() => expect(screen.getByText('Bier')).toBeInTheDocument());
    expect(screen.getByText('Energy')).toBeInTheDocument();
    // 2x Energy (2,00€) already booked = 4,00 € open balance.
    expect(screen.getByText('4,00 €')).toBeInTheDocument();
  });

  it('books a drink optimistically and shows an undo toast', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await waitFor(() => expect(screen.getByText('Bier')).toBeInTheDocument());
    await user.click(screen.getByText('Bier'));

    expect(await screen.findByText(/Bier gebucht/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/bookings',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('undoes a booking and removes the toast', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await waitFor(() => expect(screen.getByText('Bier')).toBeInTheDocument());
    await user.click(screen.getByText('Bier'));
    await screen.findByText(/Bier gebucht/);

    await user.click(screen.getByText('Rückgängig'));

    await waitFor(() => expect(screen.queryByText(/Bier gebucht/)).not.toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bookings/last?drinkId=bier'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('shows the first-visit welcome modal when firstVisit is true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/home') {
          return Promise.resolve({
            json: () => Promise.resolve({ ...homeResponse, firstVisit: true, playerName: '' }),
          });
        }
        if (url === '/api/me') {
          return Promise.resolve({ json: () => Promise.resolve(meResponse) });
        }
        return Promise.resolve({ json: () => Promise.resolve({}) });
      })
    );

    render(<HomePage />);

    expect(await screen.findByText('Willkommen in der Kabinen-Bar')).toBeInTheDocument();
  });
});
