"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, Text } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Pencil, Check } from "lucide-react";
import { formatCents } from "@/types";
import { ROUTES, DEFAULT_PLAYER_NAME } from "@/lib/constants";

interface DrinkState {
  id: string;
  name: string;
  price_cents: number;
  count: number;
}

interface Toast   { drink: DrinkState }
interface EditSheet { drink: DrinkState | null }

function TallyBundle() {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="2"  y1="2" x2="2"  y2="18" stroke="#939dab" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="7"  y1="2" x2="7"  y2="18" stroke="#939dab" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="2" x2="12" y2="18" stroke="#939dab" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="17" y1="2" x2="17" y2="18" stroke="#939dab" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="0"  y1="16" x2="22" y2="4" stroke="#939dab" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TallyBar() {
  return (
    <svg width="6" height="20" viewBox="0 0 6 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="3" y1="2" x2="3" y2="18" stroke="#939dab" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Strichliste({ count }: { count: number }) {
  if (count === 0) {
    return <Text as="span" fontSize="12px" color="#5c6675">noch keins diesen Monat</Text>;
  }
  const bundles   = Math.floor(count / 5);
  const remainder = count % 5;
  return (
    <Flex alignItems="center" gap="6px" flexWrap="wrap">
      {Array.from({ length: bundles   }).map((_, i) => <TallyBundle key={i} />)}
      {Array.from({ length: remainder }).map((_, i) => <TallyBar    key={i} />)}
      <Text as="span" fontSize="12px" color="#5c6675" ml="2px">{count}×</Text>
    </Flex>
  );
}

export default function HauptseiteePage() {
  const router = useRouter();
  const [player,    setPlayer]    = useState<string>("");
  const [drinks,    setDrinks]    = useState<DrinkState[]>([]);
  const [toast,     setToast]     = useState<Toast | null>(null);
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [editSheet, setEditSheet] = useState<EditSheet>({ drink: null });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push(ROUTES.LOGIN); return; }
      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name     ||
        user.email?.split("@")[0]    ||
        DEFAULT_PLAYER_NAME;
      setPlayer(name);
    });

    fetch("/api/home")
      .then((r) => r.json())
      .then((data) => setDrinks(data.drinks ?? []))
      .catch(() => {});
  }, [router]);

  const saldo = drinks.reduce((sum, d) => sum + d.count * d.price_cents, 0);

  const bookDrink = useCallback(
    (drink: DrinkState) => {
      setDrinks((prev) =>
        prev.map((d) => (d.id === drink.id ? { ...d, count: d.count + 1 } : d))
      );
      fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drinkId: drink.id }),
      }).catch(() => {});
      if (toastTimer) clearTimeout(toastTimer);
      setToast({ drink });
      const t = setTimeout(() => setToast(null), 3500);
      setToastTimer(t);
    },
    [toastTimer]
  );

  function undoBooking() {
    if (!toast) return;
    const drinkId = toast.drink.id;
    setDrinks((prev) =>
      prev.map((d) =>
        d.id === drinkId ? { ...d, count: Math.max(0, d.count - 1) } : d
      )
    );
    fetch(`/api/bookings/last?drinkId=${drinkId}`, { method: "DELETE" }).catch(() => {});
    if (toastTimer) clearTimeout(toastTimer);
    setToast(null);
  }

  function removeBookingEntry(drinkId: string) {
    setDrinks((prev) =>
      prev.map((d) => (d.id === drinkId ? { ...d, count: Math.max(0, d.count - 1) } : d))
    );
    fetch(`/api/bookings/last?drinkId=${drinkId}`, { method: "DELETE" }).catch(() => {});
  }

  const initials = player.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Box minH="100dvh" bg="#0d1014" pb="80px" position="relative">

      {/* App bar */}
      <Flex
        as="header"
        alignItems="center"
        justifyContent="space-between"
        px={5}
        py="14px"
        borderBottom="1px solid rgba(255,255,255,0.07)"
      >
        <Text fontSize="17px" fontWeight="700" color="#eaedf2">Kabinen-Bar</Text>
        <Box
          as="button"
          bg="none"
          border="none"
          cursor="pointer"
          p={0}
          onClick={() => router.push(ROUTES.PROFILE)}
        >
          <Flex
            w="36px" h="36px" borderRadius="9999px" bg="#0468b3"
            alignItems="center" justifyContent="center"
            fontSize="13px" fontWeight="700" color="white"
          >
            {initials}
          </Flex>
        </Box>
      </Flex>

      {/* Saldo hero */}
      <Box
        mx={5} mt={5} mb={2}
        px="22px" py={5}
        borderRadius="16px"
        bg="linear-gradient(135deg, rgba(4,104,179,0.22) 0%, rgba(4,104,179,0.08) 100%)"
        border="1px solid rgba(4,104,179,0.3)"
      >
        <Text
          fontSize="12px" fontWeight="600" letterSpacing="0.08em"
          textTransform="uppercase" color="#939dab" mb="6px"
        >
          Du schuldest
        </Text>
        <Text fontSize="40px" fontWeight="800" letterSpacing="-1.2px" color="#eaedf2" mb="12px">
          {formatCents(saldo)}
        </Text>
        <Flex alignItems="center" gap={2}>
          <Text as="span" fontSize="12px" color="#939dab">
            {drinks.reduce((s, d) => s + d.count, 0)} Getränke
          </Text>
          <Text as="span" fontSize="12px" color="#5c6675">·</Text>
          <Text as="span" fontSize="12px" color="#939dab">Abrechnung seit 01.06.</Text>
        </Flex>
      </Box>

      {/* Section label */}
      <Text
        fontSize="11px" fontWeight="700" letterSpacing="0.1em"
        textTransform="uppercase" color="#5c6675"
        px={5} pt="12px" pb={2}
      >
        Getränke · tippen zum Buchen
      </Text>

      {/* Drink cards */}
      <Flex flexDir="column" gap={2} px={5}>
        {drinks.map((drink) => (
          <Flex
            key={drink.id}
            alignItems="center"
            justifyContent="space-between"
            px={4}
            py="14px"
            bg="#151a21"
            border="1px solid rgba(255,255,255,0.07)"
            borderRadius="12px"
            cursor="pointer"
            onClick={() => bookDrink(drink)}
            transition="border-color 0.12s"
          >
            <Flex flexDir="column" gap={1}>
              <Text fontSize="16px" fontWeight="600" color="#eaedf2">{drink.name}</Text>
              <Text fontSize="13px" color="#939dab">{formatCents(drink.price_cents)}</Text>
              <Strichliste count={drink.count} />
            </Flex>
            <Flex alignItems="center" gap={2}>
              <Box
                as="button"
                bg="none"
                border="none"
                cursor="pointer"
                p="6px"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setEditSheet({ drink }); }}
              >
                <Pencil size={13} color="#5c6675" />
              </Box>
              <Flex
                w="56px" h="56px" borderRadius="14px" bg="#0468b3"
                alignItems="center" justifyContent="center"
                boxShadow="0 8px 20px -8px rgba(4,104,179,0.7)"
                flexShrink={0}
              >
                <Plus size={22} color="#fff" />
              </Flex>
            </Flex>
          </Flex>
        ))}
      </Flex>

      {/* Undo toast */}
      {toast && (
        <Flex
          position="fixed"
          bottom="24px"
          left="50%"
          transform="translateX(-50%)"
          bg="#222934"
          border="1px solid rgba(255,255,255,0.12)"
          borderRadius="12px"
          px={4}
          py="12px"
          alignItems="center"
          gap="10px"
          minW="280px"
          boxShadow="0 8px 24px -12px rgba(0,0,0,0.55)"
          zIndex={100}
        >
          <Check size={16} color="#2fa968" />
          <Text flex={1} fontSize="14px" color="#eaedf2">
            {toast.drink.name} gebucht · {formatCents(toast.drink.price_cents)}
          </Text>
          <Box
            as="button"
            bg="none"
            border="none"
            cursor="pointer"
            color="#0468b3"
            fontSize="14px"
            fontWeight="600"
            onClick={undoBooking}
          >
            Rückgängig
          </Box>
        </Flex>
      )}

      {/* Edit bottom sheet */}
      {editSheet.drink && (
        <>
          <Box
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            bg="rgba(0,0,0,0.6)"
            zIndex={200}
            onClick={() => setEditSheet({ drink: null })}
          />
          <Box
            position="fixed"
            bottom={0}
            left="50%"
            transform="translateX(-50%)"
            w="full"
            maxW="430px"
            bg="#151a21"
            borderTopLeftRadius="26px"
            borderTopRightRadius="26px"
            px={5}
            pt={4}
            pb={8}
            zIndex={201}
          >
            <Box
              w="36px" h="4px" borderRadius="9999px"
              bg="rgba(255,255,255,0.12)"
              mx="auto" mb={4}
            />
            <Text fontSize="18px" fontWeight="700" color="#eaedf2" mb={1}>
              {editSheet.drink.name} korrigieren
            </Text>
            <Text fontSize="13px" color="#939dab" mb={4}>
              {editSheet.drink.count}× dieses Getränk diese Abrechnung
            </Text>
            <Flex flexDir="column" gap="2px" mb={5}>
              {Array.from({ length: editSheet.drink.count }).map((_, i) => (
                <Flex
                  key={i}
                  justifyContent="space-between"
                  alignItems="center"
                  py="10px"
                  borderBottom="1px solid rgba(255,255,255,0.05)"
                >
                  <Text fontSize="14px" color="#eaedf2">Eintrag {i + 1}</Text>
                  <Box
                    as="button"
                    bg="none"
                    border="none"
                    cursor="pointer"
                    color="#e0535f"
                    fontSize="13px"
                    fontWeight="500"
                    onClick={() => {
                      removeBookingEntry(editSheet.drink!.id);
                      setEditSheet((prev) => ({
                        drink: prev.drink
                          ? { ...prev.drink, count: Math.max(0, prev.drink.count - 1) }
                          : null,
                      }));
                    }}
                  >
                    ✕ entfernen
                  </Box>
                </Flex>
              ))}
            </Flex>
            <Box
              as="button"
              display="flex"
              alignItems="center"
              justifyContent="center"
              w="full"
              h="52px"
              borderRadius="12px"
              bg="#0468b3"
              color="white"
              fontSize="16px"
              fontWeight="700"
              border="none"
              cursor="pointer"
              onClick={() => setEditSheet({ drink: null })}
            >
              Fertig
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
