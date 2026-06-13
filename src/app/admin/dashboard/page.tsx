"use client";

import { useState } from "react";
import { Plus, Pencil, ChevronDown, ChevronRight, RotateCcw, Lock } from "lucide-react";
import { formatCents } from "@/types";

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
      style={{
        width: 42, height: 24, borderRadius: 999,
        background: on ? "rgba(47,169,104,0.15)" : "#222a36",
        border: `1px solid ${on ? "#2fa968" : "rgba(255,255,255,0.12)"}`,
        position: "relative", cursor: "pointer", flexShrink: 0,
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 999,
        background: on ? "#2fa968" : "#5a6473",
        position: "absolute", top: 2,
        left: on ? 20 : 2,
        transition: "left 0.15s, background 0.15s",
      }} />
    </button>
  );
}

export default function AdminDashboardPage() {
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

  const paid = members.filter((m) => m.paid).length;
  const offen = members.filter((m) => !m.paid).length;
  const sumOffen = members.filter((m) => !m.paid).reduce((s, m) => s + m.total_cents, 0);
  const gesamt = members.reduce((s, m) => s + m.total_cents, 0);

  return (
    <div style={s.root}>
      {/* Topbar */}
      <header style={s.topbar}>
        <div style={s.brandWrap}>
          <span style={s.crest}>⚽</span>
          <span style={s.brand}>Kabinen-Bar <span style={s.brandMuted}>· Verwaltung</span></span>
        </div>
        <div style={s.badgeWrap}>
          <div style={s.badge}><Lock size={12} /> Admin</div>
          <div style={s.adminAvatar}>A</div>
        </div>
      </header>

      {/* Tabs */}
      <div style={s.tabs}>
        {(["drinks", "billing"] as const).map((t) => (
          <button
            key={t}
            style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t === "drinks" ? "Getränke verwalten" : "Abrechnung"}
          </button>
        ))}
      </div>

      <div style={s.content}>
        {/* Tab A: Drinks */}
        {tab === "drinks" && (
          <div>
            <div style={s.tabHeader}>
              <h2 style={s.tabTitle}>Getränke verwalten</h2>
              <span style={s.tabMeta}>{drinks.length} Getränke · {drinks.filter((d) => d.active).length} aktiv · {drinks.filter((d) => !d.active).length} inaktiv</span>
            </div>

            <table style={s.table}>
              <thead>
                <tr>
                  {["Name", "Preis", "Status", "Aktion"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drinks.map((d) => (
                  <tr key={d.id} style={{ opacity: d.active ? 1 : 0.45 }}>
                    <td style={s.td}>{d.name}</td>
                    <td style={s.td}>{formatCents(d.price_cents)}</td>
                    <td style={s.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Toggle on={d.active} onChange={(v) => toggleDrink(d.id, v)} />
                        <span style={{ fontSize: 13, color: d.active ? "#2fa968" : "#5a6473" }}>
                          {d.active ? "Aktiv" : "Inaktiv"}
                        </span>
                      </div>
                    </td>
                    <td style={s.td}>
                      <button style={s.iconBtn}><Pencil size={14} color="#6478a0" /></button>
                    </td>
                  </tr>
                ))}
                {/* Add row */}
                <tr>
                  <td style={s.td}>
                    <input style={s.addInput} placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </td>
                  <td style={s.td}>
                    <input style={s.addInput} placeholder="1,50" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
                  </td>
                  <td style={s.td}>
                    <Toggle on={newActive} onChange={setNewActive} />
                  </td>
                  <td style={s.td}>
                    <button style={s.saveBtn} onClick={addDrink}>Speichern</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Tab B: Billing */}
        {tab === "billing" && (
          <div>
            <div style={s.billingHeader}>
              {/* Period dropdown */}
              <div style={{ position: "relative" }}>
                <button style={s.periodBtn} onClick={() => setPeriodOpen(!periodOpen)}>
                  <span>{MOCK_PERIODS[selPeriod].range}</span>
                  <span style={{ ...s.statusPill, background: selPeriod === 0 ? "rgba(4,104,179,0.16)" : "rgba(100,120,160,0.16)", color: selPeriod === 0 ? "#0468b3" : "#6478a0" }}>
                    {selPeriod === 0 ? "Aktiv" : "Abgeschlossen"}
                  </span>
                  <ChevronDown size={16} color="#5a6473" />
                </button>
                {periodOpen && (
                  <div style={s.dropdown}>
                    {MOCK_PERIODS.map((p, i) => (
                      <button key={p.id} style={s.dropdownItem} onClick={() => { setSelPeriod(i); setPeriodOpen(false); }}>
                        {p.range}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button style={s.newPeriodBtn} onClick={() => setShowNew(!showNew)}>
                <Plus size={14} /> Neue Abrechnung
              </button>
            </div>

            {/* New period form */}
            {showNew && (
              <div style={s.newForm}>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={s.fieldLabel}>Startdatum</label>
                    <input style={s.formInput} type="date" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={s.fieldLabel}>Enddatum</label>
                    <input style={s.formInput} type="date" />
                  </div>
                </div>
                <label style={s.fieldLabel}>Zahlungshinweise</label>
                <textarea style={s.formTextarea} rows={3} placeholder="IBAN, PayPal, Empfänger…" />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                  <button style={s.cancelBtn} onClick={() => setShowNew(false)}>Abbrechen</button>
                  <button style={s.createBtn}>Abrechnung erstellen</button>
                </div>
              </div>
            )}

            {/* Summary bar */}
            <div style={s.summaryBar}>
              {[
                { label: "Mitglieder", value: members.length.toString() },
                { label: "Getränke", value: members.reduce((s, m) => s + m.count, 0).toString() },
                { label: "Bezahlt", value: paid.toString(), color: "#2fa968" },
                { label: "Offen", value: offen.toString(), color: "#d6a23a" },
                { label: "Summe offen", value: formatCents(sumOffen), color: "#d6a23a" },
                { label: "Gesamt", value: formatCents(gesamt) },
              ].map((item) => (
                <div key={item.label} style={s.summaryItem}>
                  <span style={s.summaryLabel}>{item.label}</span>
                  <span style={{ ...s.summaryValue, color: item.color ?? "#eaedf2" }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Member table */}
            <div style={s.memberHeader}>
              {["Mitglied", "Getränke", "Betrag", "Status", "Aktion"].map((h) => (
                <span key={h} style={s.memberHeaderCell}>{h}</span>
              ))}
            </div>
            {members.map((m) => (
              <div key={m.id} style={s.memberCard}>
                <div style={s.memberRow}>
                  <button style={s.chevronBtn} onClick={() => setOpenMember(openMember === m.id ? null : m.id)}>
                    <ChevronRight size={16} color="#5a6473" style={{ transform: openMember === m.id ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                  </button>
                  <div style={s.memberAvatar}>{m.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
                  <span style={s.memberName}>{m.name}</span>
                  <span style={s.memberCount}>{m.count}</span>
                  <span style={s.memberAmount}>{formatCents(m.total_cents)}</span>
                  <span style={{ ...s.pill, ...(m.paid ? s.pillPaid : s.pillOffen) }}>
                    {m.paid ? "Bezahlt" : "Offen"}
                  </span>
                  {m.paid ? (
                    <button style={s.iconBtn} onClick={() => markPaid(m.id, false)}><RotateCcw size={14} color="#5a6473" /></button>
                  ) : (
                    <button style={s.outlineBtn} onClick={() => markPaid(m.id, true)}>Als bezahlt</button>
                  )}
                </div>
                {openMember === m.id && (
                  <div style={s.memberDetail}>
                    <p style={s.detailTitle}>Getrunken in diesem Zeitraum</p>
                    {m.items.map((item, i) => (
                      <div key={i} style={s.detailRow}>
                        <span style={{ fontSize: 14, color: "#eaedf2" }}>{item.count} × {item.drink}</span>
                        <span style={{ fontSize: 13, color: "#939dab" }}>{formatCents(item.price_cents)} / Stk.</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#eaedf2" }}>{formatCents(item.count * item.price_cents)}</span>
                      </div>
                    ))}
                    <div style={{ ...s.detailRow, borderTop: "1px solid rgba(255,255,255,0.12)", marginTop: 4, paddingTop: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#eaedf2" }}>Summe</span>
                      <span />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#eaedf2" }}>{formatCents(m.total_cents)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: "100dvh", background: "#0b0e13", color: "#eaedf2" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  brandWrap: { display: "flex", alignItems: "center", gap: 10 },
  crest: { fontSize: 24 },
  brand: { fontSize: 17, fontWeight: 700, color: "#eaedf2" },
  brandMuted: { color: "#919bab", fontWeight: 400 },
  badgeWrap: { display: "flex", alignItems: "center", gap: 10 },
  badge: { display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(100,120,160,0.16)", border: "1px solid rgba(100,120,160,0.3)", fontSize: 12, fontWeight: 600, color: "#6478a0" },
  adminAvatar: { width: 34, height: 34, borderRadius: 999, background: "#6478a0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" },
  tabs: { display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 28px" },
  tab: { padding: "12px 0", marginRight: 28, background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 500, color: "#5a6473", borderBottom: "2px solid transparent" },
  tabActive: { color: "#6478a0", borderBottom: "2px solid #6478a0" },
  content: { padding: "24px 28px", maxWidth: 960, margin: "0 auto" },
  tabHeader: { marginBottom: 16 },
  tabTitle: { fontSize: 19, fontWeight: 700, color: "#eaedf2", marginBottom: 4 },
  tabMeta: { fontSize: 13, color: "#919bab" },
  table: { width: "100%", borderCollapse: "collapse", background: "#141921", borderRadius: 12, overflow: "hidden" },
  th: { textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5a6473", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  td: { padding: "12px 16px", fontSize: 14, color: "#eaedf2", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  addInput: { background: "#1a202a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", color: "#eaedf2", fontSize: 14, outline: "none", width: "100%" },
  saveBtn: { background: "#6478a0", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" },
  billingHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  periodBtn: {
    display: "flex", alignItems: "center", gap: 8,
    background: "#141921", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "#eaedf2", fontSize: 14,
  },
  statusPill: { borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600 },
  dropdown: {
    position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
    background: "#1a202a", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10, overflow: "hidden", minWidth: 220,
  },
  dropdownItem: { display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", color: "#eaedf2", fontSize: 14 },
  newPeriodBtn: {
    display: "flex", alignItems: "center", gap: 6,
    background: "none", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "#eaedf2", fontSize: 14,
  },
  newForm: { background: "#141921", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16, marginBottom: 16 },
  fieldLabel: { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5a6473", marginBottom: 6 },
  formInput: { width: "100%", background: "#1a202a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px 12px", color: "#eaedf2", fontSize: 14, outline: "none" },
  formTextarea: { width: "100%", background: "#1a202a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px 12px", color: "#eaedf2", fontSize: 14, outline: "none", resize: "vertical" },
  cancelBtn: { background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 16px", color: "#919bab", fontSize: 14, cursor: "pointer" },
  createBtn: { background: "#6478a0", border: "none", borderRadius: 8, padding: "8px 16px", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  summaryBar: { display: "flex", gap: 2, background: "#141921", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden", marginBottom: 16 },
  summaryItem: { flex: 1, padding: "12px 16px", borderRight: "1px solid rgba(255,255,255,0.07)" },
  summaryLabel: { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5a6473", marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: 700 },
  memberHeader: { display: "grid", gridTemplateColumns: "2fr 80px 100px 100px 120px", gap: 0, padding: "8px 16px", marginBottom: 4 },
  memberHeaderCell: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5a6473" },
  memberCard: { background: "#141921", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, marginBottom: 6, overflow: "hidden" },
  memberRow: { display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" },
  chevronBtn: { background: "none", border: "none", cursor: "pointer", padding: 0 },
  memberAvatar: { width: 32, height: 32, borderRadius: 999, background: "#222a36", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#6478a0", flexShrink: 0 },
  memberName: { flex: 1, fontSize: 14, fontWeight: 500 },
  memberCount: { width: 80, fontSize: 14, color: "#919bab" },
  memberAmount: { width: 100, fontSize: 14, fontWeight: 600 },
  pill: { borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600, width: 100, textAlign: "center" },
  pillPaid: { background: "rgba(47,169,104,0.15)", color: "#2fa968" },
  pillOffen: { background: "rgba(214,162,58,0.15)", color: "#d6a23a" },
  outlineBtn: { background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 12px", color: "#eaedf2", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" },
  memberDetail: { padding: "0 16px 14px 58px" },
  detailTitle: { fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5a6473", marginBottom: 10 },
  detailRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" },
};
