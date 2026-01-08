"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSend() {
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "http://localhost:3000/home",
      },
    });

    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Sign in</h1>
      <p>Enter your email to receive a link.</p>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        style={{ padding: 10, width: 320 }}
      />

      <div style={{ marginTop: 12 }}>
        <button onClick={onSend} style={{ padding: 10 }}>
          Send link
        </button>
      </div>

      {sent && <p>Check your inbox and click the link.</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </main>
  );
}
