"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div style={styles.root}>
      <div style={styles.content}>
        {/* Crest */}
        <div style={styles.crestWrap}>
          <div style={styles.crestPlaceholder}>⚽</div>
        </div>

        <h1 style={styles.title}>Kabinen-Bar</h1>
        <p style={styles.sub}>Getränke-Tracker · TSV Bobingen</p>

        <button style={styles.googleBtn} onClick={handleGoogleLogin}>
          <GoogleIcon />
          Mit Google anmelden
        </button>

        <p style={styles.footnote}>
          Dein Google-Name wird als Anzeigename verwendet.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36.5 24 36.5c-5.2 0-9.6-3.5-11.2-8.2l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
    </svg>
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
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
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
    marginBottom: 40,
  },
  googleBtn: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#fff",
    color: "#1a1a1a",
    border: "none",
    borderRadius: 12,
    padding: "0 24px",
    height: 52,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    justifyContent: "center",
    marginBottom: 16,
  },
  footnote: {
    textAlign: "center",
    fontSize: 12,
    color: "#5c6675",
  },
};
