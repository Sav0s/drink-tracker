"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, Text } from "@chakra-ui/react";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { formatCents } from "@/types";
import { createClient } from "@/lib/supabase/client";

interface PeriodRow {
  date: string;
  drink: string;
  price_cents: number;
}

interface Period {
  id: string;
  range: string;
  status: "aktiv" | "ausstehend" | "bezahlt";
  count: number;
  total_cents: number;
  rows: PeriodRow[];
}

const MOCK_PERIODS: Period[] = [
  {
    id: "1",
    range: "01.06. – 01.07.2026",
    status: "aktiv",
    count: 18,
    total_cents: 1850,
    rows: [
      { date: "12.06.", drink: "Bier 0,33l",   price_cents: 150 },
      { date: "11.06.", drink: "Cola",          price_cents: 100 },
      { date: "10.06.", drink: "Wasser",        price_cents: 50  },
    ],
  },
  {
    id: "2",
    range: "01.05. – 01.06.2026",
    status: "ausstehend",
    count: 22,
    total_cents: 2400,
    rows: [
      { date: "31.05.", drink: "Apfelschorle", price_cents: 80  },
      { date: "28.05.", drink: "Bier 0,33l",   price_cents: 150 },
    ],
  },
  {
    id: "3",
    range: "01.04. – 01.05.2026",
    status: "bezahlt",
    count: 15,
    total_cents: 1650,
    rows: [
      { date: "30.04.", drink: "Cola",          price_cents: 100 },
    ],
  },
];

const STATUS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  aktiv:      { bg: "rgba(4,104,179,0.16)",  text: "#0468b3", dot: "#0468b3", label: "Aktiv"      },
  ausstehend: { bg: "rgba(214,162,58,0.15)", text: "#d6a23a", dot: "#d6a23a", label: "Ausstehend" },
  bezahlt:    { bg: "rgba(47,169,104,0.15)", text: "#2fa968", dot: "#2fa968", label: "Bezahlt"    },
};

export default function ProfilPage() {
  const router = useRouter();
  const [player, setPlayer] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name      ||
        user.email?.split("@")[0]     ||
        "Spieler";
      setPlayer(name);
    });
  }, [router]);

  const initials      = player.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const activePeriod  = MOCK_PERIODS.find((p) => p.status === "aktiv");
  const pendingPeriods = MOCK_PERIODS.filter((p) => p.status === "ausstehend");
  const totalOwed     = (activePeriod?.total_cents ?? 0) + pendingPeriods.reduce((s, p) => s + p.total_cents, 0);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <Flex minH="100dvh" bg="#0d1014" flexDir="column">

      {/* Header */}
      <Flex
        as="header"
        alignItems="center"
        justifyContent="space-between"
        px={5}
        py="14px"
        borderBottom="1px solid rgba(255,255,255,0.07)"
      >
        <Box as="button" p="6px" cursor="pointer" bg="none" border="none" onClick={() => router.push("/home")}>
          <ChevronLeft size={20} color="#eaedf2" />
        </Box>
        <Text fontSize="17px" fontWeight="700" color="#eaedf2">Mein Konto</Text>
        <Box w="36px" />
      </Flex>

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
            <Text fontSize="13px" color="#939dab">Mitglied · 1. Mannschaft</Text>
          </Box>
        </Flex>

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
        {MOCK_PERIODS.map((period) => {
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
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Logout */}
      <Box px={5} pb={8} pt={4}>
        <Box
          as="button"
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap={2}
          w="full"
          h="52px"
          borderRadius="12px"
          bg="#e0535f"
          color="white"
          fontSize="16px"
          fontWeight="700"
          border="none"
          cursor="pointer"
          onClick={logout}
        >
          <LogOut size={16} />
          Ausloggen
        </Box>
      </Box>
    </Flex>
  );
}
