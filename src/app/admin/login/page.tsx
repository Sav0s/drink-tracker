"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, AtSign, Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);
  const [focusUser, setFocusUser] = useState(false);
  const [focusPass, setFocusPass] = useState(false);

  const canSubmit = user.trim() !== "" && pass.trim() !== "";

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    // TODO: real auth via Supabase
    if (user === "admin" && pass === "admin") {
      router.push("/admin/dashboard");
    } else {
      setError(true);
    }
  }

  return (
    <div style={s.root}>
      <form style={s.form} onSubmit={handleLogin}>
        {/* Crest */}
        <div style={s.crest}>⚽</div>

        {/* Badge */}
        <div style={s.badge}>
          <Lock size={12} color="#6478a0" />
          <span>Admin-Bereich</span>
        </div>

        <h1 style={s.title}>Kabinen-Bar</h1>
        <p style={s.sub}>Verwaltung</p>

        {/* Error banner */}
        {error && (
          <div style={s.errorBanner}>
            <Lock size={14} color="#e0535f" />
            <span>Benutzername oder Passwort falsch.</span>
          </div>
        )}

        {/* Username */}
        <div
          style={{
            ...s.inputWrap,
            ...(error ? s.inputError : {}),
            ...(focusUser ? s.inputFocus : {}),
          }}
        >
          <AtSign size={16} color="#5a6473" />
          <input
            style={s.input}
            placeholder="Benutzername"
            value={user}
            onChange={(e) => { setUser(e.target.value); setError(false); }}
            onFocus={() => setFocusUser(true)}
            onBlur={() => setFocusUser(false)}
            autoComplete="username"
          />
        </div>

        {/* Password */}
        <div
          style={{
            ...s.inputWrap,
            ...(error ? s.inputError : {}),
            ...(focusPass ? s.inputFocus : {}),
          }}
        >
          <Lock size={16} color="#5a6473" />
          <input
            style={s.input}
            type={show ? "text" : "password"}
            placeholder="Passwort"
            value={pass}
            onChange={(e) => { setPass(e.target.value); setError(false); }}
            onFocus={() => setFocusPass(true)}
            onBlur={() => setFocusPass(false)}
            autoComplete="current-password"
          />
          <button type="button" style={s.eyeBtn} onClick={() => setShow(!show)}>
            {show ? <EyeOff size={16} color="#5a6473" /> : <Eye size={16} color="#5a6473" />}
          </button>
        </div>

        <button
          type="submit"
          style={{ ...s.cta, ...(canSubmit ? s.ctaEnabled : s.ctaDisabled) }}
          disabled={!canSubmit}
        >
          <Lock size={16} />
          Als Admin einloggen
        </button>

        <p style={s.note}>Nur für Vereinsverwaltung · Zugang über den Vorstand.</p>
      </form>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100dvh",
    background: "#0b0e13",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  form: {
    width: "100%",
    maxWidth: 380,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  crest: {
    width: 76, height: 76, borderRadius: 999,
    background: "#1a202a",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 32, marginBottom: 8,
  },
  badge: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "4px 12px", borderRadius: 999,
    background: "rgba(100,120,160,0.16)", border: "1px solid rgba(100,120,160,0.3)",
    fontSize: 12, fontWeight: 600, color: "#6478a0", letterSpacing: "0.05em",
  },
  title: { fontSize: 25, fontWeight: 800, letterSpacing: "-0.5px", color: "#eaedf2", marginTop: 4 },
  sub: { fontSize: 14, color: "#919bab", marginBottom: 8 },
  errorBanner: {
    width: "100%", display: "flex", alignItems: "center", gap: 8,
    padding: "10px 14px", borderRadius: 10,
    background: "rgba(224,83,95,0.14)", border: "1px solid rgba(224,83,95,0.3)",
    fontSize: 13, color: "#e0535f",
  },
  inputWrap: {
    width: "100%", display: "flex", alignItems: "center", gap: 10,
    background: "#141921", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12, padding: "0 14px", height: 52,
    transition: "border-color 0.12s, box-shadow 0.12s",
  },
  inputFocus: {
    borderColor: "#6478a0",
    boxShadow: "0 0 0 3px rgba(100,120,160,0.16)",
  },
  inputError: {
    borderColor: "#e0535f",
    boxShadow: "0 0 0 3px rgba(224,83,95,0.14)",
  },
  input: { flex: 1, background: "transparent", border: "none", outline: "none", color: "#eaedf2", fontSize: 15 },
  eyeBtn: { background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" },
  cta: {
    width: "100%", height: 52, borderRadius: 12,
    fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 4,
  },
  ctaEnabled: {
    background: "#6478a0", color: "#fff",
    boxShadow: "0 8px 20px -8px rgba(100,120,160,0.6)",
  },
  ctaDisabled: { background: "#1a202a", color: "#5a6473", cursor: "not-allowed" },
  note: { fontSize: 12, color: "#5a6473", textAlign: "center", maxWidth: 280 },
};
