"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, Text } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/constants";

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // If already logged in as admin, skip login screen
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((player) => {
        if (player.isAdmin) router.push(ROUTES.ADMIN_DASHBOARD);
      })
      .catch(() => {/* not logged in — stay on login page */});
  }, [router]);

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${ROUTES.ADMIN_DASHBOARD}`,
      },
    });
    if (error) {
      setError("Anmeldung fehlgeschlagen.");
      setLoading(false);
    }
  }

  return (
    <Flex
      minH="100dvh"
      flexDir="column"
      alignItems="center"
      justifyContent="center"
      bg="#0b0e13"
      px={5}
    >
      <Flex flexDir="column" alignItems="center" w="full" maxW="sm">

        {/* Icon */}
        <Flex
          w="64px" h="64px"
          borderRadius="16px"
          bg="rgba(100,120,160,0.2)"
          border="1px solid rgba(100,120,160,0.3)"
          alignItems="center"
          justifyContent="center"
          fontSize="30px"
          mb={5}
        >
          🛡️
        </Flex>

        <Text fontSize="24px" fontWeight="800" letterSpacing="-0.5px" color="#eaedf2" mb="6px">
          Admin-Bereich
        </Text>
        <Text fontSize="14px" color="#939dab" mb={10}>
          Kabinen-Bar · TSV Bobingen
        </Text>

        {/* Error */}
        {error && (
          <Box
            w="full"
            mb={4}
            px={4}
            py={3}
            borderRadius="12px"
            bg="rgba(224,83,95,0.1)"
            border="1px solid rgba(224,83,95,0.3)"
            color="#e0535f"
            fontSize="14px"
            textAlign="center"
          >
            {error}
          </Box>
        )}

        {/* Google button */}
        <Box
          as="button"
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap={3}
          w="full"
          h="52px"
          borderRadius="12px"
          bg="white"
          color="#1a1a1a"
          fontSize="15px"
          fontWeight="600"
          border="none"
          cursor="pointer"
          opacity={loading ? 0.6 : 1}
          transition="opacity 0.15s"
          onClick={handleGoogleLogin}
        >
          <GoogleIcon />
          {loading ? "Weiterleitung…" : "Mit Google anmelden"}
        </Box>

        <Text fontSize="12px" color="#5c6675" textAlign="center" mt={4}>
          Nur Admins haben Zugang zu diesem Bereich.
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
