"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, Text, Input } from "@chakra-ui/react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/constants";
import { LoadingState } from "@/components/LoadingState";
import { AppBar } from "@/components/AppBar";

export default function AccountPage() {
  const router = useRouter();
  const [originalName, setOriginalName] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLeave, setShowLeave] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push(ROUTES.LOGIN);
    });

    fetch("/api/me")
      .then((r) => r.json())
      .then((me) => {
        const n = me?.name ?? "";
        setOriginalName(n);
        setName(n);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const trimmed = name.trim();
  const dirty = name !== originalName;
  const canSave = dirty && trimmed.length > 0 && !saving;
  const canDiscard = dirty && !saving;

  const initials = originalName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  function handleBack() {
    if (dirty) setShowLeave(true);
    else router.push(ROUTES.HOME);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const me = await res.json();
        setOriginalName(me.name);
        setName(me.name);
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  return (
    <Flex minH="100dvh" bg="#0d1014" flexDir="column">
      <AppBar title="Konto verwalten" showBack onBack={handleBack} />

      <Box flex={1} overflowY="auto" px={5} pt={6}>
        {loading ? (
          <LoadingState minH="320px" />
        ) : (
          <>
            {/* Profile head */}
            <Flex flexDir="column" alignItems="center" mb={9}>
              <Flex
                w="88px" h="88px" borderRadius="9999px"
                bg="linear-gradient(135deg, #0468b3, #0576cc)"
                alignItems="center" justifyContent="center"
                fontSize="30px" fontWeight="800" color="white"
                mb={4}
                boxShadow="0 10px 30px -10px rgba(4,104,179,0.7)"
              >
                {initials}
              </Flex>
              <Text fontSize="22px" fontWeight="800" color="#eaedf2" mb="2px">{originalName}</Text>
              <Text fontSize="13px" color="#939dab">Mitglied</Text>
            </Flex>

            {/* Section label */}
            <Text
              fontSize="11px" fontWeight="700" letterSpacing="0.1em"
              textTransform="uppercase" color="#5c6675" mb={3}
            >
              Anzeigename
            </Text>

            {/* Field label */}
            <Text
              fontSize="12px" fontWeight="600" letterSpacing="0.04em"
              textTransform="uppercase" color="#939dab" mb="8px"
            >
              Dein Name
            </Text>

            {/* Input with clear button */}
            <Box position="relative">
              <Input
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="Dein Name"
                h="52px"
                w="full"
                bg="#1b212b"
                border="1px solid rgba(255,255,255,0.12)"
                borderRadius="12px"
                pl="14px"
                pr="44px"
                fontSize="16px"
                color="#eaedf2"
                outline="none"
                _focus={{ borderColor: "#0468b3" }}
              />
              {name && (
                <Box
                  as="button"
                  position="absolute"
                  right="12px"
                  top="50%"
                  transform="translateY(-50%)"
                  bg="none"
                  border="none"
                  cursor="pointer"
                  p="2px"
                  onClick={() => setName("")}
                  aria-label="Name leeren"
                >
                  <X size={18} color="#5c6675" />
                </Box>
              )}
            </Box>

            <Text fontSize="13px" color="#5c6675" mt="10px">
              So erscheinst du in der Spielerliste und in der Abrechnung.
            </Text>
          </>
        )}
      </Box>

      {/* Action buttons */}
      <Flex gap={3} px={5} pb={8} pt={4}>
        <Box
          as="button"
          flex={1}
          h="52px"
          borderRadius="12px"
          fontSize="16px"
          fontWeight="700"
          cursor={canDiscard ? "pointer" : "default"}
          bg={canDiscard ? "#1b212b" : "#151a21"}
          color={canDiscard ? "#eaedf2" : "#5c6675"}
          border={canDiscard ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.06)"}
          onClick={() => canDiscard && setName(originalName)}
        >
          Verwerfen
        </Box>
        <Box
          as="button"
          flex={1}
          h="52px"
          borderRadius="12px"
          fontSize="16px"
          fontWeight="700"
          border="none"
          cursor={canSave ? "pointer" : "default"}
          bg={canSave ? "#0468b3" : "#1b212b"}
          color={canSave ? "white" : "#5c6675"}
          onClick={save}
        >
          {saving ? "Speichern…" : "Speichern"}
        </Box>
      </Flex>

      {/* Unsaved-changes leave confirmation */}
      {showLeave && (
        <>
          <Box
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            bg="rgba(0,0,0,0.6)"
            zIndex={400}
            onClick={() => setShowLeave(false)}
          />
          <Flex
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            alignItems="center"
            justifyContent="center"
            px={6}
            zIndex={401}
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
                Ungespeicherte Änderungen
              </Text>
              <Text fontSize="14px" color="#939dab" mb={5}>
                Du hast ungespeicherte Änderungen. Möchtest du die Seite wirklich verlassen?
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
                  onClick={() => setShowLeave(false)}
                >
                  Hier bleiben
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
                  onClick={() => router.push(ROUTES.HOME)}
                >
                  Verlassen
                </Box>
              </Flex>
            </Box>
          </Flex>
        </>
      )}
    </Flex>
  );
}
