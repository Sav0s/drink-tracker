"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, Text, Input } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Pencil, Check, AlertCircle } from "lucide-react";
import { formatCents } from "@/types";
import { ROUTES, NO_PAYMENT_INSTRUCTIONS_FALLBACK } from "@/lib/constants";
import { LoadingState } from "@/components/LoadingState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { AppBar } from "@/components/AppBar";

interface DrinkState {
  id: string;
  name: string;
  price_cents: number;
  count: number;
}

interface ClosedPeriod {
  id: string;
  range: string;
  total_cents: number;
  payment_instructions: string | null;
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
  const [drinks,    setDrinks]    = useState<DrinkState[]>([]);
  const [toast,     setToast]     = useState<Toast | null>(null);
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [editSheet, setEditSheet] = useState<EditSheet>({ drink: null });
  const [closedPeriodNotice, setClosedPeriodNotice] = useState<ClosedPeriod | null>(null);
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeName, setWelcomeName] = useState("");
  const [welcomeSaving, setWelcomeSaving] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetch("/api/home")
      .then((r) => r.json())
      .then((data) => {
        setDrinks(data.drinks ?? []);
        setClosedPeriodNotice(data.closedPeriod ?? null);
        setPeriodStart(data.periodStart ?? null);
        if (data.firstVisit) {
          setWelcomeName(data.playerName ?? "");
          setWelcomeOpen(true);
        }
      })
      .catch(() => setLoadError("Laden fehlgeschlagen. Bitte Seite neu laden."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push(ROUTES.LOGIN);
    });
    loadData();
  }, [router, loadData]);

  async function finishWelcome() {
    const trimmed = welcomeName.trim();
    if (!trimmed || welcomeSaving) return;
    setWelcomeSaving(true);
    try {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, onboarded: true }),
      });
      setWelcomeOpen(false);
    } catch {
      /* ignore */
    } finally {
      setWelcomeSaving(false);
    }
  }

  const saldo = drinks.reduce((sum, d) => sum + d.count * d.price_cents, 0);

  function markClosedPeriodPaid() {
    if (!closedPeriodNotice) return;
    fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId: closedPeriodNotice.id, paid: true }),
    }).catch(() => {});
    setClosedPeriodNotice(null);
  }

  const bookDrink = useCallback(
    (drink: DrinkState) => {
      setDrinks((prev) =>
        prev.map((d) => (d.id === drink.id ? { ...d, count: d.count + 1 } : d))
      );
      fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drinkId: drink.id }),
      }).catch(() => {
        // Revert optimistic update and show error
        setDrinks((prev) =>
          prev.map((d) => (d.id === drink.id ? { ...d, count: Math.max(0, d.count - 1) } : d))
        );
        setToast(null);
        setBookingError("Buchung fehlgeschlagen. Bitte erneut versuchen.");
      });
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

  return (
    <Box minH="100dvh" bg="#0d1014" pb="80px" position="relative">

      <AppBar />

      {loading ? (
        <LoadingState minH="320px" />
      ) : loadError ? (
        <Box px={5} pt={8}>
          <ErrorBanner message={loadError} onRetry={loadData} />
        </Box>
      ) : (
        <>
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
              Offener Betrag
            </Text>
            <Text fontSize="40px" fontWeight="800" letterSpacing="-1.2px" color="#eaedf2" mb="12px">
              {formatCents(saldo)}
            </Text>
            <Flex alignItems="center" gap={2}>
              <Text as="span" fontSize="12px" color="#939dab">
                {drinks.reduce((s, d) => s + d.count, 0)} Getränke
              </Text>
              {periodStart && (
                <>
                  <Text as="span" fontSize="12px" color="#5c6675">·</Text>
                  <Text as="span" fontSize="12px" color="#939dab">Abrechnung seit {periodStart}</Text>
                </>
              )}
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
        </>
      )}

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

      {/* Booking error toast */}
      {bookingError && (
        <Flex
          position="fixed"
          bottom="24px"
          left="50%"
          transform="translateX(-50%)"
          bg="#1e1316"
          border="1px solid rgba(224,83,95,0.35)"
          borderRadius="12px"
          px={4}
          py="12px"
          alignItems="center"
          gap="10px"
          minW="280px"
          boxShadow="0 8px 24px -12px rgba(0,0,0,0.55)"
          zIndex={100}
          role="alert"
        >
          <AlertCircle size={16} color="#e0535f" />
          <Text flex={1} fontSize="14px" color="#e0535f">{bookingError}</Text>
          <Box
            as="button"
            bg="none"
            border="none"
            cursor="pointer"
            color="#939dab"
            fontSize="14px"
            onClick={() => setBookingError(null)}
          >
            ✕
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

      {/* Closed-period payment notice */}
      {closedPeriodNotice && (
        <>
          <Box
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            bg="rgba(0,0,0,0.6)"
            zIndex={200}
            onClick={() => setClosedPeriodNotice(null)}
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
              Abrechnung beendet
            </Text>
            <Text fontSize="13px" color="#939dab" mb={4}>
              Abrechnung {closedPeriodNotice.range}
            </Text>
            <Box
              px={4} py="14px"
              mb={5}
              bg="#1b212b"
              borderRadius="12px"
            >
              <Text fontSize="12px" fontWeight="600" letterSpacing="0.06em" textTransform="uppercase" color="#939dab" mb="6px">
                Offener Betrag
              </Text>
              <Text fontSize="28px" fontWeight="800" color="#eaedf2" mb={closedPeriodNotice.payment_instructions ? 4 : 0}>
                {formatCents(closedPeriodNotice.total_cents)}
              </Text>
              {closedPeriodNotice.payment_instructions ? (
                <Text fontSize="13px" color="#939dab" whiteSpace="pre-wrap">
                  {closedPeriodNotice.payment_instructions}
                </Text>
              ) : (
                <Text fontSize="13px" color="#939dab">
                  {NO_PAYMENT_INSTRUCTIONS_FALLBACK}
                </Text>
              )}
            </Box>
            <Flex gap={3}>
              <Box
                as="button"
                display="flex"
                alignItems="center"
                justifyContent="center"
                flex={1}
                h="52px"
                borderRadius="12px"
                bg="#e0535f"
                color="white"
                fontSize="16px"
                fontWeight="700"
                border="none"
                cursor="pointer"
                _hover={{ bg: "#cf4a55" }}
                onClick={() => setClosedPeriodNotice(null)}
              >
                Später
              </Box>
              <Box
                as="button"
                display="flex"
                alignItems="center"
                justifyContent="center"
                flex={1}
                h="52px"
                borderRadius="12px"
                bg="#0468b3"
                color="white"
                fontSize="16px"
                fontWeight="700"
                border="none"
                cursor="pointer"
                _hover={{ bg: "#0576cc" }}
                onClick={markClosedPeriodPaid}
              >
                Ich hab bezahlt
              </Box>
            </Flex>
          </Box>
        </>
      )}

      {/* First-visit welcome — ask for the display name */}
      {welcomeOpen && (
        <>
          <Box
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            bg="rgba(0,0,0,0.65)"
            zIndex={300}
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
            zIndex={301}
          >
            <Box
              w="36px" h="4px" borderRadius="9999px"
              bg="rgba(255,255,255,0.12)"
              mx="auto" mb={5}
            />
            <Text fontSize="22px" fontWeight="800" color="#eaedf2" mb={2}>
              Willkommen in der Kabinen-Bar
            </Text>
            <Text fontSize="14px" color="#939dab" mb={5}>
              Damit ich weiß, wer du bist, gib bitte deinen Namen ein. So erscheinst du in der Spielerliste und in der Abrechnung.
            </Text>

            <Text fontSize="12px" fontWeight="600" letterSpacing="0.04em" textTransform="uppercase" color="#939dab" mb="8px">
              Dein Name
            </Text>
            <Input
              value={welcomeName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWelcomeName(e.target.value)}
              placeholder="Dein Name"
              h="52px"
              w="full"
              bg="#1b212b"
              border="1px solid rgba(255,255,255,0.12)"
              borderRadius="12px"
              px="14px"
              fontSize="16px"
              color="#eaedf2"
              outline="none"
              mb={5}
              _focus={{ borderColor: "#0468b3" }}
              _placeholder={{ color: "#5c6675" }}
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") finishWelcome(); }}
            />

            <Box
              as="button"
              display="flex"
              alignItems="center"
              justifyContent="center"
              w="full"
              h="52px"
              borderRadius="12px"
              fontSize="16px"
              fontWeight="700"
              border="none"
              cursor={welcomeName.trim() && !welcomeSaving ? "pointer" : "default"}
              bg={welcomeName.trim() && !welcomeSaving ? "#0468b3" : "#1b212b"}
              color={welcomeName.trim() && !welcomeSaving ? "white" : "#5c6675"}
              onClick={finishWelcome}
            >
              {welcomeSaving ? "Speichern…" : "Los geht's"}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
