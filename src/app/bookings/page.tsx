"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, Text } from "@chakra-ui/react";
import { ChevronRight, Check, RotateCcw } from "lucide-react";
import { formatCents } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { ROUTES, PROFILE_STATUS, DEFAULT_PLAYER_NAME, type ProfileStatus } from "@/lib/constants";
import { LoadingState } from "@/components/LoadingState";
import { AppBar } from "@/components/AppBar";

interface PeriodRow {
  date: string;
  drink: string;
  price_cents: number;
}

interface Period {
  id: string;
  range: string;
  status: ProfileStatus;
  count: number;
  total_cents: number;
  rows: PeriodRow[];
}

const STATUS: Record<ProfileStatus, { bg: string; text: string; dot: string; label: string }> = {
  [PROFILE_STATUS.ACTIVE]:  { bg: "rgba(4,104,179,0.16)",  text: "#0468b3", dot: "#0468b3", label: "Aktiv"      },
  [PROFILE_STATUS.PENDING]: { bg: "rgba(214,162,58,0.15)", text: "#d6a23a", dot: "#d6a23a", label: "Ausstehend" },
  [PROFILE_STATUS.PAID]:    { bg: "rgba(47,169,104,0.15)", text: "#2fa968", dot: "#2fa968", label: "Bezahlt"    },
};

