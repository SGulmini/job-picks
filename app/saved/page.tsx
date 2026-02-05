"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { extractJobMetaFromDescription } from "@/lib/jobPostingMeta";
import {
  Bookmark,
  Briefcase,
  Building2,
  ChevronLeft,
  Copy,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

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
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>Loading…</main>}>
      <SavedJobsPageInner />
    </Suspense>
  );
}

function SavedJobsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<SavedJob[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
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

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(
      (job) =>
        job.title?.toLowerCase().includes(q) ||
        job.company?.toLowerCase().includes(q) ||
        job.location?.toLowerCase().includes(q)
    );
  }, [sorted, searchQuery]);

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
      version === "creative"
        ? coverLetterCreativeById[id] || coverLetterById[id]
        : version === "very_short"
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
      version === "creative"
        ? coverLetterCreativeById[id] || coverLetterById[id]
        : version === "very_short"
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

  const handleViewPosition = async (job: SavedJob, e: React.MouseEvent) => {
    if (job.url && (job.url.includes('adzuna.com') || job.url.includes('adzuna.co.uk'))) {
      e.preventDefault();
      try {
        const response = await fetch(`/api/resolve-job-url?url=${encodeURIComponent(job.url)}`);
        const data = await response.json();
        if (data.url && !data.isAdzunaRedirect) {
          window.open(data.url, '_blank', 'noopener,noreferrer');
        } else {
          window.open(job.url, '_blank', 'noopener,noreferrer');
        }
      } catch (error) {
        console.error('Failed to resolve job URL:', error);
        window.open(job.url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b px-4 py-4"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/home"
              className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: "var(--muted-foreground)" }}
            >
              <ChevronLeft className="h-4 w-4" />
              Back to picks
            </Link>
            <div className="h-6 w-px" style={{ background: "var(--border)" }} />
            <h1 className="flex items-center gap-2 text-lg font-bold" style={{ color: "var(--foreground)" }}>
              <Bookmark className="h-5 w-5" style={{ color: "var(--primary)" }} />
              Saved Jobs
            </h1>
          </div>
          <button
            onClick={clearAll}
            disabled={sorted.length === 0}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: sorted.length === 0 ? "var(--muted-foreground)" : "#ef4444" }}
          >
            <Trash2 className="h-4 w-4" />
            Clear all
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Page header */}
        <div className="mb-6">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {sorted.length === 0
              ? "No saved jobs yet. Save jobs from the picks page to apply later."
              : `You have ${sorted.length} saved job${sorted.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {sorted.length > 0 && (
          <>
            {/* Search bar */}
            <div
              className="mb-6 flex items-center gap-3 rounded-xl p-4"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}
            >
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
                <input
                  type="text"
                  placeholder="Search saved jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none transition-all"
                  style={{
                    background: "var(--secondary)",
                    color: "var(--foreground)",
                    border: "none",
                  }}
                />
              </div>
            </div>

            {/* Jobs list */}
            <div className="space-y-4">
              {filtered.length === 0 ? (
                <div
                  className="rounded-xl p-8 text-center"
                  style={{ border: "1px solid var(--border)", background: "var(--card)" }}
                >
                  <Search className="mx-auto h-12 w-12 mb-4" style={{ color: "var(--muted-foreground)" }} />
                  <p className="font-medium" style={{ color: "var(--foreground)" }}>No jobs match your search</p>
                  <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Try a different search term</p>
                </div>
              ) : (
                filtered.map((job) => {
                  const meta = extractJobMetaFromDescription(job.description);
                  const showLang = meta.language && meta.language !== "N/A";
                  const showAct = meta.activityRate && meta.activityRate !== "N/A";
                  const jobId = String(job.id);

                  return (
                    <div
                      key={job.id}
                      className="rounded-xl p-5 transition-all"
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                      }}
                    >
                      {/* Job header */}
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                            {job.title}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
                            <span className="flex items-center gap-1.5">
                              <Building2 className="h-4 w-4" />
                              {job.company}
                            </span>
                            {job.location && (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="h-4 w-4" />
                                {job.location}
                              </span>
                            )}
                          </div>

                          {/* Tags */}
                          {(showLang || showAct) && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {showLang && (
                                <span
                                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                  style={{
                                    background: "var(--secondary)",
                                    color: "var(--foreground)",
                                  }}
                                >
                                  🌐 {meta.language}
                                </span>
                              )}
                              {showAct && (
                                <span
                                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                  style={{
                                    background: "var(--secondary)",
                                    color: "var(--foreground)",
                                  }}
                                >
                                  ⏱️ {meta.activityRate}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Saved date */}
                          <p className="mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                            Saved {new Date(job.savedAt).toLocaleDateString()}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={job.url || "#"}
                            target="_blank"
                            rel="noreferrer noopener"
                            onClick={(e) => handleViewPosition(job, e)}
                            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                            style={{
                              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                            View position
                          </a>
                          <button
                            onClick={() => removeOne(job.id)}
                            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                            style={{
                              background: "var(--secondary)",
                              color: "var(--foreground)",
                            }}
                          >
                            <X className="h-4 w-4" />
                            Remove
                          </button>
                          <button
                            onClick={() => {
                              setCoverLetterLangModalJob(job);
                              setCoverLetterLangModalOpen(true);
                            }}
                            disabled={loadingId === jobId}
                            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed gradient-accent"
                          >
                            <Sparkles className="h-4 w-4" />
                            {loadingId === jobId ? "Generating..." : "Generate cover letter"}
                          </button>
                        </div>
                      </div>

                      {/* Description preview */}
                      {job.description && (
                        <p className="mt-4 text-sm line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
                          {job.description.substring(0, 220)}
                          {job.description.length > 220 && "..."}
                        </p>
                      )}

                      {/* Error message */}
                      {!!errorById[jobId] && (
                        <div className="mt-4 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-400">
                          {errorById[jobId]}
                        </div>
                      )}

                      {/* Cover letter */}
                      {!!coverLetterById[jobId] && (
                        <div
                          className="mt-4 p-4 rounded-xl"
                          style={{ background: "var(--secondary)" }}
                        >
                          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                            <div className="flex items-center gap-2">
                              <FileText className="h-5 w-5" style={{ color: "var(--primary)" }} />
                              <span className="font-bold">Cover Letter</span>
                            </div>

                            {/* Version selector */}
                            {(coverLetterShortById[jobId] || coverLetterVeryShortById[jobId] || coverLetterCreativeById[jobId]) && (
                              <div className="flex gap-1 items-center p-1 rounded-lg" style={{ background: "var(--card)" }}>
                                <button
                                  onClick={() => setSelectedCoverLetterVersion((prev) => ({ ...prev, [jobId]: "long" }))}
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                    (selectedCoverLetterVersion[jobId] || "long") === "long"
                                      ? "gradient-primary text-white"
                                      : "hover:bg-white/10"
                                  }`}
                                >
                                  Long
                                </button>
                                {coverLetterShortById[jobId] && (
                                  <button
                                    onClick={() => setSelectedCoverLetterVersion((prev) => ({ ...prev, [jobId]: "short" }))}
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                      selectedCoverLetterVersion[jobId] === "short"
                                        ? "gradient-primary text-white"
                                        : "hover:bg-white/10"
                                    }`}
                                  >
                                    Short
                                  </button>
                                )}
                                {coverLetterVeryShortById[jobId] && (
                                  <button
                                    onClick={() => setSelectedCoverLetterVersion((prev) => ({ ...prev, [jobId]: "very_short" }))}
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                      selectedCoverLetterVersion[jobId] === "very_short"
                                        ? "gradient-primary text-white"
                                        : "hover:bg-white/10"
                                    }`}
                                  >
                                    Very Short
                                  </button>
                                )}
                                {coverLetterCreativeById[jobId] && (
                                  <button
                                    onClick={() => setSelectedCoverLetterVersion((prev) => ({ ...prev, [jobId]: "creative" }))}
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                      selectedCoverLetterVersion[jobId] === "creative"
                                        ? "bg-orange-500/20 text-orange-400"
                                        : "hover:bg-white/10"
                                    }`}
                                  >
                                    ✨ Creative
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Copy & Download */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => copy(jobId)}
                                className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all hover:opacity-90 gradient-primary text-white"
                              >
                                <Copy className="h-4 w-4" />
                                Copy
                              </button>
                              <button
                                onClick={() => downloadDocx(job)}
                                className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
                                style={{
                                  background: "var(--card)",
                                  color: "var(--foreground)",
                                }}
                              >
                                <Download className="h-4 w-4" />
                                .docx
                              </button>
                            </div>
                          </div>

                          <textarea
                            readOnly
                            value={
                              (selectedCoverLetterVersion[jobId] || "long") === "creative"
                                ? coverLetterCreativeById[jobId] || coverLetterById[jobId]
                                : (selectedCoverLetterVersion[jobId] || "long") === "very_short"
                                ? coverLetterVeryShortById[jobId] || coverLetterShortById[jobId] || coverLetterById[jobId]
                                : (selectedCoverLetterVersion[jobId] || "long") === "short"
                                ? coverLetterShortById[jobId] || coverLetterById[jobId]
                                : coverLetterById[jobId]
                            }
                            className="w-full p-4 rounded-lg text-sm leading-relaxed resize-y"
                            style={{
                              minHeight: 200,
                              border: "1px solid var(--border)",
                              background: "var(--card)",
                              color: "var(--foreground)",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Empty state */}
        {sorted.length === 0 && (
          <div
            className="rounded-xl p-12 text-center"
            style={{ border: "1px solid var(--border)", background: "var(--card)" }}
          >
            <Bookmark className="mx-auto h-16 w-16 mb-4" style={{ color: "var(--muted-foreground)" }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>No saved jobs yet</h2>
            <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
              Save jobs from the picks page to apply later, even on another day.
            </p>
            <Link
              href="/home"
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 gradient-primary"
            >
              <Briefcase className="h-4 w-4" />
              Browse job picks
            </Link>
          </div>
        )}
      </main>

      {/* Cover letter language modal */}
      {coverLetterLangModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onMouseDown={() => setCoverLetterLangModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>
              Cover letter language
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
              Choose the language for this cover letter.
            </p>

            <div className="space-y-3">
              <button
                onClick={async () => {
                  setCoverLetterLangModalOpen(false);
                  if (coverLetterLangModalJob) await generate(coverLetterLangModalJob, "auto");
                  setCoverLetterLangModalJob(null);
                }}
                className="w-full p-4 rounded-xl text-left font-semibold transition-colors"
                style={{
                  background: "var(--secondary)",
                  color: "var(--foreground)",
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
                className="w-full p-4 rounded-xl text-left font-semibold text-white"
                style={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                }}
              >
                English
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setCoverLetterLangModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ color: "var(--muted-foreground)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
