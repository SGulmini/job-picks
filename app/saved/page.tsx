"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { extractJobMetaFromDescription } from "@/lib/jobPostingMeta";

type SavedJob = {
  id: string;
  title: string;
  company: string;
  location?: string;
  url?: string;
  description?: string;
  salaryMin?: number;
  salaryMax?: number;
  created?: string;
  savedAt: string;
};

const SAVED_JOBS_KEY = "jobPicks_savedJobs_v1";
const COVER_LETTERS_KEY = "jobPicks_coverLetters_v2";
const CANDIDATE_KEY = "jobPicks_candidate_v1";

type CoverLetterCache = Record<
  string,
  {
    text: string;
    textShort?: string | null;
    textVeryShort?: string | null;
    textCreative?: string | null;
    createdAt: string;
    lang?: "auto" | "en";
  }
>;

function readSavedJobs(): SavedJob[] {
  try {
    const raw = localStorage.getItem(SAVED_JOBS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedJobs(items: SavedJob[]) {
  try {
    localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function readCoverLetterCache(): CoverLetterCache {
  try {
    const raw = localStorage.getItem(COVER_LETTERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCoverLetterCache(cache: CoverLetterCache) {
  try {
    localStorage.setItem(COVER_LETTERS_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

async function hasCandidateProfile(): Promise<boolean> {
  const { hasCandidateProfile: check } = await import("@/lib/candidateProfile");
  return check();
}

async function readCandidateProfile(): Promise<any | null> {
  const { loadCandidateProfile } = await import("@/lib/candidateProfile");
  return loadCandidateProfile();
}

export default function SavedJobsPage() {
  // Next.js production build requires useSearchParams() to be under a Suspense boundary.
  return (
    <Suspense fallback={<main className="jp-page">Loading…</main>}>
      <SavedJobsPageInner />
    </Suspense>
  );
}

function SavedJobsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<SavedJob[]>([]);
  const [coverLetterById, setCoverLetterById] = useState<Record<string, string>>({});
  const [coverLetterShortById, setCoverLetterShortById] = useState<Record<string, string>>({});
  const [coverLetterVeryShortById, setCoverLetterVeryShortById] = useState<Record<string, string>>({});
  const [coverLetterCreativeById, setCoverLetterCreativeById] = useState<Record<string, string>>({});
  const [selectedCoverLetterVersion, setSelectedCoverLetterVersion] = useState<
    Record<string, "long" | "short" | "very_short" | "creative">
  >({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [coverLetterLangModalOpen, setCoverLetterLangModalOpen] = useState(false);
  const [coverLetterLangModalJob, setCoverLetterLangModalJob] = useState<SavedJob | null>(null);

  useEffect(() => {
    const saved = readSavedJobs();
    setItems(saved);
    const cache = readCoverLetterCache();
    const initial: Record<string, string> = {};
    const initialShort: Record<string, string> = {};
    const initialVeryShort: Record<string, string> = {};
    const initialCreative: Record<string, string> = {};
    for (const j of saved) {
      const id = String(j.id);
      const cached = cache[id];
      if (cached?.text) initial[id] = cached.text;
      if (cached?.textShort) initialShort[id] = cached.textShort;
      if (cached?.textVeryShort) initialVeryShort[id] = cached.textVeryShort;
      if (cached?.textCreative) initialCreative[id] = cached.textCreative;
    }
    setCoverLetterById(initial);
    setCoverLetterShortById(initialShort);
    setCoverLetterVeryShortById(initialVeryShort);
    setCoverLetterCreativeById(initialCreative);
  }, []);

  // If coming back from setup, auto-generate for the requested job id.
  useEffect(() => {
    const targetId = searchParams.get("generateCoverLetterFor");
    if (!targetId) return;
    const lang = (searchParams.get("generateCoverLetterLang") as "auto" | "en" | null) || "auto";
    const job = items.find((j) => String(j.id) === String(targetId));
    if (!job) return;
    generate(job, lang);
    router.replace("/saved");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, searchParams]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
  }, [items]);

  const removeOne = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((j) => String(j.id) !== String(id));
      writeSavedJobs(next);
      return next;
    });
  };

  const clearAll = () => {
    setItems([]);
    writeSavedJobs([]);
  };

  const generate = async (job: SavedJob, preferredLanguage: "auto" | "en" = "auto") => {
    const id = String(job.id);
    setErrorById((p) => ({ ...p, [id]: "" }));

    const hasProfile = await hasCandidateProfile();
    if (!hasProfile) {
      router.push(
        `/cover-letter/setup?returnTo=${encodeURIComponent("/saved")}&jobId=${encodeURIComponent(id)}&lang=${encodeURIComponent(preferredLanguage)}`
      );
      return;
    }

    const cache = readCoverLetterCache();
    if (cache[id]?.text && cache[id]?.lang === preferredLanguage) {
      const cached = cache[id];
      setCoverLetterById((p) => ({ ...p, [id]: cached.text }));
      if (cached.textShort) {
        setCoverLetterShortById((p) => ({ ...p, [id]: cached.textShort! }));
      }
      if (cached.textVeryShort) {
        setCoverLetterVeryShortById((p) => ({ ...p, [id]: cached.textVeryShort! }));
      }
      if (cached.textCreative) {
        setCoverLetterCreativeById((p) => ({ ...p, [id]: cached.textCreative! }));
      }
      if (!selectedCoverLetterVersion[id]) {
        setSelectedCoverLetterVersion((p) => ({ ...p, [id]: "long" }));
      }
      return;
    }

    setLoadingId(id);
    try {
      const profileStr = localStorage.getItem("jobProfile");
      const profile = profileStr ? JSON.parse(profileStr) : null;
      const candidate = await readCandidateProfile();

      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job: {
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            url: job.url,
            description: job.description,
          },
          profile,
          candidate,
          preferredLanguage,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msgParts = [
          data?.error || "Failed to generate cover letter",
          data?.hint ? `Hint: ${data.hint}` : "",
        ].filter(Boolean);
        throw new Error(msgParts.join("\n"));
      }

      const text = typeof data.coverLetter === "string" ? data.coverLetter : "";
      if (!text) throw new Error("Empty cover letter received");

      const textShort = typeof data.coverLetterShort === "string" ? data.coverLetterShort : null;
      const textVeryShort =
        typeof data.coverLetterVeryShort === "string" ? data.coverLetterVeryShort : null;
      const textCreative = typeof data.coverLetterCreative === "string" ? data.coverLetterCreative : null;

      setCoverLetterById((p) => ({ ...p, [id]: text }));
      if (textShort) {
        setCoverLetterShortById((p) => ({ ...p, [id]: textShort }));
      }
      if (textVeryShort) {
        setCoverLetterVeryShortById((p) => ({ ...p, [id]: textVeryShort }));
      }
      if (textCreative) {
        setCoverLetterCreativeById((p) => ({ ...p, [id]: textCreative }));
      }
      setSelectedCoverLetterVersion((p) => ({ ...p, [id]: "long" }));

      const nextCache: CoverLetterCache = {
        ...cache,
        [id]: {
          text,
          textShort: textShort || undefined,
          textVeryShort: textVeryShort || undefined,
          textCreative: textCreative || undefined,
          createdAt: new Date().toISOString(),
          lang: preferredLanguage,
        },
      };
      writeCoverLetterCache(nextCache);
    } catch (e: any) {
      setErrorById((p) => ({ ...p, [id]: e?.message || "Failed to generate cover letter" }));
    } finally {
      setLoadingId(null);
    }
  };

  const copy = async (id: string) => {
    const version = selectedCoverLetterVersion[id] || "long";
    const text =
      version === "very_short"
        ? coverLetterVeryShortById[id] || coverLetterShortById[id] || coverLetterById[id]
        : version === "short"
        ? coverLetterShortById[id] || coverLetterById[id]
        : coverLetterById[id];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const downloadDocx = async (job: SavedJob) => {
    const id = String(job.id);
    const version = selectedCoverLetterVersion[id] || "long";
    const text =
      version === "very_short"
        ? coverLetterVeryShortById[id] || coverLetterShortById[id] || coverLetterById[id]
        : version === "short"
        ? coverLetterShortById[id] || coverLetterById[id]
        : coverLetterById[id];
    if (!text) return;
    try {
      const fileName = `Cover letter - ${job.company || "Company"} - ${job.title || "Role"}`;
      const res = await fetch("/api/cover-letter-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, fileName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to download .docx");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  return (
    <main className="jp-page" style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="jp-topbar">
        <div>
          <h1 style={{ margin: 0 }}>Saved jobs</h1>
          <p style={{ margin: "6px 0 0 0", opacity: 0.75, fontSize: 13 }}>
            Positions you saved to apply later (even on another day).
          </p>
        </div>
        <div className="jp-topbar-actions">
          <Link
            href="/home"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--jp-panel-border)",
              backgroundColor: "var(--jp-panel-bg)",
              color: "var(--jp-panel-fg)",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            ← Back to picks
          </Link>
          <Link
            href={`/cover-letter/setup?returnTo=${encodeURIComponent("/saved")}`}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--jp-panel-border)",
              backgroundColor: "var(--jp-panel-bg)",
              color: "var(--jp-panel-fg)",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
            aria-label="CV and cover letter setup"
            title="CV and cover letter setup"
          >
            CV
          </Link>
          <button
            onClick={clearAll}
            disabled={sorted.length === 0}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--jp-panel-border)",
              backgroundColor: "transparent",
              color: "var(--jp-panel-fg)",
              fontWeight: 700,
              fontSize: 13,
              cursor: sorted.length === 0 ? "not-allowed" : "pointer",
              opacity: sorted.length === 0 ? 0.5 : 0.9,
              whiteSpace: "nowrap",
            }}
          >
            Clear all
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        {sorted.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              border: "1px solid var(--jp-panel-border)",
              backgroundColor: "var(--jp-panel-bg)",
              color: "var(--jp-panel-fg)",
              opacity: 0.9,
            }}
          >
            No saved jobs yet. On the picks page, use “Save for later”.
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {sorted.map((job) => (
              <li
                key={job.id}
                style={{
                  marginBottom: 14,
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid var(--jp-panel-border)",
                  backgroundColor: "var(--jp-panel-bg)",
                  color: "var(--jp-panel-fg)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>
                      {job.title}
                    </div>
                    <div style={{ marginTop: 6, opacity: 0.85 }}>{job.company}</div>
                    {(() => {
                      const meta = extractJobMetaFromDescription(job.description);
                      const showLang = meta.language && meta.language !== "N/A";
                      const showAct = meta.activityRate && meta.activityRate !== "N/A";
                      if (!showLang && !showAct) return null;
                      return (
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {showLang && (
                            <div
                              style={{
                                padding: "4px 8px",
                                borderRadius: 999,
                                border: "1px solid var(--jp-panel-border)",
                                backgroundColor: "var(--jp-input-bg)",
                                color: "var(--jp-input-fg)",
                                fontSize: 12,
                                fontWeight: 800,
                              }}
                            >
                              Language: {meta.language}
                            </div>
                          )}
                          {showAct && (
                            <div
                              style={{
                                padding: "4px 8px",
                                borderRadius: 999,
                                border: "1px solid var(--jp-panel-border)",
                                backgroundColor: "var(--jp-input-bg)",
                                color: "var(--jp-input-fg)",
                                fontSize: 12,
                                fontWeight: 800,
                              }}
                            >
                              Activity: {meta.activityRate}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {job.location && (
                      <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>📍 {job.location}</div>
                    )}
                    <div style={{ marginTop: 8, opacity: 0.65, fontSize: 12 }}>
                      Saved: {new Date(job.savedAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="jp-job-actions" style={{ justifyContent: "flex-end" }}>
                    <a
                      href={job.url || "#"}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={async (e) => {
                        // If the URL contains adzuna.com, try to resolve it to the final destination
                        if (job.url && (job.url.includes('adzuna.com') || job.url.includes('adzuna.co.uk'))) {
                          e.preventDefault();
                          try {
                            const response = await fetch(`/api/resolve-job-url?url=${encodeURIComponent(job.url)}`);
                            const data = await response.json();
                            if (data.url && !data.isAdzunaRedirect) {
                              // Open the resolved direct URL
                              window.open(data.url, '_blank', 'noopener,noreferrer');
                            } else {
                              // If we can't resolve it, just open the original URL
                              window.open(job.url, '_blank', 'noopener,noreferrer');
                            }
                          } catch (error) {
                            // If resolution fails, open the original URL
                            console.error('Failed to resolve job URL:', error);
                            window.open(job.url, '_blank', 'noopener,noreferrer');
                          }
                        }
                        // If it's not an Adzuna URL, let the default link behavior proceed
                      }}
                      style={{
                        display: "inline-block",
                        padding: "8px 14px",
                        background: "linear-gradient(180deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))",
                        color: "white",
                        textDecoration: "none",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 800,
                        border: "1px solid var(--jp-panel-border)",
                        boxShadow: "var(--jp-shadow)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      View position →
                    </a>
                    <button
                      onClick={() => removeOne(job.id)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid var(--jp-panel-border)",
                        backgroundColor: "transparent",
                        color: "var(--jp-panel-fg)",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: "pointer",
                        opacity: 0.9,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => {
                        setCoverLetterLangModalJob(job);
                        setCoverLetterLangModalOpen(true);
                      }}
                      disabled={loadingId === String(job.id)}
                      className="jp-primary-action"
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: "1px solid var(--jp-panel-border)",
                        background: "linear-gradient(180deg, rgba(168,85,247,0.95), rgba(79,70,229,0.95))",
                        color: "white",
                        fontSize: 13,
                        fontWeight: 900,
                        cursor: loadingId === String(job.id) ? "not-allowed" : "pointer",
                        opacity: loadingId === String(job.id) ? 0.65 : 1,
                        boxShadow: "var(--jp-shadow)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {loadingId === String(job.id) ? "Generating..." : "Generate cover letter"}
                    </button>
                  </div>
                </div>

                {job.description && (
                  <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
                    {job.description.substring(0, 220)}
                    {job.description.length > 220 && "..."}
                  </div>
                )}

                {!!errorById[String(job.id)] && (
                  <div style={{ marginTop: 10, color: "#ef4444", fontWeight: 700, fontSize: 13 }}>
                    {errorById[String(job.id)]}
                  </div>
                )}

                {!!coverLetterById[String(job.id)] && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid var(--jp-panel-border)",
                      backgroundColor: "rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>Cover letter</div>
                      {(coverLetterShortById[String(job.id)] ||
                        coverLetterVeryShortById[String(job.id)] ||
                        coverLetterCreativeById[String(job.id)]) && (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <button
                            onClick={() => setSelectedCoverLetterVersion((prev) => ({ ...prev, [String(job.id)]: "long" }))}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 8,
                              border: "1px solid var(--jp-panel-border)",
                              backgroundColor: (selectedCoverLetterVersion[String(job.id)] || "long") === "long" 
                                ? "rgba(168,85,247,0.2)" 
                                : "transparent",
                              color: "var(--jp-panel-fg)",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              opacity: 0.9,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Long
                          </button>
                          {coverLetterShortById[String(job.id)] && (
                            <button
                              onClick={() => setSelectedCoverLetterVersion((prev) => ({ ...prev, [String(job.id)]: "short" }))}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 8,
                                border: "1px solid var(--jp-panel-border)",
                                backgroundColor: selectedCoverLetterVersion[String(job.id)] === "short" 
                                  ? "rgba(168,85,247,0.2)" 
                                  : "transparent",
                                color: "var(--jp-panel-fg)",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                opacity: 0.9,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Short
                            </button>
                          )}
                          {coverLetterVeryShortById[String(job.id)] && (
                            <button
                              onClick={() => setSelectedCoverLetterVersion((prev) => ({ ...prev, [String(job.id)]: "very_short" }))}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 8,
                                border: "1px solid var(--jp-panel-border)",
                                backgroundColor: selectedCoverLetterVersion[String(job.id)] === "very_short" 
                                  ? "rgba(168,85,247,0.2)" 
                                  : "transparent",
                                color: "var(--jp-panel-fg)",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                opacity: 0.9,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Very short
                            </button>
                          )}
                          {coverLetterCreativeById[String(job.id)] && (
                            <button
                              onClick={() => setSelectedCoverLetterVersion((prev) => ({ ...prev, [String(job.id)]: "creative" }))}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 8,
                                border: "1px solid var(--jp-panel-border)",
                                backgroundColor: selectedCoverLetterVersion[String(job.id)] === "creative" 
                                  ? "rgba(251,146,60,0.2)" 
                                  : "transparent",
                                color: "var(--jp-panel-fg)",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                opacity: 0.9,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Creative
                            </button>
                          )}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {(coverLetterShortById[String(job.id)] ||
                          coverLetterVeryShortById[String(job.id)]) && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <button
                              onClick={() =>
                                setSelectedCoverLetterVersion((p) => ({
                                  ...p,
                                  [String(job.id)]: "long",
                                }))
                              }
                              style={{
                                padding: "4px 10px",
                                borderRadius: 8,
                                border: "1px solid var(--jp-panel-border)",
                                backgroundColor:
                                  (selectedCoverLetterVersion[String(job.id)] || "long") === "long"
                                    ? "rgba(168,85,247,0.2)"
                                    : "transparent",
                                color: "var(--jp-panel-fg)",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                opacity: 0.9,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Long
                            </button>
                            <button
                              onClick={() =>
                                setSelectedCoverLetterVersion((p) => ({
                                  ...p,
                                  [String(job.id)]: "short",
                                }))
                              }
                              style={{
                                padding: "4px 10px",
                                borderRadius: 8,
                                border: "1px solid var(--jp-panel-border)",
                                backgroundColor:
                                  selectedCoverLetterVersion[String(job.id)] === "short"
                                    ? "rgba(168,85,247,0.2)"
                                    : "transparent",
                                color: "var(--jp-panel-fg)",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                opacity: 0.9,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Short
                            </button>
                            {coverLetterVeryShortById[String(job.id)] && (
                              <button
                                onClick={() =>
                                  setSelectedCoverLetterVersion((p) => ({
                                    ...p,
                                    [String(job.id)]: "very_short",
                                  }))
                                }
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 8,
                                  border: "1px solid var(--jp-panel-border)",
                                  backgroundColor:
                                    selectedCoverLetterVersion[String(job.id)] === "very_short"
                                      ? "rgba(168,85,247,0.2)"
                                      : "transparent",
                                  color: "var(--jp-panel-fg)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  opacity: 0.9,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Very short
                              </button>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => downloadDocx(job)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: "1px solid var(--jp-panel-border)",
                            backgroundColor: "transparent",
                            color: "var(--jp-panel-fg)",
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                            opacity: 0.9,
                            whiteSpace: "nowrap",
                          }}
                          aria-label="Download as .docx"
                          title="Download as .docx"
                        >
                          Download .docx
                        </button>
                        <button
                          onClick={() => copy(String(job.id))}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: "1px solid var(--jp-panel-border)",
                            backgroundColor: "transparent",
                            color: "var(--jp-panel-fg)",
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                            opacity: 0.9,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <textarea
                      readOnly
                      value={
                        (selectedCoverLetterVersion[String(job.id)] || "long") === "very_short"
                          ? coverLetterVeryShortById[String(job.id)] ||
                            coverLetterShortById[String(job.id)] ||
                            coverLetterById[String(job.id)]
                          : (selectedCoverLetterVersion[String(job.id)] || "long") === "short"
                          ? coverLetterShortById[String(job.id)] || coverLetterById[String(job.id)]
                          : coverLetterById[String(job.id)]
                      }
                      style={{
                        marginTop: 10,
                        width: "100%",
                        minHeight: 220,
                        padding: 12,
                        borderRadius: 10,
                        border: "1px solid var(--jp-input-border)",
                        backgroundColor: "var(--jp-input-bg)",
                        color: "var(--jp-input-fg)",
                        fontSize: 13,
                        lineHeight: 1.5,
                        resize: "vertical",
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Cover letter language modal */}
      {coverLetterLangModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onMouseDown={() => setCoverLetterLangModalOpen(false)}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              borderRadius: 16,
              border: "1px solid var(--jp-panel-border)",
              backgroundColor: "var(--jp-panel-bg)",
              color: "var(--jp-panel-fg)",
              boxShadow: "var(--jp-shadow)",
              padding: 16,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, fontSize: 14 }}>Cover letter language</div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              Choose the language for this cover letter.
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <button
                onClick={async () => {
                  setCoverLetterLangModalOpen(false);
                  if (coverLetterLangModalJob) await generate(coverLetterLangModalJob, "auto");
                  setCoverLetterLangModalJob(null);
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--jp-panel-border)",
                  backgroundColor: "var(--jp-panel-bg)",
                  color: "var(--jp-panel-fg)",
                  fontWeight: 900,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Announcement language (recommended)
              </button>
              <button
                onClick={async () => {
                  setCoverLetterLangModalOpen(false);
                  if (coverLetterLangModalJob) await generate(coverLetterLangModalJob, "en");
                  setCoverLetterLangModalJob(null);
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--jp-panel-border)",
                  background: "linear-gradient(180deg, rgba(59,130,246,0.95), rgba(37,99,235,0.95))",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                English
              </button>
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setCoverLetterLangModalOpen(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--jp-panel-border)",
                  backgroundColor: "transparent",
                  color: "var(--jp-panel-fg)",
                  fontWeight: 800,
                  cursor: "pointer",
                  opacity: 0.9,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