export default function ProfilePage() {
  const router = useRouter();
  const [player, setPlayer] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push(ROUTES.LOGIN);
    });

    fetch("/api/me")
      .then((r) => r.json())
      .then((me) => setPlayer(me?.name || DEFAULT_PLAYER_NAME))
      .catch(() => {});

    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => setPeriods(data.periods ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  async function setPaid(periodId: string, paid: boolean) {
    await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId, paid }),
    }).catch(() => {});
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => setPeriods(data.periods ?? []))
      .catch(() => {});
  }

  const initials      = player.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const activePeriod  = periods.find((p) => p.status === PROFILE_STATUS.ACTIVE);
  const pendingPeriods = periods.filter((p) => p.status === PROFILE_STATUS.PENDING);
  const totalOwed     = (activePeriod?.total_cents ?? 0) + pendingPeriods.reduce((s, p) => s + p.total_cents, 0);

  return (
    <Flex minH="100dvh" bg="#0d1014" flexDir="column">

      <AppBar title="Buchungen" showBack />

      <Box flex={1} overflowY="auto" px={5} pt={5}>

        {/* Profile head */}
        <Flex alignItems="center" gap={4} mb={5}>
          <Flex
            w="56px" h="56px" borderRadius="9999px"
            bg="linear-gradient(135deg, #0468b3, #0576cc)"
            alignItems="center" justifyContent="center"
            fontSize="20px" fontWeight="800" color="white"
            flexShrink={0}
          >
            {initials}
          </Flex>
          <Box>
            <Text fontSize="18px" fontWeight="700" color="#eaedf2" mb="2px">{player}</Text>
            <Text fontSize="13px" color="#939dab">Mitglied</Text>
          </Box>
        </Flex>

        {loading ? (
          <LoadingState minH="280px" />
        ) : (
          <>
        {/* Balance card */}
        <Box
          p={5}
          borderRadius="16px"
          bg="rgba(4,104,179,0.12)"
          border="1px solid rgba(4,104,179,0.3)"
          mb={6}
        >
          <Text
            fontSize="11px" fontWeight="700" letterSpacing="0.1em"
            textTransform="uppercase" color="#939dab" mb="6px"
          >
            Du schuldest gesamt
          </Text>
          <Text fontSize="34px" fontWeight="800" letterSpacing="-1px" color="#eaedf2" mb={3}>
            {formatCents(totalOwed)}
          </Text>
          <Flex gap={4} flexWrap="wrap">
            {activePeriod && (
              <Flex as="span" alignItems="center" gap="6px" fontSize="13px" color="#939dab">
                <Text as="span" color="#0468b3">●</Text>
                {formatCents(activePeriod.total_cents)} laufend
              </Flex>
            )}
            {pendingPeriods.length > 0 && (
              <Flex as="span" alignItems="center" gap="6px" fontSize="13px" color="#939dab">
                <Text as="span" color="#d6a23a">●</Text>
                {formatCents(pendingPeriods.reduce((s, p) => s + p.total_cents, 0))} ausstehend
              </Flex>
            )}
          </Flex>
        </Box>

        {/* Section label */}
        <Text
          fontSize="11px" fontWeight="700" letterSpacing="0.1em"
          textTransform="uppercase" color="#5c6675" mb="10px"
        >
          Abrechnungen
        </Text>

        {/* Period rows */}
        {periods.map((period) => {
          const st     = STATUS[period.status];
          const isOpen = openId === period.id;
          return (
            <Box
              key={period.id}
              bg="#151a21"
              border="1px solid rgba(255,255,255,0.07)"
              borderRadius="12px"
              mb="6px"
              overflow="hidden"
            >
              <Flex
                as="button"
                w="full"
                alignItems="center"
                gap={2}
                px="14px"
                py={3}
                cursor="pointer"
                bg="none"
                border="none"
                onClick={() => setOpenId(isOpen ? null : period.id)}
              >
                {/* Animated chevron */}
                <Box
                  display="inline-flex"
                  transform={isOpen ? "rotate(90deg)" : "rotate(0deg)"}
                  transition="transform 0.15s"
                >
                  <ChevronRight size={16} color="#5c6675" />
                </Box>

                <Text
                  as="span" fontSize="14px" fontWeight="500" color="#eaedf2"
                  flex={1} textAlign="left" minW={0} overflow="hidden"
                  textOverflow="ellipsis" whiteSpace="nowrap"
                >
                  {period.range}
                </Text>

                {/* Status badge */}
                <Flex
                  as="span"
                  display="inline-flex"
                  alignItems="center"
                  gap={1}
                  bg={st.bg}
                  color={st.text}
                  borderRadius="9999px"
                  px={2}
                  py="2px"
                  fontSize="11px"
                  fontWeight="600"
                  flexShrink={0}
                >
                  <Text as="span" fontSize="8px" color={st.dot}>●</Text>
                  {st.label}
                </Flex>

                <Text as="span" fontSize="12px" color="#5c6675" flexShrink={0}>
                  · {period.count}
                </Text>
                <Text
                  as="span" fontSize="14px" fontWeight="600" color="#eaedf2"
                  flexShrink={0} w="64px" textAlign="right"
                >
                  {formatCents(period.total_cents)}
                </Text>
              </Flex>

              {isOpen && (
                <Box px="14px" pb={3}>
                  {period.rows.map((row, i) => (
                    <Flex
                      key={i}
                      alignItems="center"
                      gap="10px"
                      py={2}
                      borderTop="1px solid rgba(255,255,255,0.05)"
                    >
                      <Text as="span" fontSize="12px" color="#5c6675" w="40px">{row.date}</Text>
                      <Text as="span" fontSize="13px" color="#eaedf2" flex={1}>{row.drink}</Text>
                      <Text as="span" fontSize="13px" color="#939dab">{formatCents(row.price_cents)}</Text>
                    </Flex>
                  ))}

                  {/* Payment toolbar (not for the still-running period) */}
                  {period.status !== PROFILE_STATUS.ACTIVE && (
                    <Flex
                      alignItems="center"
                      justifyContent="space-between"
                      gap={3}
                      pt={3}
                      mt={1}
                      borderTop="1px solid rgba(255,255,255,0.1)"
                    >
                      {period.status === PROFILE_STATUS.PAID ? (
                        <>
                          <Flex as="span" alignItems="center" gap="6px" fontSize="13px" color="#2fa968">
                            <Check size={15} /> Als bezahlt markiert
                          </Flex>
                          <Box
                            as="button"
                            display="flex"
                            alignItems="center"
                            gap="6px"
                            bg="none"
                            border="1px solid rgba(255,255,255,0.14)"
                            borderRadius="9px"
                            px={3}
                            py="7px"
                            fontSize="13px"
                            fontWeight="600"
                            color="#939dab"
                            cursor="pointer"
                            _hover={{ color: "#eaedf2", borderColor: "rgba(255,255,255,0.28)" }}
                            onClick={() => setPaid(period.id, false)}
                          >
                            <RotateCcw size={14} /> Zurücksetzen
                          </Box>
                        </>
                      ) : (
                        <>
                          <Text as="span" fontSize="13px" color="#d6a23a">Noch offen</Text>
                          <Box
                            as="button"
                            display="flex"
                            alignItems="center"
                            gap="6px"
                            bg="#0468b3"
                            border="none"
                            borderRadius="9px"
                            px={4}
                            py="8px"
                            fontSize="13px"
                            fontWeight="700"
                            color="white"
                            cursor="pointer"
                            _hover={{ bg: "#0576cc" }}
                            onClick={() => setPaid(period.id, true)}
                          >
                            <Check size={15} /> Ich hab bezahlt
                          </Box>
                        </>
                      )}
                    </Flex>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
          </>
        )}
      </Box>
    </Flex>
  );
}
