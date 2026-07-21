import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
const getUser = vi.fn();
const signOut = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser, signOut },
  }),
}));

const { AppBar } = await import('./AppBar');

function mockFetchMe(response: object) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ json: () => Promise.resolve(response) }))
  );
}

describe('AppBar', () => {
  beforeEach(() => {
    push.mockReset();
    signOut.mockReset();
    getUser.mockResolvedValue({ data: { user: { email: 'fabi@example.com' } } });
  });

  it('renders the default title', async () => {
    mockFetchMe({ name: 'Fabi', isAdmin: false });
    render(<AppBar />);
    expect(screen.getByText('Kabinen-Bar')).toBeInTheDocument();
  });

  it('renders a custom title and subtitle', async () => {
    mockFetchMe({ name: 'Fabi', isAdmin: false });
    render(<AppBar title="Admin" subtitle="Admin Console" />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('· Admin Console')).toBeInTheDocument();
  });

  it('hides the Admin Console menu entry for non-admins', async () => {
    mockFetchMe({ name: 'Fabi', isAdmin: false });
    const user = userEvent.setup();
    render(<AppBar />);

    await waitFor(() => expect(screen.getByText('F')).toBeInTheDocument());
    await user.click(screen.getByText('F'));

    expect(screen.getByText('Buchungen')).toBeInTheDocument();
    expect(screen.queryByText('Admin Console')).not.toBeInTheDocument();
  });

  it('shows the Admin Console menu entry for admins', async () => {
    mockFetchMe({ name: 'Fabi', isAdmin: true });
    const user = userEvent.setup();
    render(<AppBar />);

    await waitFor(() => expect(screen.getByText('F')).toBeInTheDocument());
    await user.click(screen.getByText('F'));

    expect(screen.getByText('Admin Console')).toBeInTheDocument();
  });

  it('signs out and redirects to /login', async () => {
    mockFetchMe({ name: 'Fabi', isAdmin: false });
    signOut.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AppBar />);

    await waitFor(() => expect(screen.getByText('F')).toBeInTheDocument());
    await user.click(screen.getByText('F'));
    await user.click(screen.getByText('Ausloggen'));

    expect(signOut).toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });
});
