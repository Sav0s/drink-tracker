"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, Text, Image } from "@chakra-ui/react";
import { ChevronLeft, Receipt, Settings, LogOut, LayoutDashboard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROUTES, DEFAULT_PLAYER_NAME } from "@/lib/constants";

interface AppBarProps {
  /** Title shown on the left. Defaults to the app name. */
  title?: string;
  /** Greyed-out suffix after the title, e.g. "Admin Console". */
  subtitle?: string;
  /** Show a back chevron that returns to the home screen. */
  showBack?: boolean;
  /** Custom back handler (e.g. to guard unsaved changes). Defaults to routing home. */
  onBack?: () => void;
}

/**
 * Shared top bar: app/page title on the left (click → home), account avatar
 * with a dropdown menu (Buchungen · [Admin Console] · Konto verwalten ·
 * Ausloggen) on the right. The Admin Console entry only shows for admins.
 */
export function AppBar({ title = "Kabinen-Bar", subtitle, showBack = false, onBack }: AppBarProps) {
  const router = useRouter();
  const [player, setPlayer] = useState("");
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        DEFAULT_PLAYER_NAME;
      setPlayer(name);
      setEmail(user.email ?? "");
    });

    fetch("/api/me")
      .then((r) => r.json())
      .then((me) => setIsAdmin(Boolean(me?.isAdmin)))
      .catch(() => {});
  }, []);

  const initials = player.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(ROUTES.LOGIN);
  }

  return (
    <Flex
      as="header"
      alignItems="center"
      justifyContent="space-between"
      px={5}
      py="14px"
      borderBottom="1px solid rgba(255,255,255,0.07)"
    >
      <Flex alignItems="center" gap={2}>
        {showBack && (
          <Box
            as="button"
            p="6px"
            ml="-6px"
            cursor="pointer"
            bg="none"
            border="none"
            onClick={() => (onBack ? onBack() : router.push(ROUTES.HOME))}
          >
            <ChevronLeft size={20} color="#eaedf2" />
          </Box>
        )}
        <Flex
          as="button"
          alignItems="center"
          gap={2}
          bg="none"
          border="none"
          p={0}
          cursor="pointer"
          onClick={() => router.push(ROUTES.HOME)}
        >
          {!showBack && (
            <Image
              src="/tsv-bobingen-logo.png"
              alt="TSV Bobingen"
              w="28px"
              h="28px"
              objectFit="contain"
            />
          )}
          <Text fontSize="17px" fontWeight="700" color="#eaedf2">
            {title}
            {subtitle && (
              <Text as="span" fontWeight="400" color="#939dab">{` · ${subtitle}`}</Text>
            )}
          </Text>
        </Flex>
      </Flex>

      <Box position="relative">
        <Box
          as="button"
          bg="none"
          border="none"
          cursor="pointer"
          p={0}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Flex
            w="36px" h="36px" borderRadius="9999px" bg="#0468b3"
            alignItems="center" justifyContent="center"
            fontSize="13px" fontWeight="700" color="white"
          >
            {initials}
          </Flex>
        </Box>

        {menuOpen && (
          <>
            {/* Click-away backdrop */}
            <Box
              position="fixed"
              top={0} left={0} right={0} bottom={0}
              zIndex={300}
              onClick={() => setMenuOpen(false)}
            />
            {/* Account menu */}
            <Box
              position="absolute"
              top="calc(100% + 10px)"
              right={0}
              w="240px"
              bg="#151a21"
              border="1px solid rgba(255,255,255,0.09)"
              borderRadius="14px"
              boxShadow="0 16px 40px -12px rgba(0,0,0,0.7)"
              py={2}
              zIndex={301}
              overflow="hidden"
            >
              {/* User header */}
              <Flex alignItems="center" gap={3} px={4} py={3}>
                <Flex
                  w="40px" h="40px" borderRadius="9999px" bg="#0468b3"
                  alignItems="center" justifyContent="center"
                  fontSize="14px" fontWeight="700" color="white" flexShrink={0}
                >
                  {initials}
                </Flex>
                <Box minW={0}>
                  <Text fontSize="14px" fontWeight="700" color="#eaedf2" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                    {player}
                  </Text>
                  {email && (
                    <Text fontSize="12px" color="#939dab" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                      {email}
                    </Text>
                  )}
                </Box>
              </Flex>

              <Box h="1px" bg="rgba(255,255,255,0.07)" my={1} />

              {/* Buchungen */}
              <Flex
                as="button"
                w="full"
                alignItems="center"
                gap={3}
                px={4}
                py="11px"
                bg="none"
                border="none"
                cursor="pointer"
                textAlign="left"
                _hover={{ bg: "#1b212b" }}
                onClick={() => { setMenuOpen(false); router.push(ROUTES.BOOKINGS); }}
              >
                <Receipt size={17} color="#939dab" />
                <Text fontSize="14px" color="#eaedf2">Buchungen</Text>
              </Flex>

              {/* Admin Console (admins only) */}
              {isAdmin && (
                <Flex
                  as="button"
                  w="full"
                  alignItems="center"
                  gap={3}
                  px={4}
                  py="11px"
                  bg="none"
                  border="none"
                  cursor="pointer"
                  textAlign="left"
                  _hover={{ bg: "#1b212b" }}
                  onClick={() => { setMenuOpen(false); router.push(ROUTES.ADMIN_DASHBOARD); }}
                >
                  <LayoutDashboard size={17} color="#939dab" />
                  <Text fontSize="14px" color="#eaedf2">Admin Console</Text>
                </Flex>
              )}

              {/* Konto verwalten */}
              <Flex
                as="button"
                w="full"
                alignItems="center"
                gap={3}
                px={4}
                py="11px"
                bg="none"
                border="none"
                cursor="pointer"
                textAlign="left"
                _hover={{ bg: "#1b212b" }}
                onClick={() => { setMenuOpen(false); router.push(ROUTES.ACCOUNT); }}
              >
                <Settings size={17} color="#939dab" />
                <Text fontSize="14px" color="#eaedf2">Konto verwalten</Text>
              </Flex>

              <Box h="1px" bg="rgba(255,255,255,0.07)" my={1} />

              {/* Ausloggen */}
              <Flex
                as="button"
                w="full"
                alignItems="center"
                gap={3}
                px={4}
                py="11px"
                bg="none"
                border="none"
                cursor="pointer"
                textAlign="left"
                _hover={{ bg: "#1b212b" }}
                onClick={() => { setMenuOpen(false); logout(); }}
              >
                <LogOut size={17} color="#e0535f" />
                <Text fontSize="14px" color="#e0535f">Ausloggen</Text>
              </Flex>
            </Box>
          </>
        )}
      </Box>
    </Flex>
  );
}
