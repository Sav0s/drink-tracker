"use client";

import { useState } from "react";
import { Box, Flex, Text, Input, Image } from "@chakra-ui/react";
import { Mail, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus("error");
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    setStatus("sending");
    setError("");

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (otpError) {
      setStatus("error");
      setError("Senden fehlgeschlagen. Bitte versuche es erneut.");
    } else {
      setStatus("sent");
    }
  }

  return (
    <Flex minH="100dvh" flexDir="column" bg="#0d1014" px={5}>
      <Flex flex={1} flexDir="column" alignItems="center" justifyContent="center" w="full" maxW="sm" mx="auto">
        <Image
          src="/tsv-bobingen-logo.png"
          alt="TSV Bobingen"
          w="96px"
          h="96px"
          objectFit="contain"
          mb={5}
        />

        <Text fontSize="27px" fontWeight="800" letterSpacing="-0.5px" color="#eaedf2" mb={1.5}>
          Kabinen-Bar
        </Text>
        <Text fontSize="14px" color="#939dab" mb={10}>
          Getränke-Tracker · TSV Bobingen
        </Text>

        {status === "sent" ? (
          /* Magic-link confirmation */
          <Flex
            flexDir="column"
            alignItems="center"
            textAlign="center"
            w="full"
            bg="#151a21"
            border="1px solid rgba(255,255,255,0.07)"
            borderRadius="16px"
            px={5}
            py={7}
          >
            <CheckCircle2 size={40} color="#2fa968" />
            <Text fontSize="17px" fontWeight="700" color="#eaedf2" mt={3} mb={1}>
              Login-Link gesendet
            </Text>
            <Text fontSize="14px" color="#939dab" mb={5}>
              Wir haben dir einen Link an <Text as="span" color="#eaedf2">{email.trim()}</Text> geschickt.
              Öffne ihn auf diesem Gerät, um dich anzumelden.
            </Text>
            <Box
              as="button"
              bg="none"
              border="none"
              cursor="pointer"
              color="#0468b3"
              fontSize="14px"
              fontWeight="600"
              onClick={() => { setStatus("idle"); setError(""); }}
            >
              Andere E-Mail verwenden
            </Box>
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

            {/* Divider */}
            <Flex alignItems="center" w="full" gap={3} my={5}>
              <Box flex={1} h="1px" bg="rgba(255,255,255,0.1)" />
              <Text fontSize="12px" color="#5c6675">oder</Text>
              <Box flex={1} h="1px" bg="rgba(255,255,255,0.1)" />
            </Flex>

            {/* Magic-link form */}
            <Flex as="form" flexDir="column" w="full" gap={3} onSubmit={handleMagicLink}>
              <Input
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEmail(e.target.value);
                  if (status === "error") { setStatus("idle"); setError(""); }
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

              {status === "error" && (
                <Text fontSize="13px" color="#e0535f">{error}</Text>
              )}

              <Box
                as="button"
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
                cursor={status === "sending" ? "default" : "pointer"}
                w="full"
                opacity={status === "sending" ? 0.7 : 1}
                _hover={status === "sending" ? undefined : { bg: "#0576cc" }}
              >
                <Mail size={18} />
                {status === "sending" ? "Wird gesendet…" : "Login-Link senden"}
              </Box>
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
