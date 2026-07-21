import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';

const signInWithOAuth = vi.fn();
const signInWithOtp = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signInWithOAuth, signInWithOtp },
  }),
}));

const { default: LoginPage } = await import('./page');

describe('LoginPage', () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
    signInWithOtp.mockReset();
  });

  it('renders the Google button and the magic-link form', () => {
    render(<LoginPage />);
    expect(screen.getByText('Mit Google anmelden')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('deine@email.de')).toBeInTheDocument();
  });

  it('starts Google OAuth on click', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByText('Mit Google anmelden'));

    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    );
  });

  it('shows a validation error for an invalid email without calling Supabase', async () => {
    // Passes the native <input type="email"> constraint (so the form actually
    // submits in jsdom) but fails the stricter app-level EMAIL_RE (no TLD).
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('deine@email.de'), 'fabi@example');
    await user.click(screen.getByText('Login-Link senden'));

    expect(screen.getByText('Bitte gib eine gültige E-Mail-Adresse ein.')).toBeInTheDocument();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('sends a magic link for a valid email and shows the confirmation', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('deine@email.de'), 'fabi@example.com');
    await user.click(screen.getByText('Login-Link senden'));

    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'fabi@example.com' })
    );
    expect(await screen.findByText('Login-Link gesendet')).toBeInTheDocument();
    expect(screen.getByText('fabi@example.com')).toBeInTheDocument();
  });

  it('shows an error state when Supabase fails to send the link', async () => {
    signInWithOtp.mockResolvedValue({ error: new Error('boom') });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('deine@email.de'), 'fabi@example.com');
    await user.click(screen.getByText('Login-Link senden'));

    expect(await screen.findByText('Senden fehlgeschlagen. Bitte versuche es erneut.')).toBeInTheDocument();
  });

  it('lets the user go back to the form from the confirmation screen', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('deine@email.de'), 'fabi@example.com');
    await user.click(screen.getByText('Login-Link senden'));
    await screen.findByText('Login-Link gesendet');

    await user.click(screen.getByText('Andere E-Mail verwenden'));

    expect(screen.getByPlaceholderText('deine@email.de')).toBeInTheDocument();
  });
});
