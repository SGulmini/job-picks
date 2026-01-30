"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  // Redirect if already authenticated: always go to /home first.
  // /home will redirect to /profile only if the profile is missing/invalid.
  useEffect(() => {
    // Helper function to check if we're logging out
    const isLoggingOut = () => {
      const ssFlag = sessionStorage.getItem('jobpicks_logging_out');
      const lsFlag = localStorage.getItem('jobpicks_logging_out');
      const cookieFlag = document.cookie.includes('jobpicks_logging_out=');
      const urlFlag = new URLSearchParams(window.location.search).get('logout');
      return !!(ssFlag || lsFlag || cookieFlag || urlFlag);
    };
    
    // Clear logout flags when on login page (check all storage locations)
    sessionStorage.removeItem('jobpicks_logging_out');
    localStorage.removeItem('jobpicks_logging_out');
    document.cookie = 'jobpicks_logging_out=; path=/; max-age=0';
    
    // Clean URL if it has logout parameter
    const url = new URL(window.location.href);
    if (url.searchParams.has('logout')) {
      url.searchParams.delete('logout');
      window.history.replaceState({}, '', url.toString());
    }
    
    // Add a longer delay on mobile to ensure logout has completed
    // Mobile browsers can be slower to process storage operations
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const delay = isMobile ? 1500 : 600; // Longer delay on mobile
    
    const checkSession = async () => {
      // Wait to ensure any logout operations have completed (longer on mobile)
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Don't redirect if we just logged out (check all storage locations)
      if (isLoggingOut()) {
        // Clear any remaining flags after a bit more time
        setTimeout(() => {
          sessionStorage.removeItem('jobpicks_logging_out');
          localStorage.removeItem('jobpicks_logging_out');
          document.cookie = 'jobpicks_logging_out=; path=/; max-age=0';
        }, isMobile ? 2000 : 1000);
        return;
      }
      
      // Double-check session is actually cleared before redirecting
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Only redirect if we're not logging out
        if (!isLoggingOut()) {
          router.replace("/home");
        }
      }
    };
    
    checkSession();

    // Handle email confirmation callback
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (type === 'signup' && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error) {
          // Sync candidate profile from localStorage to Supabase (if exists)
          try {
            const { syncCandidateProfileToSupabase } = await import("@/lib/candidateProfile");
            await syncCandidateProfileToSupabase();
          } catch (error) {
            console.error("Error syncing candidate profile:", error);
            // Continue anyway - not critical
          }
          router.replace("/home");
        }
      }
    };

    handleAuthCallback();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up with email verification
        // Use NEXT_PUBLIC_BASE_URL if available (production), otherwise use current origin (development)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
        const redirectUrl = `${baseUrl}/home`;
        
        console.log("Attempting sign up with:", {
          email,
          redirectUrl,
          baseUrl,
          origin: window.location.origin,
          envBaseUrl: process.env.NEXT_PUBLIC_BASE_URL
        });

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });

        console.log("Sign up response:", { 
          hasData: !!data, 
          hasUser: !!data?.user, 
          hasSession: !!data?.session,
          error: signUpError 
        });

        if (signUpError) {
          // Log full error details
          console.error("Sign up error details:", {
            message: signUpError.message,
            status: signUpError.status,
            name: signUpError.name,
            fullError: signUpError
          });
          
          // Handle email sending errors specifically
          if (signUpError.message.includes("confirmation email") || 
              signUpError.message.includes("sending") ||
              signUpError.message.includes("email") ||
              signUpError.message.includes("SMTP")) {
            setError(
              "Unable to send verification email.\n\n" +
              "Please verify in Supabase Dashboard:\n" +
              "1. Settings → Auth → SMTP Settings → Enable SMTP\n" +
              "2. SMTP Host, Port, Username, Password are correct\n" +
              "3. Test the SMTP connection\n" +
              "4. Check Auth → URL Configuration → Site URL and Redirect URLs\n\n" +
              "Technical error: " + signUpError.message
            );
          } else {
            setError(signUpError.message);
          }
          setLoading(false);
          return;
        }

        // Check if user was created even if email failed
        if (data?.user && !data.session) {
          console.log("User created but no session - email verification required");
        }

        // Check if session was created immediately (email verification disabled)
        if (data.session) {
          router.push("/home");
          return;
        }

        // Email verification required - show success message
        if (data.user) {
          setError(null);
          setLoading(false);
          setSignUpSuccess(true);
          // Don't switch to sign in mode yet - let user see the success message
        } else {
          setError("Account creation failed. Please try again.");
          setLoading(false);
        }
      } else {
        // Sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }

        // Sync candidate profile from localStorage to Supabase (if exists)
        try {
          const { syncCandidateProfileToSupabase } = await import("@/lib/candidateProfile");
          await syncCandidateProfileToSupabase();
        } catch (error) {
          console.error("Error syncing candidate profile:", error);
          // Continue anyway - not critical
        }

        // Success: always go to /home first.
        router.push("/home");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 400, margin: "0 auto" }}>
      <h1>{isSignUp ? "Sign up" : "Sign in"}</h1>
      <p>{isSignUp ? "Create a new account" : "Enter your email and password"}</p>

      <form onSubmit={onSubmit} style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            required
            style={{ padding: 10, width: "100%", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={6}
            style={{ padding: 10, width: "100%", boxSizing: "border-box" }}
          />
        </div>

        {error && <p style={{ color: "red", marginBottom: 12 }}>{error}</p>}
        
        {signUpSuccess && (
          <div style={{ 
            background: "#e8f5e9", 
            border: "1px solid #4caf50", 
            borderRadius: 4, 
            padding: 12, 
            marginBottom: 12,
            color: "#2e7d32"
          }}>
            <p style={{ margin: 0, fontWeight: "bold" }}>Account created successfully!</p>
            <p style={{ margin: "8px 0 0 0", fontSize: 14 }}>
              Please check your email ({email}) and click the verification link to activate your account.
            </p>
            <p style={{ margin: "8px 0 0 0", fontSize: 14 }}>
              After verification, you can sign in with your email and password.
            </p>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              padding: 10, 
              width: "100%",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? "Loading..." : (isSignUp ? "Sign up" : "Sign in")}
          </button>
        </div>

        <div style={{ textAlign: "center" }}>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setSignUpSuccess(false);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#666",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {isSignUp 
              ? "Already have an account? Sign in" 
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </form>
    </main>
  );
}
