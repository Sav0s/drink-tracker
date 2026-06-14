"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { formatCents } from "@/types";

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
      { date: "12.06.", drink: "Bier 0,33l", price_cents: 150 },
      { date: "11.06.", drink: "Cola", price_cents: 100 },
      { date: "10.06.", drink: "Wasser", price_cents: 50 },
    ],
  },
  {
    id: "2",
    range: "01.05. – 01.06.2026",
    status: "ausstehend",
    count: 22,
    total_cents: 2400,
    rows: [
      { date: "31.05.", drink: "Apfelschorle", price_cents: 80 },
      { date: "28.05.", drink: "Bier 0,33l", price_cents: 150 },
    ],
  },
  {
    id: "3",
    range: "01.04. – 01.05.2026",
    status: "bezahlt",
    count: 15,
    total_cents: 1650,
    rows: [
      { date: "30.04.", drink: "Cola", price_cents: 100 },
    ],
  },
];

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  aktiv: { bg: "rgba(4,104,179,0.16)", color: "#0468b3", dot: "#0468b3", label: "Aktiv" },
  ausstehend: { bg: "rgba(214,162,58,0.15)", color: "#d6a23a", dot: "#d6a23a", label: "Ausstehend" },
  bezahlt: { bg: "rgba(47,169,104,0.15)", color: "#2fa968", dot: "#2fa968", label: "Bezahlt" },
};

export default function ProfilPage() {
  const router = useRouter();
  const [player, setPlayer] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const p = sessionStorage.getItem("player");
    if (!p) { router.push("/login"); return; }
    setPlayer(p);
  }, [router]);

  const initials = player.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const activePeriod = MOCK_PERIODS.find((p) => p.status === "aktiv");
  const pendingPeriods = MOCK_PERIODS.filter((p) => p.status === "ausstehend");
  const totalOwed =
    (activePeriod?.total_cents ?? 0) +
    pendingPeriods.reduce((s, p) => s + p.total_cents, 0);

  function logout() {
    sessionStorage.removeItem("player");
    router.push("/login");
  }

  return (
    <div style={s.root}>
      {/* Top bar */}
      <header style={s.header}>
        <button style={s.backBtn} onClick={() => router.push("/home")}>
          <ChevronLeft size={20} color="#eaedf2" />
        </button>
        <span style={s.headerTitle}>Mein Konto</span>
        <div style={{ width: 36 }} />
      </header>

      <div style={s.scroll}>
        {/* Profile head */}
        <div style={s.profileHead}>
          <div style={s.bigAvatar}>{initials}</div>
          <div>
            <p style={s.profileName}>{player}</p>
            <p style={s.profileSub}>Mitglied · 1. Mannschaft</p>
          </div>
        </div>

        {/* Balance card */}
        <div style={s.balanceCard}>
          <p style={s.balanceLabel}>Du schuldest gesamt</p>
          <p style={s.balanceAmount}>{formatCents(totalOwed)}</p>
          <div style={s.balanceBreakdown}>
            {activePeriod && (
              <span style={s.breakdownItem}>
                <span style={{ color: "#0468b3" }}>●</span>{" "}
                {formatCents(activePeriod.total_cents)} laufend
              </span>
            )}
            {pendingPeriods.length > 0 && (
              <span style={s.breakdownItem}>
                <span style={{ color: "#d6a23a" }}>●</span>{" "}
                {formatCents(pendingPeriods.reduce((s, p) => s + p.total_cents, 0))} ausstehend
              </span>
            )}
          </div>
        </div>

        {/* Abrechnungen */}
        <p style={s.sectionLabel}>Abrechnungen</p>

        {MOCK_PERIODS.map((period) => {
          const st = STATUS_STYLES[period.status];
          const isOpen = openId === period.id;
          return (
            <div key={period.id} style={s.periodCard}>
              <button
                style={s.periodRow}
                onClick={() => setOpenId(isOpen ? null : period.id)}
              >
                <ChevronRight
                  size={16}
                  color="#5c6675"
                  style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
                />
                <span style={s.periodRange}>{period.range}</span>
                <span style={{ ...s.statusPill, background: st.bg, color: st.color }}>
                  <span style={{ color: st.dot, fontSize: 8 }}>●</span> {st.label}
                </span>
                <span style={s.periodMeta}>· {period.count} Getränke</span>
                <span style={s.periodTotal}>{formatCents(period.total_cents)}</span>
              </button>

              {isOpen && (
                <div style={s.periodDetail}>
                  {period.rows.map((row, i) => (
                    <div key={i} style={s.detailRow}>
                      <span style={s.detailDate}>{row.date}</span>
                      <span style={s.detailDrink}>{row.drink}</span>
                      <span style={s.detailPrice}>{formatCents(row.price_cents)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ausloggen */}
      <div style={s.footer}>
        <button style={s.logoutBtn} onClick={logout}>
          <LogOut size={16} />
          Ausloggen
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: "100dvh", background: "#0d1014", display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  backBtn: { background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: 700, color: "#eaedf2" },
  scroll: { flex: 1, overflowY: "auto", padding: "20px 20px 0" },
  profileHead: { display: "flex", alignItems: "center", gap: 16, marginBottom: 20 },
  bigAvatar: {
    width: 58, height: 58, borderRadius: 999,
    background: "linear-gradient(135deg, #0468b3, #0576cc)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, fontWeight: 800, color: "#fff", flexShrink: 0,
  },
  profileName: { fontSize: 18, fontWeight: 700, color: "#eaedf2", marginBottom: 2 },
  profileSub: { fontSize: 13, color: "#939dab" },
  balanceCard: {
    padding: "18px 20px", borderRadius: 16,
    background: "#151a21", border: "1px solid rgba(255,255,255,0.07)",
    marginBottom: 24,
  },
  balanceLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#939dab", marginBottom: 6 },
  balanceAmount: { fontSize: 34, fontWeight: 800, letterSpacing: "-1.2px", color: "#eaedf2", marginBottom: 12 },
  balanceBreakdown: { display: "flex", gap: 16 },
  breakdownItem: { fontSize: 13, color: "#939dab", display: "flex", alignItems: "center", gap: 6 },
  sectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5c6675", marginBottom: 10 },
  periodCard: { background: "#151a21", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, marginBottom: 6, overflow: "hidden" },
  periodRow: {
    width: "100%", display: "flex", alignItems: "center", gap: 8,
    padding: "12px 14px", background: "none", border: "none", cursor: "pointer",
    color: "#eaedf2", textAlign: "left",
  },
  periodRange: { fontSize: 14, fontWeight: 500, color: "#eaedf2", flex: 1 },
  statusPill: { borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" },
  periodMeta: { fontSize: 12, color: "#5c6675" },
  periodTotal: { fontSize: 14, fontWeight: 600, color: "#eaedf2", marginLeft: "auto" },
  periodDetail: { padding: "0 14px 12px" },
  detailRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.05)" },
  detailDate: { fontSize: 12, color: "#5c6675", width: 40 },
  detailDrink: { fontSize: 13, color: "#eaedf2", flex: 1 },
  detailPrice: { fontSize: 13, color: "#939dab" },
  footer: { padding: "16px 20px 32px" },
  logoutBtn: {
    width: "100%", height: 52, borderRadius: 12,
    background: "#e0535f", color: "#fff",
    fontSize: 16, fontWeight: 700,
    border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },
};
