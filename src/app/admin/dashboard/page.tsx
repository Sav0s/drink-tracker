"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Flex, Text, Input, Textarea } from "@chakra-ui/react";
import { Plus, Pencil, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { formatCents } from "@/types";
import { ROUTES, PERIOD_STATUS, type PeriodStatus } from "@/lib/constants";
import { LoadingState } from "@/components/LoadingState";
import { AppBar } from "@/components/AppBar";

interface DrinkRow {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
}

interface MemberRow {
  id: string;
  name: string;
  count: number;
  total_cents: number;
  paid: boolean;
  items: { drink: string; count: number; price_cents: number }[];
}

interface PeriodRow {
  id: string;
  range: string;
  status: PeriodStatus;
  paymentInstructions: string | null;
  startDate: string;
  endDate: string | null;
}

/* ─── Toggle ─── */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box
      as="button"
      position="relative"
      w="42px"
      h="24px"
      borderRadius="9999px"
      border={`1px solid ${on ? "#2fa968" : "rgba(255,255,255,0.12)"}`}
      bg={on ? "rgba(47,169,104,0.15)" : "#222a36"}
      cursor="pointer"
      transition="all 0.2s"
      onClick={() => onChange(!on)}
    >
      <Box
        position="absolute"
        top="3px"
        left={on ? "21px" : "3px"}
        w="18px"
        h="18px"
        borderRadius="9999px"
        bg={on ? "#2fa968" : "#5a6473"}
        transition="all 0.15s"
      />
    </Box>
  );
}

/* ─── Input helper ─── */
function FieldInput({
  placeholder, value, onChange, type = "text",
}: {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <Input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      w="full"
      bg="#1a202a"
      border="1px solid rgba(255,255,255,0.12)"
      borderRadius="8px"
      px="12px"
      py="8px"
      fontSize="14px"
      color="#eaedf2"
      outline="none"
    />
  );
}

