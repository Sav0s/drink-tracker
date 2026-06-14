"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
    rows: [{ date: "30.04.", drink: "Cola", price_cents: 100 }],
  },
];

const STATUS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  aktiv:      { bg: "bg-[rgba(4,104,179,0.16)]",  text: "text-[#0468b3]", dot: "text-[#0468b3]", label: "Aktiv" },
  ausstehend: { bg: "bg-[rgba(214,162,58,0.15)]", text: "text-[#d6a23a]", dot: "text-[#d6a23a]", label: "Ausstehend" },
  bezahlt:    { bg: "bg-[rgba(47,169,104,0.15)]", text: "text-[#2fa968]", dot: "text-[#2fa968]", label: "Bezahlt" },
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
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Spieler";
      setPlayer(name);
    });
  }, [router]);

  const initials = player.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const activePeriod = MOCK_PERIODS.find((p) => p.status === "aktiv");
  const pendingPeriods = MOCK_PERIODS.filter((p) => p.status === "ausstehend");
  const totalOwed = (activePeriod?.total_cents ?? 0) + pendingPeriods.reduce((s, p) => s + p.total_cents, 0);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-dvh bg-[#0d1014] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-white/7">
        <button onClick={() => router.push("/home")} className="p-1.5 cursor-pointer">
          <ChevronLeft size={20} color="#eaedf2" />
        </button>
        <span className="text-[17px] font-bold text-[#eaedf2]">Mein Konto</span>
        <div className="w-9" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 pt-5">
        {/* Profile head */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0468b3] to-[#0576cc] flex items-center justify-center text-xl font-extrabold text-white shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-[18px] font-bold text-[#eaedf2] mb-0.5">{player}</p>
            <p className="text-[13px] text-[#939dab]">Mitglied · 1. Mannschaft</p>
          </div>
        </div>

        {/* Balance card */}
        <div className="p-5 rounded-2xl bg-[#151a21] border border-white/7 mb-6">
          <p className="text-[11px] font-bold tracking-widest uppercase text-[#939dab] mb-1.5">Du schuldest gesamt</p>
          <p className="text-[34px] font-extrabold tracking-tight text-[#eaedf2] mb-3">{formatCents(totalOwed)}</p>
          <div className="flex gap-4">
            {activePeriod && (
              <span className="text-[13px] text-[#939dab] flex items-center gap-1.5">
                <span className="text-[#0468b3]">●</span> {formatCents(activePeriod.total_cents)} laufend
              </span>
            )}
            {pendingPeriods.length > 0 && (
              <span className="text-[13px] text-[#939dab] flex items-center gap-1.5">
                <span className="text-[#d6a23a]">●</span> {formatCents(pendingPeriods.reduce((s, p) => s + p.total_cents, 0))} ausstehend
              </span>
            )}
          </div>
        </div>

        {/* Abrechnungen */}
        <p className="text-[11px] font-bold tracking-widest uppercase text-[#5c6675] mb-2.5">Abrechnungen</p>

        {MOCK_PERIODS.map((period) => {
          const st = STATUS[period.status];
          const isOpen = openId === period.id;
          return (
            <div key={period.id} className="bg-[#151a21] border border-white/7 rounded-xl mb-1.5 overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? null : period.id)}
                className="w-full flex items-center gap-2 px-3.5 py-3 cursor-pointer"
              >
                <ChevronRight
                  size={16}
                  color="#5c6675"
                  style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
                />
                <span className="text-sm font-medium text-[#eaedf2] flex-1 text-left">{period.range}</span>
                <span className={`flex items-center gap-1 ${st.bg} ${st.text} rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap`}>
                  <span className={`text-[8px] ${st.dot}`}>●</span> {st.label}
                </span>
                <span className="text-xs text-[#5c6675]">· {period.count}</span>
                <span className="text-sm font-semibold text-[#eaedf2] ml-auto">{formatCents(period.total_cents)}</span>
              </button>

              {isOpen && (
                <div className="px-3.5 pb-3">
                  {period.rows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-2 border-t border-white/5">
                      <span className="text-xs text-[#5c6675] w-10">{row.date}</span>
                      <span className="text-[13px] text-[#eaedf2] flex-1">{row.drink}</span>
                      <span className="text-[13px] text-[#939dab]">{formatCents(row.price_cents)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Logout */}
      <div className="px-5 pb-8 pt-4">
        <button
          onClick={logout}
          className="w-full h-13 rounded-xl bg-[#e0535f] text-white text-base font-bold flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut size={16} />
          Ausloggen
        </button>
      </div>
    </div>
  );
}
