"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, Plus, Pencil, Check, RotateCcw } from "lucide-react";
import { formatCents } from "@/types";

interface DrinkState {
  id: string;
  name: string;
  price_cents: number;
  count: number;
}

const MOCK_DRINKS: DrinkState[] = [
  { id: "1", name: "Wasser", price_cents: 50, count: 2 },
  { id: "2", name: "Apfelschorle", price_cents: 80, count: 5 },
  { id: "3", name: "Cola", price_cents: 100, count: 3 },
  { id: "4", name: "Bier 0,33l", price_cents: 150, count: 8 },
  { id: "5", name: "Iso-Drink", price_cents: 120, count: 0 },
];

interface Toast {
  drink: DrinkState;
  visible: boolean;
}

interface EditSheet {
  drink: DrinkState | null;
}

function TallyBundle() {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="2" y1="2" x2="2" y2="18" stroke="#939dab" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="7" y1="2" x2="7" y2="18" stroke="#939dab" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="2" x2="12" y2="18" stroke="#939dab" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="17" y1="2" x2="17" y2="18" stroke="#939dab" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="0" y1="16" x2="22" y2="4" stroke="#939dab" strokeWidth="1.8" strokeLinecap="round" />
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
    return <span style={{ fontSize: 12, color: "#5c6675" }}>noch keins diesen Monat</span>;
  }
  const bundles = Math.floor(count / 5);
  const remainder = count % 5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {Array.from({ length: bundles }).map((_, i) => <TallyBundle key={i} />)}
      {Array.from({ length: remainder }).map((_, i) => <TallyBar key={i} />)}
      <span style={{ fontSize: 12, color: "#5c6675", marginLeft: 2 }}>{count}×</span>
    </div>
  );
}

