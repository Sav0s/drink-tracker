"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, ChevronDown, ChevronRight, RotateCcw, LogOut } from "lucide-react";
import { formatCents } from "@/types";
import { createClient } from "@/lib/supabase/client";

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

const MOCK_DRINKS: DrinkRow[] = [
  { id: "1", name: "Wasser", price_cents: 50, active: true },
  { id: "2", name: "Apfelschorle", price_cents: 80, active: true },
  { id: "3", name: "Cola", price_cents: 100, active: true },
  { id: "4", name: "Bier 0,33l", price_cents: 150, active: true },
  { id: "5", name: "Iso-Drink", price_cents: 120, active: false },
];

const MOCK_MEMBERS: MemberRow[] = [
  { id: "1", name: "Andreas Müller", count: 18, total_cents: 1850, paid: false, items: [{ drink: "Bier 0,33l", count: 8, price_cents: 150 }, { drink: "Cola", count: 5, price_cents: 100 }, { drink: "Wasser", count: 5, price_cents: 50 }] },
  { id: "2", name: "Benedikt Schmid", count: 12, total_cents: 1200, paid: true, items: [{ drink: "Apfelschorle", count: 12, price_cents: 80 }] },
  { id: "3", name: "Christian Wagner", count: 7, total_cents: 710, paid: false, items: [{ drink: "Cola", count: 7, price_cents: 100 }] },
];