/* ─── Dashboard ─── */
export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<LoadingState color="#6478a0" />}>
      <AdminDashboardContent />
    </Suspense>
  );
}

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Tab lives in the URL (?tab=billing) instead of local state, so a reload
  // or shared link lands back on the same tab instead of always resetting
  // to "Getränke verwalten".
  const tab: "drinks" | "billing" = searchParams.get("tab") === "billing" ? "billing" : "drinks";
  function setTab(next: "drinks" | "billing") {
    const params = new URLSearchParams(searchParams);
    if (next === "drinks") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${ROUTES.ADMIN_DASHBOARD}?${query}` : ROUTES.ADMIN_DASHBOARD, { scroll: false });
  }
  const [drinks,     setDrinks]     = useState<DrinkRow[]>([]);
  const [newName,    setNewName]    = useState("");
  const [newPrice,   setNewPrice]   = useState("");
  const [newActive,  setNewActive]  = useState(true);
  const [members,    setMembers]    = useState<MemberRow[]>([]);
  const [periods,    setPeriods]    = useState<PeriodRow[]>([]);
  const [selPeriod,  setSelPeriod]  = useState(0);
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [showNew,    setShowNew]    = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const periodPickerRef = useRef<HTMLDivElement>(null);
  const [drinksLoaded,  setDrinksLoaded]  = useState(false);
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [membersLoading, setMembersLoading] = useState(true);

  // Date inputs
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [payNote,   setPayNote]   = useState("");

  // Edit-drink modal
  const [editDrink,  setEditDrink]  = useState<DrinkRow | null>(null);
  const [editName,   setEditName]   = useState("");
  const [editPrice,  setEditPrice]  = useState("");
  const [editActive, setEditActive] = useState(true);

  // Edit-period modal
  const [editPeriodOpen,  setEditPeriodOpen]  = useState(false);
  const [editPeriodStart, setEditPeriodStart] = useState("");
  const [editPeriodEnd,   setEditPeriodEnd]   = useState("");
  const [editPeriodNote,  setEditPeriodNote]  = useState("");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showActiveExists, setShowActiveExists] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((player) => {
        if (!player.isAdmin) router.push(ROUTES.HOME);
      })
      .catch(() => router.push(ROUTES.LOGIN));

    reloadDrinks();
    reloadPeriods();
  }, [router]);

  function reloadDrinks() {
    fetch("/api/admin/drinks")
      .then((r) => r.json())
      .then((data) => setDrinks(data.drinks ?? []))
      .catch(() => {})
      .finally(() => setDrinksLoaded(true));
  }

  function reloadPeriods() {
    fetch("/api/admin/billing-periods")
      .then((r) => r.json())
      .then((data) => setPeriods(data.periods ?? []))
      .catch(() => {})
      .finally(() => setPeriodsLoaded(true));
  }

  useEffect(() => {
    if (!periodsLoaded) return;
    const period = periods[selPeriod];
    async function load() {
      if (!period) { setMembers([]); setMembersLoading(false); return; }
      setMembersLoading(true);
      try {
        const r = await fetch(`/api/admin/billing-periods/${period.id}/members`);
        const data = await r.json();
        setMembers(data.members ?? []);
      } catch {}
      setMembersLoading(false);
    }
    load();
  }, [periods, selPeriod, periodsLoaded]);

  // Close the period-picker dropdown on any click outside of it.
  useEffect(() => {
    if (!periodOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (!periodPickerRef.current?.contains(e.target as Node)) {
        setPeriodOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [periodOpen]);

  function toggleDrink(id: string, active: boolean) {
    setDrinks((prev) => prev.map((d) => (d.id === id ? { ...d, active } : d)));
    fetch(`/api/admin/drinks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    }).catch(() => {});
  }

  function addDrink() {
    if (!newName || !newPrice) return;
    const price = Math.round(parseFloat(newPrice.replace(",", ".")) * 100);
    fetch("/api/admin/drinks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, price_cents: price, active: newActive }),
    })
      .then(() => reloadDrinks())
      .catch(() => {});
    setNewName(""); setNewPrice(""); setNewActive(true);
  }

  function openEdit(d: DrinkRow) {
    setEditDrink(d);
    setEditName(d.name);
    setEditPrice((d.price_cents / 100).toFixed(2).replace(".", ","));
    setEditActive(d.active);
  }

  function saveEdit() {
    if (!editDrink) return;
    const price = Math.round(parseFloat(editPrice.replace(",", ".")) * 100);
    if (!editName.trim() || Number.isNaN(price)) return;
    fetch(`/api/admin/drinks/${editDrink.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), price_cents: price, active: editActive }),
    })
      .then(() => reloadDrinks())
      .catch(() => {});
    setEditDrink(null);
  }

  function activePeriod() {
    return periods.find((p) => p.status === PERIOD_STATUS.ACTIVE) ?? null;
  }

  function openNewPeriod() {
    if (!showNew) {
      if (activePeriod()) {
        setShowActiveExists(true);
        return;
      }
      // When opening the form, default the payment instructions to the most recent
      // period that has them (so the admin doesn't retype them every time).
      if (!payNote) {
        const last = periods.find((p) => p.paymentInstructions);
        if (last?.paymentInstructions) setPayNote(last.paymentInstructions);
      }
    }
    setShowNew((v) => !v);
  }

  function createPeriod() {
    if (!startDate) return;
    fetch("/api/admin/billing-periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate,
        endDate: endDate || null,
        paymentInstructions: payNote || null,
      }),
    })
      .then(() => {
        reloadPeriods();
        setSelPeriod(0);
        setShowNew(false);
        setStartDate(""); setEndDate(""); setPayNote("");
      })
      .catch(() => {});
  }

  function openEditPeriod() {
    const period = activePeriod();
    if (!period) return;
    setEditPeriodStart(period.startDate);
    setEditPeriodEnd(period.endDate ?? "");
    setEditPeriodNote(period.paymentInstructions ?? "");
    setEditPeriodOpen(true);
  }

  function saveEditPeriod() {
    const period = activePeriod();
    if (!period || !editPeriodStart) return;
    fetch(`/api/admin/billing-periods/${period.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: editPeriodStart,
        endDate: editPeriodEnd || null,
        paymentInstructions: editPeriodNote || null,
      }),
    })
      .then(() => reloadPeriods())
      .catch(() => {});
    setEditPeriodOpen(false);
  }

  function closeActivePeriod() {
    const period = activePeriod();
    if (!period) return;
    fetch(`/api/admin/billing-periods/${period.id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate: editPeriodEnd || null }),
    })
      .then(() => {
        reloadPeriods();
        setSelPeriod(0);
      })
      .catch(() => {});
    setShowCloseConfirm(false);
    setEditPeriodOpen(false);
  }

  function markPaid(id: string, paid: boolean) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, paid } : m)));
    const period = periods[selPeriod];
    if (!period) return;
    fetch("/api/admin/payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: id, periodId: period.id, paid }),
    }).catch(() => {});
  }

  const paid     = members.filter((m) =>  m.paid).length;
  const offen    = members.filter((m) => !m.paid).length;
  const sumOffen = members.filter((m) => !m.paid).reduce((s, m) => s + m.total_cents, 0);
  const gesamt   = members.reduce((s, m) => s + m.total_cents, 0);

  return (
    <Box minH="100dvh" bg="#0b0e13" color="#eaedf2">

      {/* Topbar */}
      <AppBar subtitle="Admin Console" />

      {/* Tabs */}
      <Flex borderBottom="1px solid rgba(255,255,255,0.07)" px={7}>
        {(["drinks", "billing"] as const).map((t) => (
          <Box
            key={t}
            as="button"
            py={3}
            mr={7}
            fontSize="15px"
            fontWeight="500"
            bg="transparent"
            borderTopWidth="0"
            borderLeftWidth="0"
            borderRightWidth="0"
            borderBottomWidth="2px"
            borderBottomStyle="solid"
            borderBottomColor={tab === t ? "#6478a0" : "transparent"}
            color={tab === t ? "#6478a0" : "#5a6473"}
            cursor="pointer"
            outline="none"
            transition="color 0.15s, border-color 0.15s"
            onClick={() => setTab(t)}
          >
            {t === "drinks" ? "Getränke verwalten" : "Abrechnung"}
          </Box>
        ))}
      </Flex>

      <Box px={7} py={6} maxW="960px" mx="auto">

        {/* ─── Tab A: Getränke ─── */}
        {tab === "drinks" && (
          <Box>
            <Text fontSize="19px" fontWeight="700" mb={1}>Getränke verwalten</Text>
            <Text fontSize="13px" color="#939dab" mb={4}>
              {drinks.length} Getränke · {drinks.filter((d) => d.active).length} aktiv · {drinks.filter((d) => !d.active).length} inaktiv
            </Text>

            {!drinksLoaded ? (
              <LoadingState color="#6478a0" />
            ) : (
            <Box bg="#141921" borderRadius="12px" overflow="hidden" border="1px solid rgba(255,255,255,0.07)">
              {/* Header */}
              <Flex px={4} py="10px" borderBottom="1px solid rgba(255,255,255,0.07)">
                {(
                  [
                    { label: "Name",   w: undefined },
                    { label: "Preis",  w: "80px"    },
                    { label: "Status", w: "140px"   },
                    { label: "Aktion", w: "60px"    },
                  ] as const
                ).map(({ label, w }) => (
                  <Text
                    key={label}
                    flex={w ? undefined : 1}
                    w={w}
                    fontSize="11px"
                    fontWeight="700"
                    letterSpacing="0.1em"
                    textTransform="uppercase"
                    color="#5a6473"
                  >
                    {label}
                  </Text>
                ))}
              </Flex>

              {/* Rows */}
              {drinks.map((d) => (
                <Flex
                  key={d.id}
                  alignItems="center"
                  px={4} py={3}
                  borderBottom="1px solid rgba(255,255,255,0.05)"
                  opacity={d.active ? 1 : 0.45}
                >
                  <Text flex={1} fontSize="14px" color="#eaedf2">{d.name}</Text>
                  <Text w="80px" fontSize="14px" color="#eaedf2">{formatCents(d.price_cents)}</Text>
                  <Flex w="140px" alignItems="center" gap={2}>
                    <Toggle on={d.active} onChange={(v) => toggleDrink(d.id, v)} />
                    <Text fontSize="13px" color={d.active ? "#2fa968" : "#5a6473"}>
                      {d.active ? "Aktiv" : "Inaktiv"}
                    </Text>
                  </Flex>
                  <Box w="60px">
                    <Box as="button" p={1} cursor="pointer" bg="none" border="none" onClick={() => openEdit(d)}>
                      <Pencil size={14} color="#6478a0" />
                    </Box>
                  </Box>
                </Flex>
              ))}

              {/* Add row */}
              <Flex alignItems="center" px={4} py={3} gap={3}>
                <Box flex={1}>
                  <FieldInput placeholder="Name" value={newName} onChange={setNewName} />
                </Box>
                <Box w="80px">
                  <FieldInput placeholder="1,50" value={newPrice} onChange={setNewPrice} />
                </Box>
                <Box w="140px">
                  <Toggle on={newActive} onChange={setNewActive} />
                </Box>
                <Box w="60px">
                  <Box
                    as="button"
                    bg="#6478a0"
                    color="white"
                    border="none"
                    borderRadius="8px"
                    px="14px"
                    py="8px"
                    fontSize="13px"
                    fontWeight="600"
                    cursor="pointer"
                    onClick={addDrink}
                  >
                    +
                  </Box>
                </Box>
              </Flex>
            </Box>
            )}
          </Box>
        )}

        {/* ─── Tab B: Abrechnung ─── */}
        {tab === "billing" && (
          <Box>
            {!periodsLoaded ? (
              <LoadingState color="#6478a0" />
            ) : (
            <>
            {/* Toolbar */}
            <Flex alignItems="center" gap={3} mb={4} flexWrap="wrap">

              {/* Period picker */}
              <Box position="relative" ref={periodPickerRef}>
                {periods.length === 0 ? (
                  <Flex
                    as="button"
                    alignItems="center"
                    gap="6px"
                    bg="#141921"
                    border="1px solid rgba(255,255,255,0.12)"
                    borderRadius="12px"
                    px="14px"
                    py={2}
                    cursor="pointer"
                    fontSize="14px"
                    color="#eaedf2"
                    onClick={openNewPeriod}
                  >
                    <Plus size={14} />
                    Neue Abrechnung
                  </Flex>
                ) : (
                <Flex
                  as="button"
                  alignItems="center"
                  gap={2}
                  bg="#141921"
                  border="1px solid rgba(255,255,255,0.12)"
                  borderRadius="12px"
                  px="14px"
                  py={2}
                  cursor="pointer"
                  fontSize="14px"
                  color="#eaedf2"
                  onClick={() => setPeriodOpen(!periodOpen)}
                >
                  <Text as="span">{periods[selPeriod]?.range ?? "–"}</Text>
                  <Text
                    as="span"
                    borderRadius="9999px"
                    px={2}
                    py="2px"
                    fontSize="11px"
                    fontWeight="600"
                    bg={periods[selPeriod]?.status === PERIOD_STATUS.ACTIVE ? "rgba(4,104,179,0.16)" : "rgba(100,120,160,0.16)"}
                    color={periods[selPeriod]?.status === PERIOD_STATUS.ACTIVE ? "#0468b3" : "#6478a0"}
                  >
                    {periods[selPeriod]?.status === PERIOD_STATUS.ACTIVE ? "Aktiv" : "Abgeschlossen"}
                  </Text>
                  <ChevronDown size={16} color="#5a6473" />
                </Flex>
                )}

                {periodOpen && (
                  <Box
                    position="absolute"
                    top="calc(100% + 6px)"
                    left={0}
                    zIndex={50}
                    bg="#1a202a"
                    border="1px solid rgba(255,255,255,0.12)"
                    borderRadius="12px"
                    overflow="hidden"
                    minW="220px"
                  >
                    {periods.map((p, i) => (
                      <Box
                        key={p.id}
                        as="button"
                        display="block"
                        w="full"
                        textAlign="left"
                        px="14px"
                        py="10px"
                        fontSize="14px"
                        color="#eaedf2"
                        bg="none"
                        border="none"
                        cursor="pointer"
                        _hover={{ bg: "rgba(255,255,255,0.05)" }}
                        onClick={() => { setSelPeriod(i); setPeriodOpen(false); }}
                      >
                        {p.range}
                      </Box>
                    ))}
                    <Flex
                      as="button"
                      alignItems="center"
                      gap="6px"
                      w="full"
                      textAlign="left"
                      px="14px"
                      py="10px"
                      fontSize="14px"
                      color="#eaedf2"
                      bg="none"
                      border="none"
                      borderTop="1px solid rgba(255,255,255,0.12)"
                      cursor="pointer"
                      _hover={{ bg: "rgba(255,255,255,0.05)" }}
                      onClick={() => { setPeriodOpen(false); openNewPeriod(); }}
                    >
                      <Plus size={14} />
                      Neue Abrechnung
                    </Flex>
                  </Box>
                )}
              </Box>

              {activePeriod() && (
                <Flex
                  as="button"
                  alignItems="center"
                  gap="6px"
                  bg="none"
                  border="1px solid rgba(255,255,255,0.12)"
                  borderRadius="12px"
                  px="14px"
                  py={2}
                  fontSize="14px"
                  color="#eaedf2"
                  cursor="pointer"
                  onClick={openEditPeriod}
                >
                  <Pencil size={14} />
                  Bearbeiten
                </Flex>
              )}
            </Flex>

            {/* New period form */}
            {showNew && (
              <Box
                bg="#141921"
                border="1px solid rgba(255,255,255,0.07)"
                borderRadius="12px"
                p={4}
                mb={4}
              >
                <Flex gap={3} mb={3}>
                  <Box flex={1}>
                    <Text
                      fontSize="11px" fontWeight="700" letterSpacing="0.1em"
                      textTransform="uppercase" color="#5a6473" mb="6px"
                    >
                      Startdatum
                    </Text>
                    <FieldInput type="date" value={startDate} onChange={setStartDate} />
                  </Box>
                  <Box flex={1}>
                    <Text
                      fontSize="11px" fontWeight="700" letterSpacing="0.1em"
                      textTransform="uppercase" color="#5a6473" mb="6px"
                    >
                      Enddatum
                    </Text>
                    <FieldInput type="date" value={endDate} onChange={setEndDate} />
                  </Box>
                </Flex>
                <Text
                  fontSize="11px" fontWeight="700" letterSpacing="0.1em"
                  textTransform="uppercase" color="#5a6473" mb="6px"
                >
                  Zahlungshinweise
                </Text>
                <Textarea
                  rows={3}
                  placeholder="IBAN, PayPal, Empfänger…"
                  value={payNote}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPayNote(e.target.value)}
                  w="full"
                  bg="#1a202a"
                  border="1px solid rgba(255,255,255,0.12)"
                  borderRadius="8px"
                  px="12px"
                  py="10px"
                  fontSize="14px"
                  color="#eaedf2"
                  outline="none"
                  resize="vertical"
                />
                <Flex justifyContent="flex-end" gap={2} mt={3}>
                  <Box
                    as="button"
                    bg="none"
                    border="1px solid rgba(255,255,255,0.12)"
                    borderRadius="8px"
                    px={4}
                    py={2}
                    color="#939dab"
                    fontSize="14px"
                    cursor="pointer"
                    onClick={() => setShowNew(false)}
                  >
                    Abbrechen
                  </Box>
                  <Box
                    as="button"
                    bg="#6478a0"
                    border="none"
                    borderRadius="8px"
                    px={4}
                    py={2}
                    color="white"
                    fontSize="14px"
                    fontWeight="600"
                    cursor="pointer"
                    onClick={createPeriod}
                  >
                    Abrechnung erstellen
                  </Box>
                </Flex>
              </Box>
            )}

            {/* Summary bar */}
            <Flex
              bg="#141921"
              border="1px solid rgba(255,255,255,0.07)"
              borderRadius="12px"
              overflow="hidden"
              mb={4}
            >
              {[
                { label: "Mitglieder",  value: members.length.toString() },
                { label: "Getränke",    value: members.reduce((s, m) => s + m.count, 0).toString() },
                { label: "Bezahlt",     value: paid.toString(),       color: "#2fa968" },
                { label: "Offen",       value: offen.toString(),      color: "#d6a23a" },
                { label: "Summe offen", value: formatCents(sumOffen), color: "#d6a23a" },
                { label: "Gesamt",      value: formatCents(gesamt) },
              ].map((item) => (
                <Box
                  key={item.label}
                  flex={1}
                  px={4}
                  py={3}
                  borderRight="1px solid rgba(255,255,255,0.07)"
                  _last={{ borderRight: "none" }}
                >
                  <Text fontSize="11px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color="#5a6473" mb={1}>
                    {item.label}
                  </Text>
                  <Text fontSize="18px" fontWeight="700" color={item.color ?? "#eaedf2"}>
                    {item.value}
                  </Text>
                </Box>
              ))}
            </Flex>

            {/* Member list */}
            {membersLoading ? (
              <LoadingState color="#6478a0" minH="200px" />
            ) : (
            members.map((m) => {
              const initials = m.name.split(" ").map((w) => w[0]).join("").slice(0, 2);
              const isOpen   = openMember === m.id;
              return (
                <Box
                  key={m.id}
                  bg="#141921"
                  border="1px solid rgba(255,255,255,0.07)"
                  borderRadius="12px"
                  mb="6px"
                  overflow="hidden"
                >
                  <Flex alignItems="center" gap="10px" px={4} py={3}>
                    {/* Chevron */}
                    <Box
                      as="button"
                      bg="none"
                      border="none"
                      cursor="pointer"
                      p={0}
                      display="inline-flex"
                      onClick={() => setOpenMember(isOpen ? null : m.id)}
                    >
                      <Box
                        display="inline-flex"
                        transform={isOpen ? "rotate(90deg)" : "rotate(0deg)"}
                        transition="transform 0.15s"
                      >
                        <ChevronRight size={16} color="#5c6675" />
                      </Box>
                    </Box>

                    {/* Avatar */}
                    <Flex
                      w="32px" h="32px" borderRadius="9999px" bg="#222a36"
                      alignItems="center" justifyContent="center"
                      fontSize="12px" fontWeight="700" color="#6478a0"
                      flexShrink={0}
                    >
                      {initials}
                    </Flex>

                    <Text flex={1} fontSize="14px" fontWeight="500">{m.name}</Text>
                    <Text fontSize="14px" color="#939dab" w="64px">{m.count} Stk.</Text>
                    <Text fontSize="14px" fontWeight="600" w="72px">{formatCents(m.total_cents)}</Text>

                    {/* Status badge */}
                    <Flex
                      as="span"
                      display="inline-flex"
                      alignItems="center"
                      borderRadius="9999px"
                      px="10px"
                      py="2px"
                      fontSize="11px"
                      fontWeight="600"
                      w="72px"
                      justifyContent="center"
                      bg={m.paid ? "rgba(47,169,104,0.15)" : "rgba(214,162,58,0.15)"}
                      color={m.paid ? "#2fa968" : "#d6a23a"}
                    >
                      {m.paid ? "Bezahlt" : "Offen"}
                    </Flex>

                    {/* Action */}
                    {m.paid ? (
                      <Box as="button" p={1} cursor="pointer" bg="none" border="none" onClick={() => markPaid(m.id, false)}>
                        <RotateCcw size={14} color="#5a6473" />
                      </Box>
                    ) : (
                      <Box
                        as="button"
                        bg="none"
                        border="1px solid rgba(255,255,255,0.12)"
                        borderRadius="8px"
                        px={3}
                        py="6px"
                        fontSize="13px"
                        color="#eaedf2"
                        cursor="pointer"
                        whiteSpace="nowrap"
                        onClick={() => markPaid(m.id, true)}
                      >
                        Als bezahlt
                      </Box>
                    )}
                  </Flex>

                  {/* Detail rows */}
                  {isOpen && (
                    <Box px={4} pb={3} pl="58px">
                      <Text
                        fontSize="11px" fontWeight="700" letterSpacing="0.1em"
                        textTransform="uppercase" color="#5a6473" mb="10px"
                      >
                        Getrunken in diesem Zeitraum
                      </Text>
                      {m.items.map((item, i) => (
                        <Flex
                          key={i}
                          alignItems="center"
                          justifyContent="space-between"
                          py="6px"
                          borderBottom="1px solid rgba(255,255,255,0.05)"
                        >
                          <Text fontSize="14px">{item.count} × {item.drink}</Text>
                          <Text fontSize="13px" color="#939dab">{formatCents(item.price_cents)} / Stk.</Text>
                          <Text fontSize="14px" fontWeight="600">{formatCents(item.count * item.price_cents)}</Text>
                        </Flex>
                      ))}
                      <Flex
                        alignItems="center"
                        justifyContent="space-between"
                        py={2}
                        borderTop="1px solid rgba(255,255,255,0.12)"
                        mt={1}
                      >
                        <Text fontSize="14px" fontWeight="700">Summe</Text>
                        <Box />
                        <Text fontSize="14px" fontWeight="700">{formatCents(m.total_cents)}</Text>
                      </Flex>
                    </Box>
                  )}
                </Box>
              );
            })
            )}
            </>
            )}
          </Box>
        )}
      </Box>

      {/* Edit-drink modal */}
      {editDrink && (
        <>
          <Box
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            bg="rgba(0,0,0,0.65)"
            zIndex={200}
            onClick={() => setEditDrink(null)}
          />
          <Flex
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            alignItems="center"
            justifyContent="center"
            px={5}
            zIndex={201}
          >
            <Box
              w="full"
              maxW="380px"
              bg="#141921"
              border="1px solid rgba(255,255,255,0.1)"
              borderRadius="16px"
              p={5}
              boxShadow="0 16px 40px -12px rgba(0,0,0,0.7)"
            >
              <Text fontSize="17px" fontWeight="700" color="#eaedf2" mb={4}>
                Getränk bearbeiten
              </Text>

              <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="#5a6473" mb="6px">
                Name
              </Text>
              <Box mb={4}>
                <FieldInput placeholder="Name" value={editName} onChange={setEditName} />
              </Box>

              <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="#5a6473" mb="6px">
                Preis (€)
              </Text>
              <Box mb={4}>
                <FieldInput placeholder="1,50" value={editPrice} onChange={setEditPrice} />
              </Box>

              <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="#5a6473" mb="6px">
                Status
              </Text>
              <Flex alignItems="center" gap={2} mb={6}>
                <Toggle on={editActive} onChange={setEditActive} />
                <Text fontSize="13px" color={editActive ? "#2fa968" : "#5a6473"}>
                  {editActive ? "Aktiv" : "Inaktiv"}
                </Text>
              </Flex>

              <Flex gap={3} justifyContent="flex-end">
                <Box
                  as="button"
                  h="42px"
                  px={5}
                  borderRadius="10px"
                  fontSize="14px"
                  fontWeight="700"
                  bg="transparent"
                  color="#939dab"
                  border="1px solid rgba(255,255,255,0.16)"
                  cursor="pointer"
                  onClick={() => setEditDrink(null)}
                >
                  Abbrechen
                </Box>
                <Box
                  as="button"
                  h="42px"
                  px={5}
                  borderRadius="10px"
                  fontSize="14px"
                  fontWeight="700"
                  bg="#6478a0"
                  color="white"
                  border="none"
                  cursor="pointer"
                  onClick={saveEdit}
                >
                  Speichern
                </Box>
              </Flex>
            </Box>
          </Flex>
        </>
      )}

      {/* Edit-period modal */}
      {editPeriodOpen && (
        <>
          <Box
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            bg="rgba(0,0,0,0.65)"
            zIndex={200}
            onClick={() => setEditPeriodOpen(false)}
          />
          <Flex
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            alignItems="center"
            justifyContent="center"
            px={5}
            zIndex={201}
          >
            <Box
              w="full"
              maxW="380px"
              bg="#141921"
              border="1px solid rgba(255,255,255,0.1)"
              borderRadius="16px"
              p={5}
              boxShadow="0 16px 40px -12px rgba(0,0,0,0.7)"
            >
              <Text fontSize="17px" fontWeight="700" color="#eaedf2" mb={4}>
                Abrechnung bearbeiten
              </Text>

              <Flex gap={3} mb={4}>
                <Box flex={1}>
                  <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="#5a6473" mb="6px">
                    Startdatum
                  </Text>
                  <FieldInput type="date" value={editPeriodStart} onChange={setEditPeriodStart} />
                </Box>
                <Box flex={1}>
                  <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="#5a6473" mb="6px">
                    Enddatum
                  </Text>
                  <FieldInput type="date" value={editPeriodEnd} onChange={setEditPeriodEnd} />
                </Box>
              </Flex>

              <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="#5a6473" mb="6px">
                Zahlungshinweise
              </Text>
              <Textarea
                rows={3}
                placeholder="IBAN, PayPal, Empfänger…"
                value={editPeriodNote}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditPeriodNote(e.target.value)}
                w="full"
                bg="#1a202a"
                border="1px solid rgba(255,255,255,0.12)"
                borderRadius="8px"
                px="12px"
                py="10px"
                fontSize="14px"
                color="#eaedf2"
                outline="none"
                resize="vertical"
                mb={5}
              />

              <Box
                as="button"
                w="full"
                h="42px"
                borderRadius="10px"
                fontSize="14px"
                fontWeight="700"
                bg="rgba(224,83,95,0.12)"
                color="#e0535f"
                border="1px solid rgba(224,83,95,0.3)"
                cursor="pointer"
                mb={5}
                onClick={() => setShowCloseConfirm(true)}
              >
                Als abgeschlossen markieren
              </Box>

              <Flex gap={3} justifyContent="flex-end">
                <Box
                  as="button"
                  h="42px"
                  px={5}
                  borderRadius="10px"
                  fontSize="14px"
                  fontWeight="700"
                  bg="transparent"
                  color="#939dab"
                  border="1px solid rgba(255,255,255,0.16)"
                  cursor="pointer"
                  onClick={() => setEditPeriodOpen(false)}
                >
                  Abbrechen
                </Box>
                <Box
                  as="button"
                  h="42px"
                  px={5}
                  borderRadius="10px"
                  fontSize="14px"
                  fontWeight="700"
                  bg="#6478a0"
                  color="white"
                  border="none"
                  cursor="pointer"
                  onClick={saveEditPeriod}
                >
                  Speichern
                </Box>
              </Flex>
            </Box>
          </Flex>
        </>
      )}

      {/* Close-period confirmation modal */}
      {showCloseConfirm && (
        <>
          <Box
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            bg="rgba(0,0,0,0.6)"
            zIndex={300}
            onClick={() => setShowCloseConfirm(false)}
          />
          <Flex
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            alignItems="center"
            justifyContent="center"
            px={6}
            zIndex={301}
          >
            <Box
              w="full"
              maxW="340px"
              bg="#151a21"
              border="1px solid rgba(255,255,255,0.09)"
              borderRadius="16px"
              p={5}
              boxShadow="0 16px 40px -12px rgba(0,0,0,0.7)"
            >
              <Text fontSize="17px" fontWeight="700" color="#eaedf2" mb={2}>
                Abrechnung abschließen
              </Text>
              <Text fontSize="14px" color="#939dab" mb={5}>
                Diese Abrechnung wird abgeschlossen und kann nicht mehr bearbeitet werden. Fortfahren?
              </Text>
              <Flex gap={3}>
                <Box
                  as="button"
                  flex={1}
                  h="46px"
                  borderRadius="10px"
                  fontSize="15px"
                  fontWeight="700"
                  bg="#1b212b"
                  color="#eaedf2"
                  border="1px solid rgba(255,255,255,0.16)"
                  cursor="pointer"
                  onClick={() => setShowCloseConfirm(false)}
                >
                  Abbrechen
                </Box>
                <Box
                  as="button"
                  flex={1}
                  h="46px"
                  borderRadius="10px"
                  fontSize="15px"
                  fontWeight="700"
                  bg="#e0535f"
                  color="white"
                  border="none"
                  cursor="pointer"
                  onClick={closeActivePeriod}
                >
                  Abschließen
                </Box>
              </Flex>
            </Box>
          </Flex>
        </>
      )}

      {/* Active-period-exists info modal */}
      {showActiveExists && (
        <>
          <Box
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            bg="rgba(0,0,0,0.6)"
            zIndex={300}
            onClick={() => setShowActiveExists(false)}
          />
          <Flex
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            alignItems="center"
            justifyContent="center"
            px={6}
            zIndex={301}
          >
            <Box
              w="full"
              maxW="340px"
              bg="#151a21"
              border="1px solid rgba(255,255,255,0.09)"
              borderRadius="16px"
              p={5}
              boxShadow="0 16px 40px -12px rgba(0,0,0,0.7)"
            >
              <Text fontSize="17px" fontWeight="700" color="#eaedf2" mb={2}>
                Aktive Abrechnung vorhanden
              </Text>
              <Text fontSize="14px" color="#939dab" mb={5}>
                Es gibt bereits eine aktive Abrechnungsperiode. Bitte schließe sie zuerst ab, bevor du eine neue erstellst.
              </Text>
              <Box
                as="button"
                w="full"
                h="46px"
                borderRadius="10px"
                fontSize="15px"
                fontWeight="700"
                bg="#6478a0"
                color="white"
                border="none"
                cursor="pointer"
                onClick={() => setShowActiveExists(false)}
              >
                Okay
              </Box>
            </Box>
          </Flex>
        </>
      )}
    </Box>
  );
}