export default function HauptseiteePage() {
  const router = useRouter();
  const [player, setPlayer] = useState<string>("");
  const [drinks, setDrinks] = useState<DrinkState[]>(MOCK_DRINKS);
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [editSheet, setEditSheet] = useState<EditSheet>({ drink: null });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Spieler";
      setPlayer(name);
    });
  }, [router]);

  const saldo = drinks.reduce((sum, d) => sum + d.count * d.price_cents, 0);

  const bookDrink = useCallback(
    (drink: DrinkState) => {
      setDrinks((prev) =>
        prev.map((d) => (d.id === drink.id ? { ...d, count: d.count + 1 } : d))
      );
      if (toastTimer) clearTimeout(toastTimer);
      setToast({ drink, visible: true });
      const t = setTimeout(() => setToast(null), 3500);
      setToastTimer(t);
    },
    [toastTimer]
  );

  function undoBooking() {
    if (!toast) return;
    setDrinks((prev) =>
      prev.map((d) =>
        d.id === toast.drink.id ? { ...d, count: Math.max(0, d.count - 1) } : d
      )
    );
    if (toastTimer) clearTimeout(toastTimer);
    setToast(null);
  }

  const initials = player
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div style={s.root}>
      {/* App bar */}
      <header style={s.appBar}>
        <div style={s.wordmark}>
          <span style={s.wordmarkText}>Kabinen-Bar</span>
        </div>
        <button style={s.avatarBtn} onClick={() => router.push("/profil")}>
          <div style={s.avatar}>{initials}</div>
        </button>
      </header>

      {/* Saldo hero */}
      <div style={s.hero}>
        <p style={s.heroLabel}>Du schuldest</p>
        <p style={s.heroAmount}>{formatCents(saldo)}</p>
        <div style={s.heroMeta}>
          <span style={s.metaChip}>{drinks.reduce((s, d) => s + d.count, 0)} Getränke</span>
          <span style={s.metaSep}>·</span>
          <span style={s.metaChip}>Abrechnung seit 01.06.</span>
        </div>
      </div>

      {/* Section label */}
      <p style={s.sectionLabel}>Getränke · tippen zum Buchen</p>

      {/* Drink cards */}
      <div style={s.drinkList}>
        {drinks.map((drink) => (
          <div
            key={drink.id}
            style={{ ...s.drinkCard, cursor: "pointer" }}
            onClick={() => bookDrink(drink)}
          >
            <div style={s.drinkInfo}>
              <span style={s.drinkName}>{drink.name}</span>
              <span style={s.drinkPrice}>{formatCents(drink.price_cents)}</span>
              <Strichliste count={drink.count} />
            </div>
            <div style={s.drinkActions}>
              <button
                style={s.editBtn}
                onClick={(e) => { e.stopPropagation(); setEditSheet({ drink }); }}
              >
                <Pencil size={13} color="#5c6675" />
              </button>
              <div style={s.plusBtn}>
                <Plus size={22} color="#fff" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Undo toast */}
      {toast && (
        <div style={s.toast}>
          <Check size={16} color="#2fa968" />
          <span style={s.toastText}>
            {toast.drink.name} gebucht · {formatCents(toast.drink.price_cents)}
          </span>
          <button style={s.undoBtn} onClick={undoBooking}>Rückgängig</button>
        </div>
      )}

      {/* Edit bottom sheet */}
      {editSheet.drink && (
        <>
          <div style={s.backdrop} onClick={() => setEditSheet({ drink: null })} />
          <div style={s.sheet}>
            <div style={s.sheetHandle} />
            <p style={s.sheetTitle}>{editSheet.drink.name} korrigieren</p>
            <p style={s.sheetSub}>{editSheet.drink.count}× dieses Getränk diese Abrechnung</p>
            <div style={s.sheetList}>
              {Array.from({ length: editSheet.drink.count }).map((_, i) => (
                <div key={i} style={s.sheetRow}>
                  <span style={{ fontSize: 14, color: "#eaedf2" }}>Eintrag {i + 1}</span>
                  <button
                    style={s.removeBtn}
                    onClick={() => {
                      setDrinks((prev) =>
                        prev.map((d) =>
                          d.id === editSheet.drink!.id
                            ? { ...d, count: Math.max(0, d.count - 1) }
                            : d
                        )
                      );
                      setEditSheet((prev) => ({
                        drink: prev.drink
                          ? { ...prev.drink, count: Math.max(0, prev.drink.count - 1) }
                          : null,
                      }));
                    }}
                  >
                    ✕ entfernen
                  </button>
                </div>
              ))}
            </div>
            <button style={s.sheetDone} onClick={() => setEditSheet({ drink: null })}>
              Fertig
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100dvh",
    background: "#0d1014",
    paddingBottom: 80,
    position: "relative",
  },
  appBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  wordmark: { display: "flex", alignItems: "center", gap: 10 },
  wordmarkText: { fontSize: 17, fontWeight: 700, color: "#eaedf2" },
  avatarBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: "#0468b3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
  },
  hero: {
    margin: "20px 20px 8px",
    padding: "20px 22px",
    borderRadius: 16,
    background:
      "linear-gradient(135deg, rgba(4,104,179,0.22) 0%, rgba(4,104,179,0.08) 100%)",
    border: "1px solid rgba(4,104,179,0.3)",
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#939dab",
    marginBottom: 6,
  },
  heroAmount: {
    fontSize: 40,
    fontWeight: 800,
    letterSpacing: "-1.2px",
    color: "#eaedf2",
    marginBottom: 12,
  },
  heroMeta: { display: "flex", alignItems: "center", gap: 8 },
  metaChip: { fontSize: 12, color: "#939dab" },
  metaSep: { color: "#5c6675", fontSize: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#5c6675",
    padding: "12px 20px 8px",
  },
  drinkList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "0 20px",
  },
  drinkCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    background: "#151a21",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    cursor: "pointer",
    width: "100%",
    color: "#eaedf2",
    textAlign: "left",
    transition: "border-color 0.12s",
  },
  drinkInfo: { display: "flex", flexDirection: "column", gap: 4 },
  drinkName: { fontSize: 16, fontWeight: 600 },
  drinkPrice: { fontSize: 13, color: "#939dab" },
  drinkActions: { display: "flex", alignItems: "center", gap: 8 },
  editBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 6,
  },
  plusBtn: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: "#0468b3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 20px -8px rgba(4,104,179,0.7)",
    flexShrink: 0,
  },
  toast: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#222934",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 280,
    boxShadow: "0 8px 24px -12px rgba(0,0,0,0.55)",
    zIndex: 100,
  },
  toastText: { flex: 1, fontSize: 14, color: "#eaedf2" },
  undoBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#0468b3",
    fontSize: 14,
    fontWeight: 600,
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    zIndex: 200,
  },
  sheet: {
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 430,
    background: "#151a21",
    borderRadius: "26px 26px 0 0",
    padding: "16px 20px 32px",
    zIndex: 201,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    margin: "0 auto 16px",
  },
  sheetTitle: { fontSize: 18, fontWeight: 700, color: "#eaedf2", marginBottom: 4 },
  sheetSub: { fontSize: 13, color: "#939dab", marginBottom: 16 },
  sheetList: { display: "flex", flexDirection: "column", gap: 2, marginBottom: 20 },
  sheetRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  removeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#e0535f",
    fontSize: 13,
    fontWeight: 500,
  },
  sheetDone: {
    width: "100%",
    height: 52,
    borderRadius: 12,
    background: "#0468b3",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },
};
