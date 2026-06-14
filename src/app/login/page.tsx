"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, Check, X } from "lucide-react";

const MOCK_PLAYERS = [
  "Andreas Müller",
  "Benedikt Schmid",
  "Christian Wagner",
  "David Bauer",
  "Emanuel Huber",
  "Florian Maier",
  "Georg Schneider",
  "Hans-Peter Klein",
  "Jonas Fischer",
  "Kevin Lehmann",
  "Lukas Zimmermann",
  "Markus Wolf",
];

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function LoginPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      MOCK_PLAYERS.filter((p) =>
        p.toLowerCase().includes(query.toLowerCase())
      ),
    [query]
  );

  function handleLogin() {
    if (!selected) return;
    sessionStorage.setItem("player", selected);
    router.push("/home");
  }

  const firstName = selected?.split(" ")[0];

  return (
    <div style={styles.root}>
      <div style={styles.content}>
        {/* Crest */}
        <div style={styles.crestWrap}>
          <div style={styles.crestPlaceholder}>⚽</div>
        </div>

        <h1 style={styles.title}>Kabinen-Bar</h1>
        <p style={styles.sub}>Getränke-Tracker · TSV Bobingen</p>

        <label style={styles.fieldLabel}>DEIN NAME</label>

        {/* Search input */}
        <div style={styles.inputWrap}>
          <Search size={16} color="#5c6675" style={{ flexShrink: 0 }} />
          <input
            style={styles.input}
            placeholder="Suche deinen Namen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button style={styles.clearBtn} onClick={() => setQuery("")}>
              <X size={14} color="#5c6675" />
            </button>
          )}
        </div>

        {/* Roster */}
        <div style={styles.roster}>
          {filtered.map((player) => {
            const isSelected = selected === player;
            return (
              <button
                key={player}
                style={{
                  ...styles.rosterRow,
                  ...(isSelected ? styles.rosterRowSelected : {}),
                }}
                onClick={() => setSelected(player)}
              >
                <div
                  style={{
                    ...styles.avatar,
                    ...(isSelected ? styles.avatarSelected : {}),
                  }}
                >
                  {initials(player)}
                </div>
                <span style={styles.playerName}>{player}</span>
                {isSelected && (
                  <Check size={16} color="#0468b3" style={{ marginLeft: "auto" }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pinned CTA */}
      <div style={styles.footer}>
        <button
          style={{
            ...styles.cta,
            ...(selected ? styles.ctaEnabled : styles.ctaDisabled),
          }}
          disabled={!selected}
          onClick={handleLogin}
        >
          {selected ? `Einloggen als ${firstName}` : "Einloggen"}
        </button>
        <p style={styles.footnote}>Dein Name wird als Login verwendet.</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    background: "#0d1014",
    padding: "0 20px",
  },
  content: {
    flex: 1,
    paddingTop: 48,
    paddingBottom: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    overflow: "hidden",
  },
  crestWrap: { marginBottom: 20 },
  crestPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 999,
    background: "#1b212b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 36,
  },
  title: {
    fontSize: 27,
    fontWeight: 800,
    letterSpacing: "-0.5px",
    color: "#eaedf2",
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    color: "#939dab",
    marginBottom: 32,
  },
  fieldLabel: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#5c6675",
    marginBottom: 8,
  },
  inputWrap: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#151a21",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: "0 14px",
    height: 52,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#eaedf2",
    fontSize: 15,
  },
  clearBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
  },
  roster: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
    overflowY: "auto",
  },
  rosterRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid transparent",
    background: "transparent",
    cursor: "pointer",
    transition: "background 0.12s",
    color: "#eaedf2",
  },
  rosterRowSelected: {
    background: "rgba(4,104,179,0.16)",
    border: "1px solid #0468b3",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    background: "#222934",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    color: "#939dab",
    flexShrink: 0,
  },
  avatarSelected: {
    background: "#0468b3",
    color: "#fff",
  },
  playerName: {
    fontSize: 15,
    fontWeight: 500,
  },
  footer: {
    paddingBottom: 32,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  cta: {
    width: "100%",
    height: 52,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
    transition: "box-shadow 0.15s, background 0.15s",
  },
  ctaEnabled: {
    background: "#0468b3",
    color: "#fff",
    boxShadow: "0 8px 20px -8px rgba(4,104,179,0.7)",
  },
  ctaDisabled: {
    background: "#1b212b",
    color: "#5c6675",
    cursor: "not-allowed",
  },
  footnote: {
    textAlign: "center",
    fontSize: 12,
    color: "#5c6675",
  },
};