const MOCK_PERIODS = [
  { id: "1", range: "01.06. – 01.07.2026", status: "aktiv" },
  { id: "2", range: "01.05. – 01.06.2026", status: "abgeschlossen" },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-[42px] h-6 rounded-full border cursor-pointer transition-colors ${on ? "bg-[#2fa968]/15 border-[#2fa968]" : "bg-[#222a36] border-white/12"}`}
    >
      <div className={`absolute top-[3px] w-[18px] h-[18px] rounded-full transition-all ${on ? "left-[21px] bg-[#2fa968]" : "left-[3px] bg-[#5a6473]"}`} />
    </button>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"drinks" | "billing">("drinks");
  const [drinks, setDrinks] = useState<DrinkRow[]>(MOCK_DRINKS);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newActive, setNewActive] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>(MOCK_MEMBERS);
  const [selPeriod, setSelPeriod] = useState(0);
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [adminName, setAdminName] = useState("A");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/admin/login"); return; }
      const name = user.user_metadata?.full_name || user.user_metadata?.name || "Admin";
      setAdminName(name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2));
    });
  }, [router]);

  function toggleDrink(id: string, active: boolean) {
    setDrinks((prev) => prev.map((d) => (d.id === id ? { ...d, active } : d)));
  }

  function addDrink() {
    if (!newName || !newPrice) return;
    const price = Math.round(parseFloat(newPrice.replace(",", ".")) * 100);
    setDrinks((prev) => [...prev, { id: Date.now().toString(), name: newName, price_cents: price, active: newActive }]);
    setNewName(""); setNewPrice(""); setNewActive(true);
  }

  function markPaid(id: string, paid: boolean) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, paid } : m)));
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  }

  const paid = members.filter((m) => m.paid).length;
  const offen = members.filter((m) => !m.paid).length;
  const sumOffen = members.filter((m) => !m.paid).reduce((s, m) => s + m.total_cents, 0);
  const gesamt = members.reduce((s, m) => s + m.total_cents, 0);

  return (
    <div className="min-h-dvh bg-[#0b0e13] text-[#eaedf2]">
      {/* Topbar */}
      <header className="flex items-center justify-between px-7 py-3.5 border-b border-white/7">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">⚽</span>
          <span className="text-[17px] font-bold">
            Kabinen-Bar <span className="text-[#939dab] font-normal">· Verwaltung</span>
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#6478a0]/16 border border-[#6478a0]/30 text-xs font-semibold text-[#6478a0]">
            Admin
          </div>
          <div className="w-8 h-8 rounded-full bg-[#6478a0] flex items-center justify-center text-[13px] font-bold text-white">
            {adminName}
          </div>
          <button onClick={logout} className="p-1.5 cursor-pointer">
            <LogOut size={16} color="#5c6675" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-white/7 px-7">
        {(["drinks", "billing"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 mr-7 text-[15px] font-medium border-b-2 cursor-pointer transition-colors ${
              tab === t ? "text-[#6478a0] border-[#6478a0]" : "text-[#5a6473] border-transparent"
            }`}
          >
            {t === "drinks" ? "Getränke verwalten" : "Abrechnung"}
          </button>
        ))}
      </div>

      <div className="px-7 py-6 max-w-[960px] mx-auto">
        {/* Tab A: Getränke */}
        {tab === "drinks" && (
          <div>
            <div className="mb-4">
              <h2 className="text-[19px] font-bold mb-1">Getränke verwalten</h2>
              <p className="text-[13px] text-[#939dab]">
                {drinks.length} Getränke · {drinks.filter((d) => d.active).length} aktiv · {drinks.filter((d) => !d.active).length} inaktiv
              </p>
            </div>

            <div className="bg-[#141921] rounded-xl overflow-hidden border border-white/7">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Name", "Preis", "Status", "Aktion"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase text-[#5a6473] border-b border-white/7">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drinks.map((d) => (
                    <tr key={d.id} className={d.active ? "" : "opacity-45"}>
                      <td className="px-4 py-3 text-sm border-b border-white/5">{d.name}</td>
                      <td className="px-4 py-3 text-sm border-b border-white/5">{formatCents(d.price_cents)}</td>
                      <td className="px-4 py-3 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <Toggle on={d.active} onChange={(v) => toggleDrink(d.id, v)} />
                          <span className={`text-[13px] ${d.active ? "text-[#2fa968]" : "text-[#5a6473]"}`}>
                            {d.active ? "Aktiv" : "Inaktiv"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b border-white/5">
                        <button className="p-1 cursor-pointer"><Pencil size={14} color="#6478a0" /></button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="px-4 py-3">
                      <input className="w-full bg-[#1a202a] border border-white/12 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="w-full bg-[#1a202a] border border-white/12 rounded-lg px-3 py-2 text-sm outline-none" placeholder="1,50" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
                    </td>
                    <td className="px-4 py-3">
                      <Toggle on={newActive} onChange={setNewActive} />
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={addDrink} className="bg-[#6478a0] text-white rounded-lg px-4 py-2 text-[13px] font-semibold cursor-pointer">
                        Speichern
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab B: Abrechnung */}
        {tab === "billing" && (
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative">
                <button
                  onClick={() => setPeriodOpen(!periodOpen)}
                  className="flex items-center gap-2 bg-[#141921] border border-white/12 rounded-xl px-3.5 py-2 cursor-pointer text-sm"
                >
                  <span>{MOCK_PERIODS[selPeriod].range}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${selPeriod === 0 ? "bg-[#0468b3]/16 text-[#0468b3]" : "bg-[#6478a0]/16 text-[#6478a0]"}`}>
                    {selPeriod === 0 ? "Aktiv" : "Abgeschlossen"}
                  </span>
                  <ChevronDown size={16} color="#5a6473" />
                </button>
                {periodOpen && (
                  <div className="absolute top-[calc(100%+6px)] left-0 z-50 bg-[#1a202a] border border-white/12 rounded-xl overflow-hidden min-w-[220px]">
                    {MOCK_PERIODS.map((p, i) => (
                      <button key={p.id} onClick={() => { setSelPeriod(i); setPeriodOpen(false); }} className="block w-full text-left px-3.5 py-2.5 text-sm cursor-pointer hover:bg-white/5">
                        {p.range}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-1.5 bg-transparent border border-white/12 rounded-xl px-3.5 py-2 cursor-pointer text-sm">
                <Plus size={14} /> Neue Abrechnung
              </button>
            </div>

            {showNew && (
              <div className="bg-[#141921] border border-white/7 rounded-xl p-4 mb-4">
                <div className="flex gap-3 mb-3">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold tracking-widest uppercase text-[#5a6473] mb-1.5">Startdatum</label>
                    <input type="date" className="w-full bg-[#1a202a] border border-white/12 rounded-lg px-3 py-2.5 text-sm outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold tracking-widest uppercase text-[#5a6473] mb-1.5">Enddatum</label>
                    <input type="date" className="w-full bg-[#1a202a] border border-white/12 rounded-lg px-3 py-2.5 text-sm outline-none" />
                  </div>
                </div>
                <label className="block text-[11px] font-bold tracking-widest uppercase text-[#5a6473] mb-1.5">Zahlungshinweise</label>
                <textarea rows={3} placeholder="IBAN, PayPal, Empfänger…" className="w-full bg-[#1a202a] border border-white/12 rounded-lg px-3 py-2.5 text-sm outline-none resize-y" />
                <div className="flex gap-2 justify-end mt-3">
                  <button onClick={() => setShowNew(false)} className="bg-transparent border border-white/12 rounded-lg px-4 py-2 text-[#939dab] text-sm cursor-pointer">Abbrechen</button>
                  <button className="bg-[#6478a0] border-none rounded-lg px-4 py-2 text-white text-sm font-semibold cursor-pointer">Abrechnung erstellen</button>
                </div>
              </div>
            )}

            {/* Summary bar */}
            <div className="flex bg-[#141921] border border-white/7 rounded-xl overflow-hidden mb-4">
              {[
                { label: "Mitglieder", value: members.length.toString() },
                { label: "Getränke", value: members.reduce((s, m) => s + m.count, 0).toString() },
                { label: "Bezahlt", value: paid.toString(), color: "text-[#2fa968]" },
                { label: "Offen", value: offen.toString(), color: "text-[#d6a23a]" },
                { label: "Summe offen", value: formatCents(sumOffen), color: "text-[#d6a23a]" },
                { label: "Gesamt", value: formatCents(gesamt) },
              ].map((item) => (
                <div key={item.label} className="flex-1 px-4 py-3 border-r border-white/7 last:border-r-0">
                  <p className="text-[11px] font-bold tracking-widest uppercase text-[#5a6473] mb-1">{item.label}</p>
                  <p className={`text-[18px] font-bold ${item.color ?? ""}`}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Member list */}
            {members.map((m) => {
              const initials = m.name.split(" ").map((w) => w[0]).join("").slice(0, 2);
              const isOpen = openMember === m.id;
              return (
                <div key={m.id} className="bg-[#141921] border border-white/7 rounded-xl mb-1.5 overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3">
                    <button onClick={() => setOpenMember(isOpen ? null : m.id)} className="cursor-pointer">
                      <ChevronRight size={16} color="#5a6473" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-[#222a36] flex items-center justify-center text-xs font-bold text-[#6478a0] shrink-0">
                      {initials}
                    </div>
                    <span className="flex-1 text-sm font-medium">{m.name}</span>
                    <span className="text-sm text-[#939dab] w-16">{m.count} Stk.</span>
                    <span className="text-sm font-semibold w-20">{formatCents(m.total_cents)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold w-20 text-center ${m.paid ? "bg-[#2fa968]/15 text-[#2fa968]" : "bg-[#d6a23a]/15 text-[#d6a23a]"}`}>
                      {m.paid ? "Bezahlt" : "Offen"}
                    </span>
                    {m.paid ? (
                      <button onClick={() => markPaid(m.id, false)} className="p-1 cursor-pointer"><RotateCcw size={14} color="#5a6473" /></button>
                    ) : (
                      <button onClick={() => markPaid(m.id, true)} className="bg-transparent border border-white/12 rounded-lg px-3 py-1.5 text-[13px] cursor-pointer whitespace-nowrap">
                        Als bezahlt
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-3 pl-[58px]">
                      <p className="text-[11px] font-bold tracking-widest uppercase text-[#5a6675] mb-2.5">Getrunken in diesem Zeitraum</p>
                      {m.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5">
                          <span className="text-sm">{item.count} × {item.drink}</span>
                          <span className="text-[13px] text-[#939dab]">{formatCents(item.price_cents)} / Stk.</span>
                          <span className="text-sm font-semibold">{formatCents(item.count * item.price_cents)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-2 border-t border-white/12 mt-1">
                        <span className="text-sm font-bold">Summe</span>
                        <span />
                        <span className="text-sm font-bold">{formatCents(m.total_cents)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
