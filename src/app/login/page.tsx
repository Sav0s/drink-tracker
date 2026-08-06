"use client";

import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { Box, Flex, Text, Input, Image, Button } from "@chakra-ui/react";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CLUB_NAME, ROUTES } from "@/lib/constants";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// No store to subscribe to — this only exists to get a value that's false
// during SSR and true once the client has taken over, per React's documented
// hydration-safe pattern (avoids the extra-render "setState in an effect"
// anti-pattern flagged by eslint-plugin-react-hooks).
function subscribeNoop() {
  return () => {};
}
function useMounted() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

export default function LoginPage() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const digitsRef = useRef(digits); // mirrors state; always current, no stale-closure risk
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  // False until the client has hydrated. The submit button stays disabled
  // until then — otherwise a click that lands before React attaches its
  // onSubmit handler falls through to a native form submission (reloads to
  // "/login?", wipes the email field, and never calls signInWithOtp).
  const mounted = useMounted();

  function updateDigits(next: string[]) {
    digitsRef.current = next;
    setDigits(next);
  }

  useEffect(() => {
    if (step === "otp") {
      const t = setTimeout(() => inputRefs.current[0]?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [step]);


  async function sendOtp(emailAddress: string) {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: e } = await supabase.auth.signInWithOtp({
      email: emailAddress,
      // No emailRedirectTo — that would send a magic link instead of a 6-digit code
    });
    setLoading(false);
    if (e) {
      setError("Senden fehlgeschlagen. Bitte versuche es erneut.");
      return false;
    }
    return true;
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    const ok = await sendOtp(trimmed);
    if (ok) {
      updateDigits(["", "", "", "", "", ""]);
      setStep("otp");
    }
  }

  async function resendCode() {
    updateDigits(["", "", "", "", "", ""]);
    await sendOtp(email.trim());
  }

  async function verifyCode(token: string) {
    if (token.length < 6 || loading) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: e } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });
    if (e) {
      setLoading(false);
      setError("Ungültiger oder abgelaufener Code. Bitte versuche es erneut.");
      updateDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } else {
      // Session is set — hand off to auth callback for player upsert + redirect
      window.location.assign(ROUTES.AUTH_CALLBACK);
    }
  }

  function handleDigitChange(index: number, value: string) {
    const cleaned = value.replace(/\D/g, "");
    // iOS AutoFill fires a single change event with all 6 digits
    if (cleaned.length === 6) {
      const next = cleaned.split("");
      updateDigits(next);
      if (error) setError("");
      inputRefs.current[5]?.focus();
      verifyCode(cleaned);
      return;
    }
    const digit = cleaned.slice(-1);
    // Read from ref, not the closure — ref is always current even if React
    // hasn't committed the previous setDigits yet (stale-closure defence).
    const next = [...digitsRef.current];
    next[index] = digit;
    updateDigits(next);
    if (error) setError("");
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
    if (digit && next.every((d) => d)) verifyCode(next.join(""));
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digitsRef.current[index] && index > 0) {
      const next = [...digitsRef.current];
      next[index - 1] = "";
      updateDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleDigitPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    const next = Array(6).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    updateDigits(next);
    inputRefs.current[Math.min(text.length, 5)]?.focus();
    if (text.length === 6) verifyCode(text);
  }

  function handleGoogleLogin() {
    const supabase = createClient();
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${ROUTES.AUTH_CALLBACK}` },
    });
  }

  const allFilled = digits.every(Boolean);

  return (
    <Flex minH="100dvh" flexDir="column" bg="#0d1014" px={5}>
      <Flex flex={1} flexDir="column" alignItems="center" justifyContent="center" w="full" maxW="sm" mx="auto">
        <Image
          src="/tsv-bobingen-logo.png"
          alt={CLUB_NAME || "Logo"}
          w="96px"
          h="96px"
          objectFit="contain"
          mb={5}
        />
        <Text fontSize="27px" fontWeight="800" letterSpacing="-0.5px" color="#eaedf2" mb={1.5}>
          Kabinen-Bar
        </Text>
        <Text fontSize="14px" color="#939dab" mb={10}>
          Getränke-Tracker{CLUB_NAME ? ` · ${CLUB_NAME}` : ""}
        </Text>

        {step === "otp" ? (
          <Flex flexDir="column" w="full" gap={5}>
            <Box>
              <Text fontSize="17px" fontWeight="700" color="#eaedf2" mb="6px">
                Code eingeben
              </Text>
              <Text fontSize="14px" color="#939dab">
                Wir haben einen 6-stelligen Code an{" "}
                <Text as="span" color="#eaedf2">{email.trim()}</Text> gesendet.
              </Text>
            </Box>

            {/* 6-digit OTP input */}
            <Flex gap={2}>
              {digits.map((d, i) => (
                <Input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  data-testid={`otp-digit-${i}`}
                  type="tel"
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={d}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleDigitKeyDown(i, e)}
                  onPaste={i === 0 ? handleDigitPaste : undefined}
                  disabled={loading}
                  flex={1}
                  h="60px"
                  textAlign="center"
                  fontSize="24px"
                  fontWeight="700"
                  bg="#1b212b"
                  border="1px solid"
                  borderColor={error ? "rgba(224,83,95,0.5)" : "rgba(255,255,255,0.12)"}
                  borderRadius="10px"
                  px={0}
                  color="#eaedf2"
                  _focus={{ borderColor: error ? "#e0535f" : "#0468b3", outline: "none" }}
                  _disabled={{ opacity: 0.5 }}
                />
              ))}
            </Flex>

            {error && (
              <Text fontSize="13px" color="#e0535f">{error}</Text>
            )}

            <Box
              as="button"
              display="flex"
              alignItems="center"
              justifyContent="center"
              h="52px"
              borderRadius="12px"
              bg={allFilled ? "#0468b3" : "#1b212b"}
              color={allFilled ? "white" : "#5c6675"}
              border="none"
              fontSize="15px"
              fontWeight="700"
              opacity={loading ? 0.7 : 1}
              cursor={loading || !allFilled ? "default" : "pointer"}
              onClick={() => verifyCode(digits.join(""))}
            >
              {loading ? "Wird überprüft…" : "Bestätigen"}
            </Box>

            <Flex justifyContent="center" alignItems="center" gap={3}>
              <Box
                as="button"
                bg="none"
                border="none"
                cursor="pointer"
                color="#5c6675"
                fontSize="13px"
                onClick={() => { setStep("email"); updateDigits(["", "", "", "", "", ""]); setError(""); }}
              >
                Andere E-Mail
              </Box>
              <Text fontSize="13px" color="#5c6675">·</Text>
              <Box
                as="button"
                bg="none"
                border="none"
                cursor={loading ? "default" : "pointer"}
                color="#0468b3"
                fontSize="13px"
                fontWeight="600"
                opacity={loading ? 0.5 : 1}
                onClick={resendCode}
              >
                Code erneut senden
              </Box>
            </Flex>
          </Flex>
        ) : (
          <>
            <Box
              as="button"
              display="flex"
              alignItems="center"
              justifyContent="center"
              gap={3}
              bg="white"
              color="#1a1a1a"
              border="none"
              borderRadius="12px"
              h="52px"
              fontSize="15px"
              fontWeight="600"
              cursor="pointer"
              w="full"
              onClick={handleGoogleLogin}
            >
              <GoogleIcon />
              Mit Google anmelden
            </Box>

            <Flex alignItems="center" w="full" gap={3} my={5}>
              <Box flex={1} h="1px" bg="rgba(255,255,255,0.1)" />
              <Text fontSize="12px" color="#5c6675">oder</Text>
              <Box flex={1} h="1px" bg="rgba(255,255,255,0.1)" />
            </Flex>

            <Flex as="form" flexDir="column" w="full" gap={3} onSubmit={handleSendCode}>
              <Input
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                placeholder="deine@email.de"
                h="52px"
                w="full"
                bg="#1b212b"
                border="1px solid rgba(255,255,255,0.12)"
                borderRadius="12px"
                px="14px"
                fontSize="15px"
                color="#eaedf2"
                outline="none"
                _focus={{ borderColor: "#0468b3" }}
                _placeholder={{ color: "#5c6675" }}
              />

              {error && (
                <Text fontSize="13px" color="#e0535f">{error}</Text>
              )}

              <Button
                type="submit"
                disabled={!mounted || loading}
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={2}
                bg="#0468b3"
                color="white"
                border="none"
                borderRadius="12px"
                h="52px"
                fontSize="15px"
                fontWeight="700"
                cursor={!mounted || loading ? "default" : "pointer"}
                w="full"
                opacity={!mounted || loading ? 0.7 : 1}
                _hover={!mounted || loading ? undefined : { bg: "#0576cc" }}
              >
                <Mail size={18} />
                {loading ? "Wird gesendet…" : "Code senden"}
              </Button>
            </Flex>

            <Text fontSize="12px" color="#5c6675" textAlign="center" mt={6}>
              Beim ersten Login wird automatisch ein Konto erstellt.
            </Text>
          </>
        )}
      </Flex>
    </Flex>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36.5 24 36.5c-5.2 0-9.6-3.5-11.2-8.2l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
    </svg>
  );
}
