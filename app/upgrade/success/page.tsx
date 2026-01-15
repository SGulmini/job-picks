"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function UpgradeSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const sessionId = searchParams.get("session_id");

      if (!sessionId) {
        setError("No session ID provided");
        setLoading(false);
        return;
      }

      try {
        // Verify payment with our API
        const response = await fetch(`/api/verify-payment?session_id=${sessionId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Payment verification failed");
        }

        // Update local profile to premium
        const profileStr = localStorage.getItem("jobProfile");
        if (profileStr) {
          try {
            const profile = JSON.parse(profileStr);
            profile.subscriptionTier = "premium";
            localStorage.setItem("jobProfile", JSON.stringify(profile));
          } catch {
            // Ignore
          }
        }

        // Refresh Supabase session/user so the client sees updated user_metadata
        try {
          await supabase.auth.refreshSession();
        } catch {
          // Ignore
        }

        setLoading(false);
      } catch (err: any) {
        setError(err.message || "An error occurred");
        setLoading(false);
      }
    };

    verifyPayment();
  }, [searchParams]);

  if (loading) {
    return (
      <main style={{ padding: "40px 20px", maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 20 }}>
          Verifying your payment...
        </h1>
        <p style={{ fontSize: 16, color: "#666" }}>Please wait...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: "40px 20px", maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 20, color: "#c00" }}>
          Payment Verification Failed
        </h1>
        <p style={{ fontSize: 16, marginBottom: 30, color: "#666" }}>
          {error}
        </p>
        <Link
          href="/upgrade"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: "#0070f3",
            color: "white",
            textDecoration: "none",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          Try Again
        </Link>
      </main>
    );
  }

  return (
    <main style={{ padding: "40px 20px", maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 10 }}>
        Welcome to Premium!
      </h1>
      <p style={{ fontSize: 16, marginBottom: 30, color: "#666" }}>
        Your subscription is now active. You'll receive 3 personalized job recommendations every day.
      </p>
      <Link
        href="/home"
        style={{
          display: "inline-block",
          padding: "14px 28px",
          backgroundColor: "#0070f3",
          color: "white",
          textDecoration: "none",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        View Your Jobs
      </Link>
    </main>
  );
}
