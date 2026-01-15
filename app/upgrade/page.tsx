"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function UpgradePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [currentTier, setCurrentTier] = useState<"free" | "premium">("free");

  useEffect(() => {
    // Get current user
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setUserEmail(session.user.email || "");

      // Source of truth: Supabase user_metadata
      const metaTier = (session.user.user_metadata?.subscriptionTier as
        | "free"
        | "premium"
        | undefined) ?? "free";
      setCurrentTier(metaTier);

      // Fallback: local profile (only if metadata missing)
      if (metaTier === "free") {
        const profileStr = localStorage.getItem("jobProfile");
        if (profileStr) {
          try {
            const profile = JSON.parse(profileStr);
            if (profile.subscriptionTier === "premium") {
              setCurrentTier("premium");
            }
          } catch {
            // Ignore
          }
        }
      }
    };

    run();
  }, [router]);

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Please log in to upgrade");
        setLoading(false);
        return;
      }

      // Create Stripe checkout session
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: session.user.id,
          userEmail: session.user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (currentTier === "premium") {
    return (
      <main style={{ padding: "40px 20px", maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 20 }}>
          You're already Premium! 🎉
        </h1>
        <p style={{ fontSize: 16, marginBottom: 30, color: "#666" }}>
          You're already subscribed to our premium plan. Enjoy your 3 daily job recommendations!
        </p>
        <Link
          href="/home"
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
          Go to Home
        </Link>
      </main>
    );
  }

  return (
    <main style={{ padding: "40px 20px", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 10 }}>
        Upgrade to Premium
      </h1>
      <p style={{ fontSize: 16, marginBottom: 30, color: "#666" }}>
        Get 3 personalized job recommendations every day instead of just 1.
      </p>

      <div
        style={{
          border: "2px solid #0070f3",
          borderRadius: 12,
          padding: 30,
          marginBottom: 30,
          backgroundColor: "#f8f9fa",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 10 }}>
            Premium Plan
          </h2>
          <div style={{ fontSize: 36, fontWeight: 700, color: "#0070f3", marginBottom: 5 }}>
            €1<span style={{ fontSize: 18, fontWeight: 400 }}>/month</span>
          </div>
        </div>

        <ul style={{ listStyle: "none", padding: 0, marginBottom: 20 }}>
          <li style={{ padding: "8px 0", fontSize: 16 }}>
            ✓ <strong>3 job recommendations</strong> per day (instead of 1)
          </li>
          <li style={{ padding: "8px 0", fontSize: 16 }}>
            ✓ Same high-quality matching algorithm
          </li>
          <li style={{ padding: "8px 0", fontSize: 16 }}>
            ✓ Cancel anytime
          </li>
        </ul>

        {error && (
          <div
            style={{
              padding: 12,
              backgroundColor: "#fee",
              color: "#c00",
              borderRadius: 8,
              marginBottom: 20,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleUpgrade}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px 24px",
            backgroundColor: loading ? "#ccc" : "#0070f3",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Processing..." : "Upgrade to Premium - €1/month"}
        </button>
      </div>

      <div style={{ textAlign: "center", marginTop: 30 }}>
        <Link
          href="/home"
          style={{
            color: "#666",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}
