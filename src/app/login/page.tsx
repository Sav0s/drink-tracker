"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <Flex minH="100dvh" flexDir="column" bg="#0d1014" px={5}>
      <Flex flex={1} flexDir="column" alignItems="center" justifyContent="center">
        <Flex
          w="84px" h="84px" borderRadius="9999px" bg="#1b212b"
          alignItems="center" justifyContent="center"
          fontSize="36px" mb={5}
        >
          ⚽
        </Flex>

        <Text fontSize="27px" fontWeight="800" letterSpacing="-0.5px" color="#eaedf2" mb={1.5}>
          Kabinen-Bar
        </Text>
        <Text fontSize="14px" color="#939dab" mb={10}>
          Getränke-Tracker · TSV Bobingen
        </Text>

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
          mb={4}
          onClick={handleGoogleLogin}
        >
          <GoogleIcon />
          Mit Google anmelden
        </Box>

        <Text fontSize="12px" color="#5c6675" textAlign="center">
          Dein Google-Name wird als Anzeigename verwendet.
        </Text>
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
