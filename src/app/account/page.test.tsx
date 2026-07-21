import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
const getUser = vi.fn();
// Stable across renders — this page's data-fetch effect depends on [router],
// so a fresh object per render would re-fire it and reset local state.
const router = { push };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser, signOut: vi.fn() },
  }),
}));

const { default: AccountPage } = await import('./page');

function mockFetch(name = 'Fabi') {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/me' && (!init || init.method === undefined)) {
        return Promise.resolve({ json: () => Promise.resolve({ name, isAdmin: false }) });
      }
      if (url === '/api/me' && init?.method === 'PATCH') {
        const body = JSON.parse(init.body as string);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: body.name }) });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    })
  );
}

describe('AccountPage', () => {
  beforeEach(() => {
    push.mockReset();
    getUser.mockResolvedValue({ data: { user: { email: 'fabi@example.com' } } });
    mockFetch();
  });

  it('shows a loading state before the initial fetch resolves', () => {
    const { container } = render(<AccountPage />);
    expect(container.querySelector('.chakra-spinner')).toBeInTheDocument();
  });

  it('loads and displays the current name', async () => {
    render(<AccountPage />);
    expect(await screen.findByDisplayValue('Fabi')).toBeInTheDocument();
  });

  it('keeps Speichern/Verwerfen disabled until the name changes', async () => {
    render(<AccountPage />);
    await screen.findByDisplayValue('Fabi');

    const saveButton = screen.getByText('Speichern');
    expect(saveButton).toHaveStyle({ cursor: 'default' });
  });

  it('enables and saves a new name', async () => {
    const user = userEvent.setup();
    render(<AccountPage />);
    const input = await screen.findByDisplayValue('Fabi');

    await user.clear(input);
    await user.type(input, 'Fabian');
    await user.click(screen.getByText('Speichern'));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/me',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Fabian' }) })
      )
    );
  });

  it('discards changes with Verwerfen', async () => {
    const user = userEvent.setup();
    render(<AccountPage />);
    const input = await screen.findByDisplayValue('Fabi');

    await user.clear(input);
    await user.type(input, 'Someone Else');
    await user.click(screen.getByText('Verwerfen'));

    expect(screen.getByDisplayValue('Fabi')).toBeInTheDocument();
  });

  it('navigates home directly when there are no unsaved changes', async () => {
    const user = userEvent.setup();
    const { container } = render(<AccountPage />);
    await screen.findByDisplayValue('Fabi');

    await user.click(container.querySelectorAll('button')[0]);

    expect(push).toHaveBeenCalledWith('/home');
  });

  it('asks for confirmation when leaving with unsaved changes', async () => {
    const user = userEvent.setup();
    const { container } = render(<AccountPage />);
    const input = await screen.findByDisplayValue('Fabi');

    await user.type(input, 'x');
    await user.click(container.querySelectorAll('button')[0]);

    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith('/home');

    await user.click(screen.getByText('Hier bleiben'));
    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument();

    await user.click(container.querySelectorAll('button')[0]);
    await user.click(screen.getByText('Verlassen'));
    expect(push).toHaveBeenCalledWith('/home');
  });
});
