"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin/dashboard`,
      },
    });
    if (error) {
      setError("Anmeldung fehlgeschlagen.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0b0e13] px-5">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-[#6478a0]/20 border border-[#6478a0]/30 flex items-center justify-center text-3xl mb-5">
          🛡️
        </div>

        <h1 className="text-[24px] font-extrabold tracking-tight text-[#eaedf2] mb-1.5">
          Admin-Bereich
        </h1>
        <p className="text-sm text-[#939dab] mb-10">
          Kabinen-Bar · TSV Bobingen
        </p>

        {error && (
          <div className="w-full mb-4 px-4 py-3 rounded-xl bg-[#e0535f]/10 border border-[#e0535f]/30 text-[#e0535f] text-sm text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full h-13 flex items-center justify-center gap-3 bg-white text-[#1a1a1a] font-semibold text-[15px] rounded-xl cursor-pointer hover:bg-gray-100 transition-colors disabled:opacity-60"
        >
          <GoogleIcon />
          {loading ? "Weiterleitung…" : "Mit Google anmelden"}
        </button>

        <p className="mt-4 text-xs text-[#5c6675] text-center">
          Nur Admins haben Zugang zu diesem Bereich.
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
