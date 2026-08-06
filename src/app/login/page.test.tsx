import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ChakraProvider } from '@chakra-ui/react';
import { system } from '@/lib/theme';
import { render, screen, waitFor, fireEvent, within } from '@/test-utils';
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

  it('disables the submit button in the server-rendered markup, before the client has hydrated', () => {
    // This is the exact HTML a fast click hits before React attaches its
    // onSubmit handler. If the button isn't disabled here, that click falls
    // through to a native form submission (page reloads to "/login?", the
    // email field is wiped, and no OTP is ever sent) instead of running
    // handleSendCode.
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <ChakraProvider value={system}>
        <LoginPage />
      </ChakraProvider>
    );

    const button = within(container).getByText('Code senden').closest('button');
    expect(button).toBeDisabled();
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
    // The page's own useEffect auto-focuses digit 0 via a setTimeout(80ms) once
    // the OTP step mounts. Let it fire before typing, so it can't race the
    // typing loop below and steal focus back to digit 0 mid-sequence.
    await new Promise((resolve) => setTimeout(resolve, 100));

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
    // See the comment in the previous test — let the auto-focus timer fire first.
    await new Promise((resolve) => setTimeout(resolve, 100));

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

  it('auto-fills all digits when iOS AutoFill inserts the full code into the first field', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('deine@email.de'), 'fabi@example.com');
    await user.click(screen.getByText('Code senden'));
    await waitFor(() => expect(screen.getAllByTestId(/otp-digit-/)).toHaveLength(6));

    // iOS AutoFill fires a single change event with the full 6-digit value —
    // NOT a series of keystrokes. fireEvent.change replicates that exactly.
    fireEvent.change(screen.getByTestId('otp-digit-0'), { target: { value: '123456' } });

    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith(
        expect.objectContaining({ token: '123456', type: 'email' })
      )
    );
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
