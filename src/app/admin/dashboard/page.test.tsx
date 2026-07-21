import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test-utils';
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

const { default: AdminDashboardPage } = await import('./page');

const drinks = [
  { id: 'd1', name: 'Bier', price_cents: 150, active: true },
  { id: 'd2', name: 'Radler', price_cents: 140, active: false },
];

const periods = [
  { id: 'p1', range: '01.07. – heute', status: 'active', paymentInstructions: null },
  { id: 'p2', range: '01.06. – 01.07.2026', status: 'closed', paymentInstructions: 'IBAN DE00' },
];

const membersByPeriod: Record<string, unknown[]> = {
  p1: [
    {
      id: 'm1',
      name: 'Fabi',
      count: 3,
      total_cents: 450,
      paid: false,
      items: [{ drink: 'Bier', count: 3, price_cents: 150 }],
    },
  ],
  p2: [
    {
      id: 'm1',
      name: 'Fabi',
      count: 2,
      total_cents: 300,
      paid: true,
      items: [{ drink: 'Bier', count: 2, price_cents: 150 }],
    },
  ],
};

function mockFetch({ isAdmin = true } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (url === '/api/me') {
        return Promise.resolve({ json: () => Promise.resolve({ name: 'Fabi', isAdmin }) });
      }
      if (url === '/api/admin/drinks' && method === 'GET') {
        return Promise.resolve({ json: () => Promise.resolve({ drinks }) });
      }
      if (url === '/api/admin/drinks' && method === 'POST') {
        return Promise.resolve({ json: () => Promise.resolve({}) });
      }
      if (url.startsWith('/api/admin/drinks/') && method === 'PATCH') {
        return Promise.resolve({ json: () => Promise.resolve({}) });
      }
      if (url === '/api/admin/billing-periods' && method === 'GET') {
        return Promise.resolve({ json: () => Promise.resolve({ periods }) });
      }
      if (url === '/api/admin/billing-periods' && method === 'POST') {
        return Promise.resolve({ json: () => Promise.resolve({}) });
      }
      if (url === '/api/admin/billing-periods/p1/members') {
        return Promise.resolve({ json: () => Promise.resolve({ members: membersByPeriod.p1 }) });
      }
      if (url === '/api/admin/billing-periods/p2/members') {
        return Promise.resolve({ json: () => Promise.resolve({ members: membersByPeriod.p2 }) });
      }
      if (url === '/api/admin/payments' && method === 'PATCH') {
        return Promise.resolve({ json: () => Promise.resolve({}) });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url} ${method}`));
    })
  );
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    push.mockReset();
    getUser.mockResolvedValue({ data: { user: { email: 'fabi@example.com' } } });
  });

  it('redirects non-admins to /home', async () => {
    mockFetch({ isAdmin: false });
    render(<AdminDashboardPage />);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/home'));
  });

  it('shows a loading state before the drinks list resolves', () => {
    mockFetch();
    const { container } = render(<AdminDashboardPage />);
    expect(container.querySelector('.chakra-spinner')).toBeInTheDocument();
  });

  it('renders the drink list with active/inactive status', async () => {
    mockFetch();
    render(<AdminDashboardPage />);

    await screen.findByText('Bier');
    expect(screen.getByText('Radler')).toBeInTheDocument();
    expect(screen.getByText('1,50 €')).toBeInTheDocument();
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
    expect(screen.getByText('Inaktiv')).toBeInTheDocument();
  });

  it('toggles a drink active state', async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<AdminDashboardPage />);
    await screen.findByText('Bier');

    const activeLabel = screen.getByText('Aktiv');
    const toggleButton = activeLabel.parentElement!.querySelector('button')!;
    await user.click(toggleButton);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/drinks/d1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ active: false }) })
      )
    );
  });

  it('adds a new drink', async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<AdminDashboardPage />);
    await screen.findByText('Bier');

    await user.type(screen.getByPlaceholderText('Name'), 'Radlermix');
    await user.type(screen.getByPlaceholderText('1,50'), '2,20');
    await user.click(screen.getByText('+'));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/drinks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Radlermix', price_cents: 220, active: true }),
        })
      )
    );
  });

  it('edits a drink through the edit modal', async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<AdminDashboardPage />);
    await screen.findByText('Bier');

    const priceCell = screen.getByText('1,50 €');
    const editButton = priceCell.parentElement!.querySelectorAll('button')[1];
    await user.click(editButton);

    expect(screen.getByText('Getränk bearbeiten')).toBeInTheDocument();
    const nameInput = screen.getByDisplayValue('Bier');
    await user.clear(nameInput);
    await user.type(nameInput, 'Bierchen');
    await user.click(screen.getByText('Speichern'));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/drinks/d1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Bierchen', price_cents: 150, active: true }),
        })
      )
    );
  });

  it('loads the billing tab with members and summary totals', async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<AdminDashboardPage />);
    await screen.findByText('Bier');

    await user.click(screen.getByRole('button', { name: 'Abrechnung' }));

    expect(await screen.findByText('Fabi')).toBeInTheDocument();
    // Summe offen, Gesamt, and the member row total all coincide (one unpaid member).
    expect(screen.getAllByText('4,50 €')).toHaveLength(3);
  });

  it('marks a member as paid', async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<AdminDashboardPage />);
    await screen.findByText('Bier');
    await user.click(screen.getByRole('button', { name: 'Abrechnung' }));
    await screen.findByText('Fabi');

    await user.click(screen.getByText('Als bezahlt'));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/payments',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ playerId: 'm1', periodId: 'p1', paid: true }),
        })
      )
    );
  });

  it('creates a new billing period, defaulting payment instructions from the last period', async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<AdminDashboardPage />);
    await screen.findByText('Bier');
    await user.click(screen.getByRole('button', { name: 'Abrechnung' }));
    await screen.findByText('Fabi');

    await user.click(screen.getByText('Neue Abrechnung'));

    expect(screen.getByDisplayValue('IBAN DE00')).toBeInTheDocument();

    const [startInput] = document.querySelectorAll('input[type="date"]');
    fireEvent.change(startInput, { target: { value: '2026-07-15' } });
    await user.click(screen.getByText('Abrechnung erstellen'));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/billing-periods',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            startDate: '2026-07-15',
            endDate: null,
            paymentInstructions: 'IBAN DE00',
          }),
        })
      )
    );
  });
});
