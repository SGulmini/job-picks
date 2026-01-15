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

type CoverLetterCache = Record<string, { text: string; createdAt: string; lang?: "auto" | "en" }>;

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

function hasCandidateProfile(): boolean {
  try {
    const raw = localStorage.getItem(CANDIDATE_KEY);
    if (!raw) return false;
    const c = JSON.parse(raw);
    return Boolean(
      c &&
        typeof c.firstName === "string" &&
        c.firstName.trim() &&
        typeof c.lastName === "string" &&
        c.lastName.trim() &&
        typeof c.phone === "string" &&
        c.phone.trim() &&
        typeof c.addressLine1 === "string" &&
        c.addressLine1.trim() &&
        typeof c.zip === "string" &&
        c.zip.trim() &&
        typeof c.city === "string" &&
        c.city.trim() &&
        typeof c.country === "string" &&
        c.country.trim() &&
        typeof c.cvText === "string" &&
        c.cvText.trim()
    );
  } catch {
    return false;
  }
}

function readCandidateProfile(): any | null {
  try {
    const raw = localStorage.getItem(CANDIDATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [coverLetterLangModalOpen, setCoverLetterLangModalOpen] = useState(false);
  const [coverLetterLangModalJob, setCoverLetterLangModalJob] = useState<SavedJob | null>(null);

  useEffect(() => {
    const saved = readSavedJobs();
    setItems(saved);
    const cache = readCoverLetterCache();
    const initial: Record<string, string> = {};
    for (const j of saved) {
      const id = String(j.id);
      if (cache[id]?.text) initial[id] = cache[id].text;
    }
    setCoverLetterById(initial);
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

    if (!hasCandidateProfile()) {
      router.push(
        `/cover-letter/setup?returnTo=${encodeURIComponent("/saved")}&jobId=${encodeURIComponent(id)}&lang=${encodeURIComponent(preferredLanguage)}`
      );
      return;
    }

    const cache = readCoverLetterCache();
    if (cache[id]?.text && cache[id]?.lang === preferredLanguage) {
      setCoverLetterById((p) => ({ ...p, [id]: cache[id].text }));
      return;
    }

    setLoadingId(id);
    try {
      const profileStr = localStorage.getItem("jobProfile");
      const profile = profileStr ? JSON.parse(profileStr) : null;

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
          candidate: readCandidateProfile(),
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

      setCoverLetterById((p) => ({ ...p, [id]: text }));
      const nextCache: CoverLetterCache = {
        ...cache,
        [id]: { text, createdAt: new Date().toISOString(), lang: preferredLanguage },
      };
      writeCoverLetterCache(nextCache);
    } catch (e: any) {
      setErrorById((p) => ({ ...p, [id]: e?.message || "Failed to generate cover letter" }));
    } finally {
      setLoadingId(null);
    }
  };

  const copy = async (id: string) => {
    const text = coverLetterById[id];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const downloadDocx = async (job: SavedJob) => {
    const id = String(job.id);
    const text = coverLetterById[id];
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
                      rel="noreferrer"
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
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>Cover letter</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                      value={coverLetterById[String(job.id)]}
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

