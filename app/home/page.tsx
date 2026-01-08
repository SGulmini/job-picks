"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Job = {
  id: string;
  title: string;
  company: string;
  location?: string;
  url?: string;
};

export default function HomePage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // Auth gate
  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!data.user) router.push("/login");
        else setEmail(data.user.email ?? null);
      })
      .catch(() => setError("Could not load your account. Please refresh."))
      .finally(() => setAuthLoading(false));
  }, [router]);

  // Load jobs (only after auth is resolved)
  useEffect(() => {
    if (!email) return;

    setJobsLoading(true);
    setError(null);

    fetch("/api/jobs")
      .then((r) => {
        if (!r.ok) throw new Error("Bad response");
        return r.json();
      })
      .then((data) => setJobs(data.jobs ?? []))
      .catch(() => setError("Something went wrong while loading jobs."))
      .finally(() => setJobsLoading(false));
  }, [email]);

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // UX: loading chiaro
  if (authLoading) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        Loading your account…
      </main>
    );
  }

  if (!email) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        Redirecting to login…
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Job Picks</h1>
          <p style={{ margin: "6px 0 0 0" }}>Signed in as: {email}</p>
        </div>

        <button onClick={onLogout} style={{ padding: 10, height: 40 }}>
          Log out
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Today’s picks</h2>

        {/* UX: error chiaro */}
        {error && <p style={{ color: "red" }}>{error}</p>}

        {/* UX: loading chiaro */}
        {jobsLoading && !error && <p>Loading today’s picks…</p>}

        {/* UX: stato vuoto */}
        {!jobsLoading && !error && jobs.length === 0 && (
          <p>No jobs found for today. Check back tomorrow.</p>
        )}

        {/* Lista job */}
        {!jobsLoading && !error && jobs.length > 0 && (
          <ul>
            {jobs.map((job) => (
              <li key={job.id} style={{ marginBottom: 10 }}>
                <b>{job.title}</b> — {job.company}
                {job.location ? <div>{job.location}</div> : null}
                {job.url ? (
                  <a href={job.url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
