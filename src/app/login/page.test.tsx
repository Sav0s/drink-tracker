import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';

const signInWithOAuth = vi.fn();
const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signInWithOAuth, signInWithOtp, verifyOtp },
  }),
}));

// verifyOtp success navigates via window.location.assign — intercept it
const locationAssign = vi.fn();
Object.defineProperty(window, 'location', {
  value: { ...window.location, assign: locationAssign },
  writable: true,
});

const { default: LoginPage } = await import('./page');

describe('LoginPage', () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
    signInWithOtp.mockReset();
    verifyOtp.mockReset();
    locationAssign.mockReset();
  });

  it('renders the Google button and the email form', () => {
    render(<LoginPage />);
    expect(screen.getByText('Mit Google anmelden')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('deine@email.de')).toBeInTheDocument();
    expect(screen.getByText('Code senden')).toBeInTheDocument();
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
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('deine@email.de'), 'fabi@example');
    await user.click(screen.getByText('Code senden'));

    expect(screen.getByText('Bitte gib eine gültige E-Mail-Adresse ein.')).toBeInTheDocument();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('shows 6-digit input after a successful OTP send', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('deine@email.de'), 'fabi@example.com');
    await user.click(screen.getByText('Code senden'));

    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'fabi@example.com' })
    );
    await waitFor(() => expect(screen.getByText('Code eingeben')).toBeInTheDocument());
    expect(screen.getByText(/fabi@example\.com/)).toBeInTheDocument();
    expect(screen.getAllByTestId(/otp-digit-/)).toHaveLength(6);
  });

  it('shows an error when Supabase fails to send the code', async () => {
    signInWithOtp.mockResolvedValue({ error: new Error('boom') });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('deine@email.de'), 'fabi@example.com');
    await user.click(screen.getByText('Code senden'));

    expect(await screen.findByText('Senden fehlgeschlagen. Bitte versuche es erneut.')).toBeInTheDocument();
    // stays on email step
    expect(screen.getByPlaceholderText('deine@email.de')).toBeInTheDocument();
  });

  it('auto-verifies when all 6 digits are filled and redirects on success', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('deine@email.de'), 'fabi@example.com');
    await user.click(screen.getByText('Code senden'));
    await waitFor(() => expect(screen.getAllByTestId(/otp-digit-/)).toHaveLength(6));

    const inputs = screen.getAllByTestId(/otp-digit-/);
    for (const [i, input] of inputs.entries()) {
      await user.type(input, String(i + 1));
    }

    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'fabi@example.com', token: '123456', type: 'email' })
      )
    );
    await waitFor(() => expect(locationAssign).toHaveBeenCalledWith('/auth/callback'));
  });

  it('shows an error and clears the digits for an invalid code', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: new Error('Invalid OTP') });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('deine@email.de'), 'fabi@example.com');
    await user.click(screen.getByText('Code senden'));
    await waitFor(() => expect(screen.getAllByTestId(/otp-digit-/)).toHaveLength(6));

    const inputs = screen.getAllByTestId(/otp-digit-/);
    for (const [i, input] of inputs.entries()) {
      await user.type(input, String(i + 1));
    }

    expect(await screen.findByText(/Ungültiger oder abgelaufener Code/)).toBeInTheDocument();
    // digits are cleared
    for (const input of screen.getAllByTestId(/otp-digit-/)) {
      expect(input).toHaveValue('');
    }
  });

  it('goes back to the email step via "Andere E-Mail"', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('deine@email.de'), 'fabi@example.com');
    await user.click(screen.getByText('Code senden'));
    await waitFor(() => expect(screen.getByText('Code eingeben')).toBeInTheDocument());

    await user.click(screen.getByText('Andere E-Mail'));

    expect(screen.getByPlaceholderText('deine@email.de')).toBeInTheDocument();
  });

  it('resends the code when "Code erneut senden" is clicked', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('deine@email.de'), 'fabi@example.com');
    await user.click(screen.getByText('Code senden'));
    await waitFor(() => expect(screen.getByText('Code erneut senden')).toBeInTheDocument());

    await user.click(screen.getByText('Code erneut senden'));

    expect(signInWithOtp).toHaveBeenCalledTimes(2);
  });
});
