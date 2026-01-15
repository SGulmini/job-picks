"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { extractJobMetaFromDescription } from "@/lib/jobPostingMeta";

type Job = {
  id: string;
  title: string;
  company: string;
  location?: string;
  url?: string;
  description?: string;
  salaryMin?: number;
  salaryMax?: number;
  created?: string;
};

// Se vuoi, cambia qui la chiave per farla combaciare con /profile.
// IMPORTANTISSIMO: deve essere identica.
const PROFILE_KEY = "jobProfile";
const SAVED_JOBS_KEY = "jobPicks_savedJobs_v1";
const DISCARDED_JOBS_KEY_PREFIX = "jobPicks_discarded_v1_";
const PICK_HISTORY_KEY_PREFIX = "jobPicks_pickHistory_v1_";
const CANDIDATE_KEY = "jobPicks_candidate_v1";
const EXTERNAL_JOB_DRAFT_KEY = "jobPicks_externalJobDraft_v1";

type SavedJob = Job & { savedAt: string };
type CoverLetterCache = Record<string, { text: string; createdAt: string; lang?: "auto" | "en" }>;

const COVER_LETTERS_KEY = "jobPicks_coverLetters_v2";

type GateState = "checking" | "need_profile" | "ready";

type ExternalJobDraft = {
  id: string;
  url: string;
  title: string;
  company: string;
  location: string;
  description: string;
  updatedAt: string;
};

