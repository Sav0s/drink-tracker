"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, Text, Input } from "@chakra-ui/react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/constants";
import { apiFetch, ApiFetchError, API_ACTION, type ApiAction } from "@/lib/apiFetch";
import { LoadingState } from "@/components/LoadingState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { AppBar } from "@/components/AppBar";

export default function AccountPage() {
  const router = useRouter();
  const [originalName, setOriginalName] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; action: ApiAction } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showLeave, setShowLeave] = useState(false);

  const loadAccount = useCallback(() => {
    apiFetch("/api/me")
      .then((me) => {
        const n = me?.name ?? "";
        setOriginalName(n);
        setName(n);
      })
      .catch((err: unknown) => {
        const e = err instanceof ApiFetchError ? err : new ApiFetchError("Laden fehlgeschlagen.");
        setLoadError({ message: e.message, action: e.action });
      })
      .finally(() => setLoading(false));
  }, []);

  function retryAccount() {
    setLoading(true);
    setLoadError(null);
    loadAccount();
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push(ROUTES.LOGIN);
    });
    loadAccount();
  }, [router, loadAccount]);

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
    setSaveError(null);
    try {
      const me = await apiFetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      setOriginalName(me.name);
      setName(me.name);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiFetchError && err.status === 401
          ? "Sitzung abgelaufen. Bitte neu einloggen."
          : "Speichern fehlgeschlagen. Bitte erneut versuchen.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Flex minH="100dvh" bg="#0d1014" flexDir="column">
      <AppBar title="Konto verwalten" showBack onBack={handleBack} />

      <Box flex={1} overflowY="auto">
        <Box w="full" maxW="440px" mx="auto" px={5} pt={10} pb={8}>
          {loading ? (
            <LoadingState minH="320px" />
          ) : loadError ? (
            <ErrorBanner
              message={loadError.message}
              action={
                loadError.action === API_ACTION.LOGIN
                  ? { label: "Einloggen", onClick: () => router.push(ROUTES.LOGIN) }
                  : { label: "Neu laden", onClick: retryAccount }
              }
            />
          ) : (
            <>
              {/* Profile head */}
              <Flex flexDir="column" alignItems="center" mb={8}>
                <Flex
                  w="80px" h="80px" borderRadius="9999px"
                  bg="linear-gradient(135deg, #0468b3, #0576cc)"
                  alignItems="center" justifyContent="center"
                  fontSize="28px" fontWeight="800" color="white"
                  mb={4}
                  boxShadow="0 10px 30px -10px rgba(4,104,179,0.7)"
                >
                  {initials}
                </Flex>
                <Text fontSize="20px" fontWeight="800" color="#eaedf2" mb="2px">{originalName}</Text>
                <Text fontSize="13px" color="#939dab">Mitglied</Text>
              </Flex>

              {/* Anzeigename card */}
              <Text
                fontSize="11px" fontWeight="700" letterSpacing="0.1em"
                textTransform="uppercase" color="#5c6675" mb={2}
              >
                Anzeigename
              </Text>
              <Box
                bg="#151a21"
                border="1px solid rgba(255,255,255,0.07)"
                borderRadius="16px"
                p={5}
              >
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
                    h="48px"
                    w="full"
                    bg="#1b212b"
                    border="1px solid rgba(255,255,255,0.12)"
                    borderRadius="10px"
                    pl="14px"
                    pr="44px"
                    fontSize="15px"
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
              </Box>

              {saveError && (
                <Box mt={4}>
                  <ErrorBanner message={saveError} />
                </Box>
              )}

              {/* Action buttons */}
              <Flex gap={3} mt={6} justifyContent="flex-end">
                <Box
                  as="button"
                  minW="120px"
                  h="44px"
                  px={5}
                  borderRadius="10px"
                  fontSize="14px"
                  fontWeight="700"
                  transition="background 0.12s, border-color 0.12s, color 0.12s"
                  cursor={canDiscard ? "pointer" : "default"}
                  bg="transparent"
                  color={canDiscard ? "#eaedf2" : "#4b5563"}
                  border={canDiscard ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.06)"}
                  _hover={canDiscard ? { bg: "#1b212b" } : undefined}
                  onClick={() => canDiscard && setName(originalName)}
                >
                  Verwerfen
                </Box>
                <Box
                  as="button"
                  minW="140px"
                  h="44px"
                  px={5}
                  borderRadius="10px"
                  fontSize="14px"
                  fontWeight="700"
                  border="none"
                  transition="background 0.12s, color 0.12s"
                  cursor={canSave ? "pointer" : "default"}
                  bg={canSave ? "#0468b3" : "#1b212b"}
                  color={canSave ? "white" : "#4b5563"}
                  boxShadow={canSave ? "0 8px 20px -8px rgba(4,104,179,0.7)" : "none"}
                  _hover={canSave ? { bg: "#0576cc" } : undefined}
                  onClick={save}
                >
                  {saving ? "Speichern…" : "Speichern"}
                </Box>
              </Flex>
            </>
          )}
        </Box>
      </Box>

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