function stableIdFromString(prefix: string, input: string) {
  const s = String(input || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return `${prefix}_${Math.abs(hash).toString(36)}`;
}

export default function HomePage() {
  // Next.js production build requires useSearchParams() to be under a Suspense boundary.
  return (
    <Suspense fallback={<main style={{ padding: 24, fontFamily: "system-ui" }}>Loading…</main>}>
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [gate, setGate] = useState<GateState>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<"free" | "premium">("free");
  const [coverLetterByJobId, setCoverLetterByJobId] = useState<Record<string, string>>({});
  const [coverLetterLoadingId, setCoverLetterLoadingId] = useState<string | null>(null);
  const [coverLetterErrorByJobId, setCoverLetterErrorByJobId] = useState<Record<string, string>>({});
  const [coverLetterLangModalOpen, setCoverLetterLangModalOpen] = useState(false);
  const [coverLetterLangModalJob, setCoverLetterLangModalJob] = useState<Job | null>(null);
  const [coverLetterLangModalSource, setCoverLetterLangModalSource] = useState<"job" | "external">("job");

  const [profileRaw, setProfileRaw] = useState<string | null>(null);

  const [externalJobId, setExternalJobId] = useState<string>("");
  const [externalUrl, setExternalUrl] = useState<string>("");
  const [externalJob, setExternalJob] = useState<ExternalJobDraft | null>(null);
  const [externalFormError, setExternalFormError] = useState<string | null>(null);

  const parsedProfile = useMemo(() => {
    if (!profileRaw) return null;
    try {
      return JSON.parse(profileRaw);
    } catch {
      return null;
    }
  }, [profileRaw]);

  const hasValidProfile = useMemo(() => {
    // Regola “tollerante”: basta che esista un oggetto non vuoto
    // oppure che contenga almeno un campo “tipico”.
    // Adatta i campi se nel tuo /profile usi nomi diversi.
    const p = parsedProfile;
    if (!p || typeof p !== "object") return false;

    // Se il profilo è completamente vuoto -> false
    const keys = Object.keys(p);
    if (keys.length === 0) return false;

    // Check "smart" su campi comuni (adatta se vuoi)
    const role = (p as any).role ?? (p as any).title ?? (p as any).query;
    // Support both old format (area as string) and new format (areas as array)
    const areas = (p as any).areas;
    const area = (p as any).area ?? (p as any).department;
    // Support experienceYears (new format) and legacy formats (seniority, level)
    const experienceYears = (p as any).experienceYears;
    const level = (p as any).level;
    const country = (p as any).country;

    // Se esiste almeno uno di questi valorizzato -> ok
    const hasSomething =
      (typeof role === "string" && role.trim().length > 0) ||
      (Array.isArray(areas) && areas.length > 0) ||
      (typeof area === "string" && area.trim().length > 0) ||
      (typeof experienceYears === "number" && experienceYears >= 0) ||
      (typeof level === "string" && level.trim().length > 0) ||
      (typeof country === "string" && country.trim().length > 0) ||
      keys.length > 0;

    return Boolean(hasSomething);
  }, [parsedProfile]);

  // Helper function to create a simple hash of the profile for cache invalidation
  const getProfileHash = useCallback((profile: any) => {
    // Create a simple hash from profile key fields
    const keyFields = {
      roles: Array.isArray(profile.roles) ? profile.roles.sort().join(",") : profile.role || "",
      areas: Array.isArray(profile.areas) ? profile.areas.sort().join(",") : profile.area || "",
      country: profile.country || "",
      city: profile.city || "",
      experienceYears: typeof profile.experienceYears === "number" ? profile.experienceYears.toString() : (profile.level ? (profile.level === "Junior" ? "1" : profile.level === "Mid" ? "3" : "5") : ""),
      remote: profile.remote || false,
      // Include tier so cache invalidates immediately after upgrade/downgrade
      subscriptionTier: profile.subscriptionTier || "free",
    };
    const hashString = JSON.stringify(keyFields);
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < hashString.length; i++) {
      const char = hashString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }, []);

  // Helper function to get storage key for today's date with profile hash
  const getStorageKey = useCallback((profile: any) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const profileHash = getProfileHash(profile);
    // Version the daily picks cache so policy changes (like premium=10) don't reuse older "infinite" cached lists.
    return `jobPicks_${todayStr}_${profileHash}_v2`;
  }, [getProfileHash]);

  const getDiscardKey = useCallback((profile: any) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const profileHash = getProfileHash(profile);
    return `${DISCARDED_JOBS_KEY_PREFIX}${todayStr}_${profileHash}`;
  }, [getProfileHash]);

  const getPickHistoryKey = useCallback((profile: any) => {
    const profileHash = getProfileHash(profile);
    return `${PICK_HISTORY_KEY_PREFIX}${profileHash}`;
  }, [getProfileHash]);

  type PickHistory = Record<string, string[]>;

  const readPickHistory = useCallback((key: string): PickHistory => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }, []);

  const writePickHistory = useCallback((key: string, history: PickHistory) => {
    try {
      localStorage.setItem(key, JSON.stringify(history));
    } catch {
      // ignore
    }
  }, []);

  const getLastNDates = useCallback((n: number, includeToday: boolean) => {
    const out: string[] = [];
    const base = new Date();
    for (let i = includeToday ? 0 : 1; out.length < n; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      out.push(d.toISOString().split("T")[0]);
    }
    return out;
  }, []);

  const readSavedJobs = useCallback((): SavedJob[] => {
    try {
      const raw = localStorage.getItem(SAVED_JOBS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const writeSavedJobs = useCallback((items: SavedJob[]) => {
    try {
      localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, []);

  const readDiscardedIds = useCallback((discardKey: string): Set<string> => {
    try {
      const raw = localStorage.getItem(discardKey);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((x) => typeof x === "string"));
    } catch {
      return new Set();
    }
  }, []);

  const writeDiscardedIds = useCallback((discardKey: string, ids: Set<string>) => {
    try {
      localStorage.setItem(discardKey, JSON.stringify(Array.from(ids)));
    } catch {
      // ignore
    }
  }, []);

  const readCoverLetterCache = useCallback((): CoverLetterCache => {
    try {
      const raw = localStorage.getItem(COVER_LETTERS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }, []);

  const writeCoverLetterCache = useCallback((cache: CoverLetterCache) => {
    try {
      localStorage.setItem(COVER_LETTERS_KEY, JSON.stringify(cache));
    } catch {
      // ignore
    }
  }, []);

  const readExternalJobDraft = useCallback((): ExternalJobDraft | null => {
    try {
      const raw = localStorage.getItem(EXTERNAL_JOB_DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed as ExternalJobDraft;
    } catch {
      return null;
    }
  }, []);

  const writeExternalJobDraft = useCallback((draft: ExternalJobDraft | null) => {
    try {
      if (!draft) {
        localStorage.removeItem(EXTERNAL_JOB_DRAFT_KEY);
        return;
      }
      localStorage.setItem(EXTERNAL_JOB_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, []);

  const hasCandidateProfile = useCallback((): boolean => {
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
  }, []);

  const readCandidateProfile = useCallback((): any | null => {
    try {
      const raw = localStorage.getItem(CANDIDATE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  // Hydrate the external-job panel from the last draft (so pasting survives refresh/setup redirect)
  useEffect(() => {
    const draft = readExternalJobDraft();
    if (!draft) return;
    setExternalJobId(String(draft.id || ""));
    setExternalUrl(String(draft.url || ""));
    setExternalJob(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep draft URL up-to-date while user edits (best-effort)
  useEffect(() => {
    const url = externalUrl.trim();
    if (!url) return;
    const id = externalJobId || stableIdFromString("ext", url);
    writeExternalJobDraft({
      id,
      url,
      title: externalJob?.title || "",
      company: externalJob?.company || "",
      location: externalJob?.location || "",
      description: externalJob?.description || "",
      updatedAt: new Date().toISOString(),
    });
  }, [
    externalUrl,
    externalJobId,
    externalJob,
    writeExternalJobDraft,
  ]);

  const loadJobs = useCallback(async () => {
    if (!parsedProfile) {
      setError("Profile not found");
      return;
    }

    const profile = parsedProfile as any;
    // Source of truth: session-derived tier (falls back to profile, then free)
    const effectiveTier: "free" | "premium" =
      subscriptionTier || (profile.subscriptionTier as "free" | "premium") || "free";

    // Ensure cache key changes when tier changes
    const effectiveProfile = { ...profile, subscriptionTier: effectiveTier };
    const storageKey = getStorageKey(effectiveProfile);
    const discardKey = getDiscardKey(effectiveProfile);
    const discarded = readDiscardedIds(discardKey);
    const savedNow = readSavedJobs();
    const savedIdSet = new Set(savedNow.map((j) => String(j?.id)).filter((x) => x && x !== "undefined"));
    const pickHistoryKey = getPickHistoryKey(effectiveProfile);
    const pickHistory = readPickHistory(pickHistoryKey);
    const last14Days = getLastNDates(14, false); // exclude today; we only want prior "seen" jobs
    const excludeIdSet = new Set<string>();
    for (const day of last14Days) {
      const ids = pickHistory?.[day];
      if (Array.isArray(ids)) {
        for (const id of ids) {
          if (typeof id === "string" && id.length > 0) excludeIdSet.add(id);
        }
      }
    }
    // Never show jobs that are already in the Saved page.
    for (const id of savedIdSet) excludeIdSet.add(id);
    const excludeIds = Array.from(excludeIdSet);
    const maxDaily = effectiveTier === "premium" ? 10 : 3;

    // Clean up old DAILY job picks from previous days or different profiles.
    // IMPORTANT: do NOT delete other jobPicks_* keys like saved/discarded storage.
    const today = new Date().toISOString().split('T')[0];
    const isDailyPicksKey = (k: string) => /^jobPicks_\d{4}-\d{2}-\d{2}_.+/.test(k);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isDailyPicksKey(key) && key !== storageKey) {
        // Remove old daily entries (different date or different profile)
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Check if jobs for today with this profile are already saved
    const savedJobs = localStorage.getItem(storageKey);
    if (savedJobs) {
      try {
        const parsed = JSON.parse(savedJobs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const visible = parsed.filter(
            (j: any) => j?.id && !discarded.has(String(j.id)) && !savedIdSet.has(String(j.id))
          );
          setJobs(visible.slice(0, maxDaily));
          setError(null);
          return;
        }
      } catch {
        // Invalid saved data, continue to fetch new jobs
      }
    }

    // No saved jobs for this date, fetch new ones
    setJobsLoading(true);
    setError(null);

    try {
      // Build query parameters from profile
      const params = new URLSearchParams();
      
      // Support both new format (roles array) and old format (role string)
      if (Array.isArray(profile.roles) && profile.roles.length > 0) {
        params.set("roles", profile.roles.join(","));
      } else if (profile.role) {
        // Fallback to old format
        params.set("role", profile.role);
      }
      
      // Areas can be empty array (means all areas) - pass empty string if empty
      if (Array.isArray(profile.areas) && profile.areas.length > 0) {
        params.set("areas", profile.areas.join(","));
      } else if (profile.area) {
        // Fallback to old format
        params.set("areas", profile.area);
      } else {
        // Empty areas means all areas - pass empty string
        params.set("areas", "");
      }
      
      if (profile.country) {
        params.set("country", profile.country);
      }
      
      if (profile.city && typeof profile.city === "string" && profile.city.trim()) {
        params.set("city", profile.city.trim());
      }
      
      if (typeof profile.remote === "boolean") {
        params.set("remote", profile.remote.toString());
      }
      
      if (typeof profile.experienceYears === "number") {
        params.set("experienceYears", profile.experienceYears.toString());
      } else if (profile.level) {
        // Fallback: convert old level to approximate years
        const levelMap: Record<string, string> = {
          Junior: "1",
          Mid: "3",
          Senior: "5",
        };
        params.set("experienceYears", levelMap[profile.level] || "3");
      }
      
      // Add subscription tier (source of truth = session tier)
      params.set("subscriptionTier", effectiveTier);

      // Add date parameter to vary results (use today's date)
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      params.set("date", todayStr);
      if (excludeIds.length > 0) {
        // Avoid repeating any job seen in the last 14 days for this profile.
        params.set("excludeIds", excludeIds.slice(0, 120).join(","));
      }

      const response = await fetch(`/api/jobs?${params.toString()}`, { 
        cache: "no-store" 
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch jobs");
      }

      const data = await response.json();
      const fetchedJobs = Array.isArray(data.jobs) ? data.jobs : [];
      const visibleFetched = fetchedJobs.filter(
        (j: any) => j?.id && !discarded.has(String(j.id)) && !savedIdSet.has(String(j.id))
      );
      const cappedFetched = visibleFetched.slice(0, maxDaily);
      
      // Save jobs to localStorage for today with this profile
      if (cappedFetched.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(cappedFetched));
      }
      
      setJobs(cappedFetched);

      // Persist today's picks to the per-profile rolling history (last 14 days)
      // (store the raw fetched jobs, not filtered by discards)
      try {
        const todayKey = new Date().toISOString().split("T")[0];
        const ids = cappedFetched.map((j: any) => String(j?.id)).filter((x: any) => typeof x === "string" && x.length > 0);
        if (ids.length > 0) {
          const nextHistory = { ...(pickHistory || {}) } as Record<string, string[]>;
          nextHistory[todayKey] = ids;

          // Prune history to last 14 days (keep only last 14 day keys + today)
          const keepDays = new Set(getLastNDates(14, true));
          for (const k of Object.keys(nextHistory)) {
            if (!keepDays.has(k)) delete nextHistory[k];
          }

          writePickHistory(pickHistoryKey, nextHistory);
        }
      } catch {
        // ignore
      }

      // Sync tier into the stored profile so we don't regress to "free" on refresh
      try {
        if (profile.subscriptionTier !== effectiveTier) {
          const updatedProfile = { ...profile, subscriptionTier: effectiveTier };
          localStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
          setProfileRaw(JSON.stringify(updatedProfile));
        }
      } catch {
        // Ignore write failures
      }
      
      if (visibleFetched.length === 0) {
        setError("No jobs found matching your criteria. Try adjusting your profile.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong while loading jobs.");
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, [
    parsedProfile,
    getStorageKey,
    getDiscardKey,
    readDiscardedIds,
    subscriptionTier,
    getPickHistoryKey,
    readPickHistory,
    getLastNDates,
    writePickHistory,
  ]);

  // If coming back from setup, auto-generate for the requested job id.
  useEffect(() => {
    const targetId = searchParams.get("generateCoverLetterFor");
    if (!targetId) return;
    const lang = (searchParams.get("generateCoverLetterLang") as "auto" | "en" | null) || "auto";
    const job = jobs.find((j) => String(j.id) === String(targetId));
    if (job) {
      // Fire and forget; then clean URL
      onGenerateCoverLetter(job, lang);
      router.replace("/home");
      return;
    }

    // External job flow: the job isn't in today's picks, so we load it from the draft.
    const draft = readExternalJobDraft();
    if (draft && String(draft.id) === String(targetId)) {
      const extJob: Job = {
        id: String(draft.id),
        title: draft.title || "Job opportunity",
        company: draft.company || "Company",
        location: draft.location || "",
        url: draft.url || "",
        description: draft.description || "",
      };
      onGenerateCoverLetter(extJob, lang);
      router.replace("/home");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, searchParams]);

  const onDiscardJob = useCallback((job: Job) => {
    if (!parsedProfile) return;
    const profile = parsedProfile as any;
    const effectiveTier: "free" | "premium" =
      subscriptionTier || (profile.subscriptionTier as "free" | "premium") || "free";
    const effectiveProfile = { ...profile, subscriptionTier: effectiveTier };
    const discardKey = getDiscardKey(effectiveProfile);
    const discarded = readDiscardedIds(discardKey);
    discarded.add(String(job.id));
    writeDiscardedIds(discardKey, discarded);
    setJobs((prev) => prev.filter((j) => String(j.id) !== String(job.id)));
  }, [getDiscardKey, parsedProfile, readDiscardedIds, subscriptionTier, writeDiscardedIds]);

  const onSaveForLater = useCallback((job: Job) => {
    const saved = readSavedJobs();
    const id = String(job.id);
    const exists = saved.some((j) => String(j.id) === id);
    if (!exists) {
      const next: SavedJob[] = [{ ...job, id, savedAt: new Date().toISOString() }, ...saved];
      writeSavedJobs(next);
    }
    // Remove from today's list (acts like "save & hide")
    onDiscardJob(job);
  }, [onDiscardJob, readSavedJobs, writeSavedJobs]);

  const onGenerateCoverLetter = useCallback(async (job: Job, preferredLanguage: "auto" | "en" = "auto") => {
    const jobId = String(job.id);
    setCoverLetterErrorByJobId((prev) => ({ ...prev, [jobId]: "" }));

    // First-time setup gate
    if (!hasCandidateProfile()) {
      router.push(
        `/cover-letter/setup?returnTo=${encodeURIComponent("/home")}&jobId=${encodeURIComponent(jobId)}&lang=${encodeURIComponent(preferredLanguage)}`
      );
      return;
    }

    // Cache hit
    const cache = readCoverLetterCache();
    if (cache[jobId]?.text && cache[jobId]?.lang === preferredLanguage) {
      setCoverLetterByJobId((prev) => ({ ...prev, [jobId]: cache[jobId].text }));
      return;
    }

    if (!parsedProfile) {
      setCoverLetterErrorByJobId((prev) => ({
        ...prev,
        [jobId]: "Profile not found. Please set up your job search first.",
      }));
      return;
    }

    setCoverLetterLoadingId(jobId);
    try {
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
          profile: parsedProfile,
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

      setCoverLetterByJobId((prev) => ({ ...prev, [jobId]: text }));
      const nextCache: CoverLetterCache = {
        ...cache,
        [jobId]: { text, createdAt: new Date().toISOString(), lang: preferredLanguage },
      };
      writeCoverLetterCache(nextCache);
    } catch (e: any) {
      setCoverLetterErrorByJobId((prev) => ({
        ...prev,
        [jobId]: e?.message || "Failed to generate cover letter",
      }));
    } finally {
      setCoverLetterLoadingId(null);
    }
  }, [hasCandidateProfile, parsedProfile, readCandidateProfile, readCoverLetterCache, router, writeCoverLetterCache]);

  const onCopyCoverLetter = useCallback(async (jobId: string) => {
    const text = coverLetterByJobId[jobId];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }, [coverLetterByJobId]);

  const onDownloadCoverLetterDocx = useCallback(async (job: Job) => {
    const jobId = String(job.id);
    const text = coverLetterByJobId[jobId];
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
      // ignore (download failures should not break UI)
    }
  }, [coverLetterByJobId]);

  const openCoverLetterLanguageModalForJob = useCallback((job: Job) => {
    setCoverLetterLangModalSource("job");
    setCoverLetterLangModalJob(job);
    setCoverLetterLangModalOpen(true);
  }, []);

  const openCoverLetterLanguageModalForExternal = useCallback(() => {
    setCoverLetterLangModalSource("external");
    setCoverLetterLangModalJob(null);
    setCoverLetterLangModalOpen(true);
  }, []);

  const onGenerateExternalCoverLetter = useCallback(async (preferredLanguage: "auto" | "en" = "auto") => {
    setExternalFormError(null);
    const url = externalUrl.trim();
    if (!url) {
      setExternalFormError("Please paste a job link (URL).");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setExternalFormError("Please paste a valid link starting with http:// or https://");
      return;
    }

    const id = stableIdFromString("ext", url);
    setExternalJobId(id);

    // Extract job details from the link server-side (best effort; some sites may block).
    let extractedTitle = "";
    let extractedCompany = "";
    let extractedLocation = "";
    let extractedDescription = "";
    setCoverLetterErrorByJobId((prev) => ({ ...prev, [id]: "" }));
    setCoverLetterLoadingId(id);
    try {
      const res = await fetch("/api/extract-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to extract job details from the link");
      }
      const jobFromLink = data?.job;
      extractedTitle = String(jobFromLink?.title || "");
      extractedCompany = String(jobFromLink?.company || "");
      extractedLocation = String(jobFromLink?.location || "");
      extractedDescription = String(jobFromLink?.description || "");

      const draft: ExternalJobDraft = {
        id,
        url,
        title: extractedTitle,
        company: extractedCompany,
        location: extractedLocation,
        description: extractedDescription,
        updatedAt: new Date().toISOString(),
      };
      setExternalJob(draft);
      writeExternalJobDraft(draft);
    } catch (e: any) {
      const msg =
        e?.message ||
        "We couldn't extract the job details from this link (the website may block automated access).";
      setExternalFormError(msg);
      setCoverLetterErrorByJobId((prev) => ({
        ...prev,
        [id]: msg,
      }));
      return;
    } finally {
      setCoverLetterLoadingId(null);
    }

    const job: Job = {
      id,
      title: extractedTitle.trim() || "Job opportunity",
      company: extractedCompany.trim() || "Company",
      location: extractedLocation.trim(),
      url,
      description: extractedDescription.trim(),
    };

    await onGenerateCoverLetter(job, preferredLanguage);
  }, [
    externalUrl,
    onGenerateCoverLetter,
    writeExternalJobDraft,
  ]);

  const confirmCoverLetterLanguage = useCallback(
    async (lang: "auto" | "en") => {
      setCoverLetterLangModalOpen(false);
      try {
        if (coverLetterLangModalSource === "external") {
          await onGenerateExternalCoverLetter(lang);
          return;
        }
        if (coverLetterLangModalJob) {
          await onGenerateCoverLetter(coverLetterLangModalJob, lang);
        }
      } finally {
        setCoverLetterLangModalJob(null);
      }
    },
    [coverLetterLangModalJob, coverLetterLangModalSource, onGenerateCoverLetter, onGenerateExternalCoverLetter]
  );

  // 1) Gate di accesso: solo profilo (login già fatto prima)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setGate("checking");
      setError(null);

      // Gestisci la callback URL di Supabase se presente
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken && refreshToken) {
        // Sessione da callback URL
        const { data: { session: callbackSession }, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (!error && callbackSession) {
          const userEmail = callbackSession.user?.email;
          setEmail(userEmail || null);
          const name = 
            callbackSession.user?.user_metadata?.name ||
            callbackSession.user?.user_metadata?.full_name ||
            (userEmail ? userEmail.split("@")[0] : null);
          setUserName(name);
          
          // Pulisci l'URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      // A) Session (solo per mostrare l'email, non per bloccare)
      // Prova prima con getSession, poi con getUser per essere sicuri
      let session = (await supabase.auth.getSession()).data.session;
      
      // Se non c'è sessione, prova con getUser
      if (!session) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          session = { user } as any;
        }
      }

      // Se ancora non c'è sessione, aspetta un po' e riprova (per gestire il caso del magic link)
      if (!session) {
        await new Promise(resolve => setTimeout(resolve, 500));
        session = (await supabase.auth.getSession()).data.session;
        if (!session) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            session = { user } as any;
          }
        }
      }

      if (cancelled) return;

      const userEmail = session?.user?.email;
      if (userEmail) {
        setEmail(userEmail);
        // Salva anche in localStorage come backup
        localStorage.setItem('jobpicks_user_email', userEmail);
        
        // Recupera il nome utente
        const name = 
          session?.user?.user_metadata?.name ||
          session?.user?.user_metadata?.full_name ||
          (userEmail ? userEmail.split("@")[0] : null);
        setUserName(name);

        // Read tier early (so the first /api/jobs call uses the correct limit)
        const tier =
          (session?.user?.user_metadata?.subscriptionTier as "free" | "premium" | undefined) ||
          "free";
        setSubscriptionTier(tier);
      } else {
        // Prova a recuperare da localStorage come fallback
        const savedEmail = localStorage.getItem('jobpicks_user_email');
        if (savedEmail) {
          setEmail(savedEmail);
          setUserName(savedEmail.split("@")[0]);
        }
      }

      // B) Profile da localStorage (solo client)
      const raw = localStorage.getItem(PROFILE_KEY);
      setProfileRaw(raw);

      // Se manca o è rotto o è vuoto -> vai a /profile
      // Nota: qui NON facciamo affidamento solo su "raw esiste".
      let ok = false;
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (p && typeof p === "object" && Object.keys(p).length > 0) ok = true;
        } catch {
          ok = false;
        }
      }

      if (!ok) {
        setGate("need_profile");
        router.replace("/profile");
        return;
      }

      // C) Tutto ok
      setGate("ready");
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Funzione helper per recuperare email dalla sessione
  const updateUserInfo = useCallback(async () => {
    try {
      // Metodo 1: getSession
      let session = (await supabase.auth.getSession()).data.session;
      
      // Metodo 2: getUser se getSession non funziona
      if (!session) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          session = { user } as any;
        }
      }

      // Metodo 3: Prova a leggere direttamente da localStorage (Supabase salva la sessione lì)
      if (!session) {
        try {
          // Cerca tutte le chiavi che potrebbero contenere la sessione Supabase
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('supabase') || key.includes('auth'))) {
              try {
                const stored = localStorage.getItem(key);
                if (stored) {
                  const parsed = JSON.parse(stored);
                  // Cerca email in vari formati possibili
                  const userEmail = 
                    parsed?.user?.email ||
                    parsed?.email ||
                    parsed?.currentSession?.user?.email ||
                    parsed?.session?.user?.email;
                  
                  if (userEmail) {
                    setEmail(userEmail);
                    const name = 
                      parsed?.user?.user_metadata?.name ||
                      parsed?.user?.user_metadata?.full_name ||
                      parsed?.currentSession?.user?.user_metadata?.name ||
                      parsed?.session?.user?.user_metadata?.name ||
                      userEmail.split("@")[0];
                    setUserName(name);
                    return;
                  }
                }
              } catch (e) {
                // Continua con la prossima chiave
              }
            }
          }
        } catch (e) {
          // Ignora errori
        }
      }

      // Se abbiamo una sessione, usa quella
      if (session?.user?.email) {
        const userEmail = session.user.email;
        setEmail(userEmail);
        // Salva anche in localStorage come backup
        localStorage.setItem('jobpicks_user_email', userEmail);
        const name = 
          session.user.user_metadata?.name ||
          session.user.user_metadata?.full_name ||
          userEmail.split("@")[0];
        setUserName(name);
        return;
      }

      // Metodo 4: Prova a recuperare da localStorage (backup)
      const savedEmail = localStorage.getItem('jobpicks_user_email');
      if (savedEmail) {
        setEmail(savedEmail);
        const name = savedEmail.split("@")[0];
        setUserName(name);
      }
    } catch (error) {
      console.error("Error updating user info:", error);
    }
  }, []);

  // Listener per aggiornare l'email quando cambia la sessione
  useEffect(() => {
    // Refresh immediato
    updateUserInfo();

    // Polling periodico per recuperare la sessione (utile se c'è un delay)
    const intervalId = setInterval(() => {
      if (!email) {
        updateUserInfo();
      }
    }, 1000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.email) {
        const userEmail = session.user.email;
        setEmail(userEmail);
        // Salva anche in localStorage come backup
        localStorage.setItem('jobpicks_user_email', userEmail);
        const name = 
          session.user.user_metadata?.name ||
          session.user.user_metadata?.full_name ||
          userEmail.split("@")[0];
        setUserName(name);
        
        // Always set tier (default free)
        const tier =
          (session.user.user_metadata?.subscriptionTier as "free" | "premium" | undefined) ||
          "free";
        setSubscriptionTier(tier);
      } else {
        // Se la sessione è null, prova a recuperarla
        updateUserInfo();
      }
    });
    
    // Also check profile for subscription tier
    const profileStr = localStorage.getItem("jobProfile");
    if (profileStr) {
      try {
        const profile = JSON.parse(profileStr);
        if (profile.subscriptionTier) {
          setSubscriptionTier(profile.subscriptionTier);
        }
      } catch {
        // Ignore
      }
    }

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, [updateUserInfo, email]);

  // 2) Caricamento jobs solo quando gate è pronto
  useEffect(() => {
    if (gate === "ready") {
      loadJobs();
    }
  }, [gate, loadJobs]);

  // If tier changes after an upgrade, refresh picks to show the correct count immediately
  useEffect(() => {
    if (gate === "ready") {
      loadJobs();
    }
  }, [subscriptionTier, gate, loadJobs]);

  async function onLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function editProfile() {
    router.push("/profile/edit");
  }

  // UI di stato (evita flash strani e rimbalzi)
  if (gate === "checking") {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        Loading your account...
      </main>
    );
  }

  if (gate === "need_profile") {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        Redirecting to profile...
      </main>
    );
  }

  // gate === "ready"
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Job Picks</h1>
          <p style={{ margin: "6px 0 0 0" }}>Signed in as: {email ?? "-"}</p>
          {subscriptionTier === "free" && (
            <Link
              href="/upgrade"
              style={{
                display: "inline-block",
                marginTop: 8,
                padding: "6px 12px",
                backgroundColor: "#0070f3",
                color: "white",
                textDecoration: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Upgrade to Premium (€1/month) →
            </Link>
          )}
          {subscriptionTier === "premium" && (
            <span
              style={{
                display: "inline-block",
                marginTop: 8,
                padding: "6px 12px",
                backgroundColor: "#10b981",
                color: "white",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              ✓ Premium Member
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            href="/saved"
            style={{
              display: "inline-block",
              padding: "10px 12px",
              height: 42,
              lineHeight: "22px",
              borderRadius: 10,
              border: "1px solid var(--jp-panel-border)",
              backgroundColor: "var(--jp-panel-bg)",
              color: "var(--jp-panel-fg)",
              fontWeight: 800,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
            aria-label="Saved jobs"
            title="Saved jobs"
          >
            Saved jobs
          </Link>
          <Link
            href={`/cover-letter/setup?returnTo=${encodeURIComponent("/home")}`}
            style={{
              display: "inline-block",
              padding: "10px 12px",
              height: 42,
              lineHeight: "22px",
              borderRadius: 10,
              border: "1px solid var(--jp-panel-border)",
              backgroundColor: "var(--jp-panel-bg)",
              color: "var(--jp-panel-fg)",
              fontWeight: 800,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
            aria-label="CV and cover letter setup"
            title="CV and cover letter setup"
          >
            CV
          </Link>
          <button
            onClick={editProfile}
            style={{
              padding: "10px 14px",
              height: 42,
              borderRadius: 10,
              border: "1px solid var(--jp-panel-border)",
              background: "linear-gradient(180deg, rgba(59,130,246,0.95), rgba(37,99,235,0.95))",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "var(--jp-shadow)",
              whiteSpace: "nowrap",
            }}
            aria-label="Edit job search"
            title="Edit job search"
          >
            Edit job search
          </button>
          <button
            onClick={onLogout}
            style={{
              padding: "10px 12px",
              height: 42,
              borderRadius: 10,
              border: "1px solid var(--jp-panel-border)",
              backgroundColor: "var(--jp-panel-bg)",
              color: "var(--jp-panel-fg)",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Log out
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>
          Today's picks
        </h2>
        <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
          {subscriptionTier === "premium"
            ? "Showing up to 10 best matches for your profile"
            : "Showing 3 picks for your profile"}
        </p>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Left: today's picks */}
          <div style={{ flex: "1 1 560px", minWidth: 0 }}>
            {error && <p style={{ color: "#ef4444" }}>{error}</p>}

            {jobsLoading && !error && <p>Loading today's picks...</p>}

            {!jobsLoading && !error && jobs.length === 0 && (
              <p>No jobs found for today. Check back tomorrow.</p>
            )}

            {!jobsLoading && !error && jobs.length > 0 && (
              <>
                <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
                  {jobs.map((job) => (
                    <li
                      key={job.id}
                      style={{
                        marginBottom: 16,
                        padding: 16,
                        border: "1px solid var(--jp-panel-border)",
                        borderRadius: 14,
                        backgroundColor: "var(--jp-panel-bg)",
                        color: "var(--jp-panel-fg)",
                        boxShadow: "var(--jp-shadow)",
                      }}
                    >
                  <div>
                    <strong style={{ fontSize: 16 }}>{job.title}</strong>
                  </div>
                  <div style={{ marginTop: 4, opacity: 0.8 }}>
                    {job.company}
                  </div>
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
                    <div style={{ marginTop: 4, opacity: 0.7, fontSize: 14 }}>
                      📍 {job.location}
                    </div>
                  )}
                  {(job.salaryMin || job.salaryMax) && (
                    <div style={{ marginTop: 4, opacity: 0.7, fontSize: 14 }}>
                      💰 {job.salaryMin && job.salaryMax 
                        ? `${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}` 
                        : job.salaryMin 
                        ? `From ${job.salaryMin.toLocaleString()}` 
                        : job.salaryMax
                        ? `Up to ${job.salaryMax.toLocaleString()}` 
                        : ""}
                    </div>
                  )}
                  {job.description && (
                    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
                      {job.description.substring(0, 200)}
                      {job.description.length > 200 && "..."}
                    </div>
                  )}
                  <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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
                        fontWeight: 700,
                        border: "1px solid var(--jp-panel-border)",
                        boxShadow: "var(--jp-shadow)",
                      }}
                      aria-label="View position"
                      title="View position"
                    >
                      View position →
                    </a>

                    <button
                      onClick={() => onSaveForLater(job)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid var(--jp-panel-border)",
                        backgroundColor: "var(--jp-panel-bg)",
                        color: "var(--jp-panel-fg)",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      aria-label="Save for later"
                      title="Save for later"
                    >
                      Save for later
                    </button>

                    <button
                      onClick={() => onDiscardJob(job)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid var(--jp-panel-border)",
                        backgroundColor: "transparent",
                        color: "var(--jp-panel-fg)",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: "pointer",
                        opacity: 0.85,
                      }}
                      aria-label="Discard"
                      title="Discard"
                    >
                      Discard
                    </button>

                    <button
                      onClick={() => openCoverLetterLanguageModalForJob(job)}
                      disabled={coverLetterLoadingId === String(job.id)}
                      style={{
                        marginLeft: "auto",
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: "1px solid var(--jp-panel-border)",
                        background: "linear-gradient(180deg, rgba(168,85,247,0.95), rgba(79,70,229,0.95))",
                        color: "white",
                        fontSize: 13,
                        fontWeight: 900,
                        cursor: coverLetterLoadingId === String(job.id) ? "not-allowed" : "pointer",
                        opacity: coverLetterLoadingId === String(job.id) ? 0.65 : 1,
                        boxShadow: "var(--jp-shadow)",
                      }}
                      aria-label="Generate cover letter"
                      title="Generate cover letter"
                    >
                      {coverLetterLoadingId === String(job.id) ? "Generating..." : "Generate cover letter"}
                    </button>
                  </div>

                  {!!coverLetterErrorByJobId[String(job.id)] && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid var(--jp-panel-border)",
                        backgroundColor: "var(--jp-panel-bg)",
                        color: "var(--jp-panel-fg)",
                        opacity: 0.95,
                      }}
                    >
                      <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 13 }}>
                        {coverLetterErrorByJobId[String(job.id)]}
                      </div>
                    </div>
                  )}

                  {!!coverLetterByJobId[String(job.id)] && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid var(--jp-panel-border)",
                        backgroundColor: "var(--jp-panel-bg)",
                        color: "var(--jp-panel-fg)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>Cover letter</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button
                            onClick={() => onDownloadCoverLetterDocx(job)}
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
                            onClick={() => onCopyCoverLetter(String(job.id))}
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
                        value={coverLetterByJobId[String(job.id)]}
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
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: "1px solid var(--jp-panel-border)",
                    fontSize: 12,
                    opacity: 0.7,
                    textAlign: "center",
                  }}
                >
                  Jobs by{" "}
                  <a href="https://www.adzuna.com" target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                    Adzuna
                  </a>
                </div>
              </>
            )}
          </div>

          {/* Right: external link (sticky on desktop, stacks below on mobile) */}
          <div style={{ flex: "0 0 380px", width: "100%", maxWidth: 460 }}>
            <div style={{ position: "sticky", top: 16 }}>
              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: "1px solid var(--jp-panel-border)",
                  backgroundColor: "var(--jp-panel-bg)",
                  color: "var(--jp-panel-fg)",
                  boxShadow: "var(--jp-shadow)",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14 }}>External job link</h3>
                <p style={{ margin: "6px 0 0 0", fontSize: 12, opacity: 0.75 }}>
                  Paste a job link you found online. We&apos;ll extract the details and generate a cover letter.
                </p>

                <div style={{ marginTop: 12 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Job link</label>
                  <input
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://..."
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid var(--jp-input-border)",
                      backgroundColor: "var(--jp-input-bg)",
                      color: "var(--jp-input-fg)",
                    }}
                  />
                  {externalUrl.trim() && (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      <a href={externalUrl.trim()} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                        View link →
                      </a>
                    </div>
                  )}
                </div>

                {!!externalFormError && (
                  <div style={{ marginTop: 10, color: "#ef4444", fontSize: 12, whiteSpace: "pre-wrap" }}>
                    {externalFormError}
                  </div>
                )}

                <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={openCoverLetterLanguageModalForExternal}
                    disabled={Boolean(
                      coverLetterLoadingId &&
                        coverLetterLoadingId === (externalJobId || stableIdFromString("ext", externalUrl.trim()))
                    )}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid var(--jp-panel-border)",
                      background: "linear-gradient(180deg, rgba(168,85,247,0.95), rgba(126,34,206,0.95))",
                      color: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                      boxShadow: "var(--jp-shadow)",
                    }}
                    aria-label="Generate cover letter (external job)"
                    title="Generate cover letter"
                  >
                    {coverLetterLoadingId &&
                    coverLetterLoadingId === (externalJobId || stableIdFromString("ext", externalUrl.trim()))
                      ? "Extracting & generating..."
                      : "Generate cover letter"}
                  </button>
                </div>

                {/* Render the external cover letter using the same cache/state as internal jobs */}
                {(() => {
                  const id = externalJobId || (externalUrl.trim() ? stableIdFromString("ext", externalUrl.trim()) : "");
                  const text = id ? coverLetterByJobId[id] : "";
                  const err = id ? coverLetterErrorByJobId[id] : "";
                  if (!id) return null;
                  if (!text && !err && !externalJob?.title && !externalJob?.company && !externalJob?.location) return null;
                  const jobForDocx: Job = {
                    id,
                    title: externalJob?.title?.trim?.() || "Job opportunity",
                    company: externalJob?.company?.trim?.() || "Company",
                    location: externalJob?.location?.trim?.() || "",
                    url: externalUrl.trim(),
                    description: externalJob?.description?.trim?.() || "",
                  };
                  return (
                    <div style={{ marginTop: 12 }}>
                      {(externalJob?.title?.trim?.() ||
                        externalJob?.company?.trim?.() ||
                        externalJob?.location?.trim?.()) && (
                        <div style={{ fontSize: 12, opacity: 0.85 }}>
                          <div>
                            <strong>{externalJob?.title?.trim?.() || "Job opportunity"}</strong>
                          </div>
                          <div>
                            {externalJob?.company?.trim?.() || "Company"}
                            {externalJob?.location?.trim?.() ? ` • ${externalJob.location.trim()}` : ""}
                          </div>
                        </div>
                      )}

                      {!!err && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: 10,
                            borderRadius: 10,
                            border: "1px solid rgba(239,68,68,0.35)",
                            backgroundColor: "rgba(239,68,68,0.08)",
                            color: "var(--jp-panel-fg)",
                            whiteSpace: "pre-wrap",
                            fontSize: 12,
                          }}
                        >
                          {err}
                        </div>
                      )}
                      {!!text && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button
                              onClick={() => onCopyCoverLetter(id)}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 10,
                                border: "1px solid var(--jp-panel-border)",
                                backgroundColor: "var(--jp-panel-bg)",
                                color: "var(--jp-panel-fg)",
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: "pointer",
                              }}
                            >
                              Copy
                            </button>
                            <button
                              onClick={() => onDownloadCoverLetterDocx(jobForDocx)}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 10,
                                border: "1px solid var(--jp-panel-border)",
                                backgroundColor: "var(--jp-panel-bg)",
                                color: "var(--jp-panel-fg)",
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: "pointer",
                              }}
                            >
                              Download .docx
                            </button>
                          </div>
                          <textarea
                            value={text}
                            readOnly
                            style={{
                              marginTop: 10,
                              width: "100%",
                              minHeight: 220,
                              padding: 12,
                              borderRadius: 12,
                              border: "1px solid var(--jp-panel-border)",
                              backgroundColor: "var(--jp-panel-bg)",
                              color: "var(--jp-panel-fg)",
                              lineHeight: 1.55,
                              fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                              fontSize: 12,
                              resize: "vertical",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
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
                onClick={() => confirmCoverLetterLanguage("auto")}
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
                onClick={() => confirmCoverLetterLanguage("en")}
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
