"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { extractJobMetaFromDescription } from "@/lib/jobPostingMeta";
import {
  Briefcase,
  Bookmark,
  FileText,
  LayoutTemplate,
  Settings,
  LogOut,
  Search,
  ExternalLink,
  X,
  MapPin,
  Building2,
  Sparkles,
  Crown,
  Inbox,
  Copy,
  Download,
  ChevronDown,
} from "lucide-react";

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

type CoverLetterTemplate = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

const TEMPLATES_STORAGE_KEY = "jobPicks_coverLetterTemplates_v1";

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
    <Suspense fallback={<main className="jp-page">Loading…</main>}>
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

  // Helper function to check if we're logging out (defined once, used multiple times)
  const isLoggingOut = useCallback(() => {
    const ssFlag = sessionStorage.getItem('jobpicks_logging_out');
    const lsFlag = localStorage.getItem('jobpicks_logging_out');
    const cookieFlag = document.cookie.includes('jobpicks_logging_out=');
    const urlFlag = new URLSearchParams(window.location.search).get('logout');
    return !!(ssFlag || lsFlag || cookieFlag || urlFlag);
  }, []);

  // Sync candidate profile from Supabase when page loads
  useEffect(() => {
    const syncProfile = async () => {
      try {
        const { syncCandidateProfileToSupabase } = await import("@/lib/candidateProfile");
        await syncCandidateProfileToSupabase();
      } catch (error) {
        console.error("Error syncing candidate profile on home page:", error);
        // Continue anyway - not critical
      }
    };
    syncProfile();
  }, []);

  const [activeTab, setActiveTab] = useState<"picks" | "external">("picks");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<"free" | "premium">("free");
  const [coverLetterByJobId, setCoverLetterByJobId] = useState<Record<string, string>>({});
  const [coverLetterShortByJobId, setCoverLetterShortByJobId] = useState<Record<string, string>>({});
  const [coverLetterVeryShortByJobId, setCoverLetterVeryShortByJobId] = useState<Record<string, string>>({});
  const [coverLetterCreativeByJobId, setCoverLetterCreativeByJobId] = useState<Record<string, string>>({});
  const [selectedCoverLetterVersion, setSelectedCoverLetterVersion] = useState<
    Record<string, "long" | "short" | "very_short" | "creative">
  >({});
  const [customInstructionsByJobId, setCustomInstructionsByJobId] = useState<Record<string, string>>({});
  const [regeneratingVersion, setRegeneratingVersion] = useState<Record<string, "long" | "short" | "very_short" | "creative" | null>>({});
  const [coverLetterLoadingId, setCoverLetterLoadingId] = useState<string | null>(null);
  const [coverLetterErrorByJobId, setCoverLetterErrorByJobId] = useState<Record<string, string>>({});
  const [coverLetterLangModalOpen, setCoverLetterLangModalOpen] = useState(false);
  const [coverLetterLangModalJob, setCoverLetterLangModalJob] = useState<Job | null>(null);
  const [coverLetterLangModalSource, setCoverLetterLangModalSource] = useState<"job" | "external">("job");
  const [coverLetterTemplates, setCoverLetterTemplates] = useState<CoverLetterTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  // Paragraph settings: true = keep as-is (fixed), false = adapt to position
  const [templateParagraphSettings, setTemplateParagraphSettings] = useState<Record<number, boolean>>({});

  const [profileRaw, setProfileRaw] = useState<string | null>(null);

  const [externalJobId, setExternalJobId] = useState<string>("");
  const [externalUrl, setExternalUrl] = useState<string>("");
  const [externalJobTitle, setExternalJobTitle] = useState<string>("");
  const [externalJobCompany, setExternalJobCompany] = useState<string>("");
  const [externalJobLocation, setExternalJobLocation] = useState<string>("");
  const [externalJobDescription, setExternalJobDescription] = useState<string>("");
  const [externalAiInstructions, setExternalAiInstructions] = useState<string>("");
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

  // Load cover letter templates from Supabase or localStorage
  const loadCoverLetterTemplates = useCallback(async () => {
    try {
      // Try to load from Supabase first
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data, error } = await supabase
          .from("cover_letter_templates")
          .select("*")
          .eq("user_id", session.user.id)
          .order("updated_at", { ascending: false });
        
        if (!error && data) {
          const formatted = data.map((t: any) => ({
            id: t.id,
            name: t.name,
            content: t.content,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
          }));
          setCoverLetterTemplates(formatted);
          return;
        }
      }
      
      // Fallback to localStorage
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCoverLetterTemplates(Array.isArray(parsed) ? parsed : []);
      } else {
        setCoverLetterTemplates([]);
      }
    } catch (e) {
      console.error("Error loading cover letter templates:", e);
      setCoverLetterTemplates([]);
    }
  }, []);

  // Load templates on mount
  useEffect(() => {
    loadCoverLetterTemplates();
  }, [loadCoverLetterTemplates]);

  // Helper to check if a text block is a "real paragraph" (not just personal info, dates, or addresses)
  const isRealParagraph = useCallback((text: string): boolean => {
    const trimmed = text.trim();
    const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // If it's a multi-line block where most lines are short, it's likely contact info
    if (lines.length > 1) {
      const shortLines = lines.filter(l => l.length < 50);
      // If more than 60% of lines are short, it's probably contact info or header
      if (shortLines.length / lines.length > 0.6) return false;
    }
    
    // Check for contact info patterns (email, phone)
    const hasEmail = /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(trimmed);
    const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/.test(trimmed);
    
    // If block is relatively short and contains email/phone, it's contact info
    if ((hasEmail || hasPhone) && trimmed.length < 200) return false;
    
    // Must have at least one substantial sentence (a line with 80+ chars, or ends with sentence punctuation)
    const hasSubstantialLine = lines.some(line => {
      // Line is long enough to be a sentence
      if (line.length >= 80) return true;
      // Line ends with sentence-ending punctuation and has meaningful length
      if (line.length >= 50 && /[.!?]$/.test(line)) return true;
      return false;
    });
    
    if (!hasSubstantialLine) return false;
    
    // Total content should be substantial
    const totalLength = trimmed.length;
    const wordCount = trimmed.split(/\s+/).length;
    
    // Need at least 100 characters and 15 words for a real paragraph
    return totalLength >= 100 && wordCount >= 15;
  }, []);

  // Parse the selected template into paragraphs (only real content paragraphs, not headers/names/dates)
  const selectedTemplateParagraphs = useMemo(() => {
    if (!selectedTemplateId) return [];
    const template = coverLetterTemplates.find(t => t.id === selectedTemplateId);
    if (!template) return [];
    
    // Split by double newlines (paragraph breaks)
    const allBlocks = template.content
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    // Filter to keep only real paragraphs (not names, dates, addresses, short headers)
    const realParagraphs = allBlocks.filter(block => isRealParagraph(block));
    
    return realParagraphs;
  }, [selectedTemplateId, coverLetterTemplates, isRealParagraph]);

  // Reset paragraph settings when template changes
  useEffect(() => {
    if (selectedTemplateId && selectedTemplateParagraphs.length > 0) {
      // Default: all paragraphs are adaptable (false = adapt to position)
      const defaultSettings: Record<number, boolean> = {};
      selectedTemplateParagraphs.forEach((_, index) => {
        defaultSettings[index] = false; // false = adapt, true = keep fixed
      });
      setTemplateParagraphSettings(defaultSettings);
    } else {
      setTemplateParagraphSettings({});
    }
  }, [selectedTemplateId, selectedTemplateParagraphs]);

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

  const hasCandidateProfile = useCallback(async (): Promise<boolean> => {
    const { hasCandidateProfile: check } = await import("@/lib/candidateProfile");
    return check();
  }, []);

  const readCandidateProfile = useCallback(async (): Promise<any | null> => {
    const { loadCandidateProfile } = await import("@/lib/candidateProfile");
    return loadCandidateProfile();
  }, []);

  // Hydrate the external-job panel from the last draft (so pasting survives refresh/setup redirect)
  useEffect(() => {
    const draft = readExternalJobDraft();
    if (!draft) return;
    setExternalJobId(String(draft.id || ""));
    setExternalUrl(String(draft.url || ""));
    setExternalJobTitle(draft.title || "");
    setExternalJobCompany(draft.company || "");
    setExternalJobLocation(draft.location || "");
    setExternalJobDescription(draft.description || "");
    setExternalJob(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep draft up-to-date while user edits (best-effort)
  useEffect(() => {
    const url = externalUrl.trim();
    if (!url) return;
    const id = externalJobId || stableIdFromString("ext", url);
    writeExternalJobDraft({
      id,
      url,
      title: externalJobTitle.trim() || externalJob?.title || "",
      company: externalJobCompany.trim() || externalJob?.company || "",
      location: externalJobLocation.trim() || externalJob?.location || "",
      description: externalJobDescription.trim() || externalJob?.description || "",
      updatedAt: new Date().toISOString(),
    });
  }, [
    externalUrl,
    externalJobId,
    externalJobTitle,
    externalJobCompany,
    externalJobLocation,
    externalJobDescription,
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

  const onGenerateCoverLetter = useCallback(async (job: Job, preferredLanguage: "auto" | "en" = "auto", customTemplate?: string, paragraphSettings?: Record<number, boolean>, customInstructions?: string) => {
    const jobId = String(job.id);
    setCoverLetterErrorByJobId((prev) => ({ ...prev, [jobId]: "" }));

    // First-time setup gate
    const hasProfile = await hasCandidateProfile();
    if (!hasProfile) {
      router.push(
        `/cover-letter/setup?returnTo=${encodeURIComponent("/home")}&jobId=${encodeURIComponent(jobId)}&lang=${encodeURIComponent(preferredLanguage)}`
      );
      return;
    }

    // Cache hit - skip cache if using a custom template
    const cache = readCoverLetterCache();
    if (!customTemplate && cache[jobId]?.text && cache[jobId]?.lang === preferredLanguage) {
      const cached = cache[jobId];
      setCoverLetterByJobId((prev) => ({ ...prev, [jobId]: cached.text }));
      if (cached.textShort) {
        setCoverLetterShortByJobId((prev) => ({ ...prev, [jobId]: cached.textShort! }));
      }
      if (cached.textVeryShort) {
        setCoverLetterVeryShortByJobId((prev) => ({ ...prev, [jobId]: cached.textVeryShort! }));
      }
      if (cached.textCreative) {
        setCoverLetterCreativeByJobId((prev) => ({ ...prev, [jobId]: cached.textCreative! }));
      }
      // Default to long version if not selected
      if (!selectedCoverLetterVersion[jobId]) {
        setSelectedCoverLetterVersion((prev) => ({ ...prev, [jobId]: "long" }));
      }
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
          profile: parsedProfile,
          candidate,
          preferredLanguage,
          customTemplate,
          paragraphSettings,
          customInstructions,
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

      setCoverLetterByJobId((prev) => ({ ...prev, [jobId]: text }));
      if (textShort) {
        setCoverLetterShortByJobId((prev) => ({ ...prev, [jobId]: textShort }));
      }
      if (textVeryShort) {
        setCoverLetterVeryShortByJobId((prev) => ({ ...prev, [jobId]: textVeryShort }));
      }
      if (textCreative) {
        setCoverLetterCreativeByJobId((prev) => ({ ...prev, [jobId]: textCreative }));
      }
      // Default to long version
      setSelectedCoverLetterVersion((prev) => ({ ...prev, [jobId]: "long" }));

      const nextCache: CoverLetterCache = {
        ...cache,
        [jobId]: {
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
      setCoverLetterErrorByJobId((prev) => ({
        ...prev,
        [jobId]: e?.message || "Failed to generate cover letter",
      }));
    } finally {
      setCoverLetterLoadingId(null);
    }
  }, [hasCandidateProfile, parsedProfile, readCandidateProfile, readCoverLetterCache, router, writeCoverLetterCache]);

  const onCopyCoverLetter = useCallback(async (jobId: string) => {
    const version = selectedCoverLetterVersion[jobId] || "long";
    const text =
      version === "creative"
        ? coverLetterCreativeByJobId[jobId] || coverLetterByJobId[jobId]
        : version === "very_short"
        ? coverLetterVeryShortByJobId[jobId] || coverLetterShortByJobId[jobId] || coverLetterByJobId[jobId]
        : version === "short"
        ? coverLetterShortByJobId[jobId] || coverLetterByJobId[jobId]
        : coverLetterByJobId[jobId];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }, [coverLetterByJobId, coverLetterShortByJobId, coverLetterVeryShortByJobId, coverLetterCreativeByJobId, selectedCoverLetterVersion, readCandidateProfile, parsedProfile]);

  const onDownloadCoverLetterDocx = useCallback(async (job: Job) => {
    const jobId = String(job.id);
    const version = selectedCoverLetterVersion[jobId] || "long";
    const text =
      version === "creative"
        ? coverLetterCreativeByJobId[jobId] || coverLetterByJobId[jobId]
        : version === "very_short"
        ? coverLetterVeryShortByJobId[jobId] || coverLetterShortByJobId[jobId] || coverLetterByJobId[jobId]
        : version === "short"
        ? coverLetterShortByJobId[jobId] || coverLetterByJobId[jobId]
        : coverLetterByJobId[jobId];
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

  const onGenerateExternalCoverLetter = useCallback(async (preferredLanguage: "auto" | "en" = "auto", customTemplate?: string, paragraphSettings?: Record<number, boolean>, customInstructions?: string) => {
    setExternalFormError(null);
    const url = externalUrl.trim();
    const description = externalJobDescription.trim();
    const title = externalJobTitle.trim();
    const company = externalJobCompany.trim();
    
    // Link is optional if description, title, or company is provided
    if (!url && !description && !title && !company) {
      setExternalFormError("Please provide either a job link or at least a job description/title/company.");
      return;
    }
    
    // If URL is provided, it must be valid
    if (url && !/^https?:\/\//i.test(url)) {
      setExternalFormError("Please paste a valid link starting with http:// or https://");
      return;
    }

    // Use URL for ID if available, otherwise use a combination of title/company
    const id = url ? stableIdFromString("ext", url) : stableIdFromString("ext", `${title}_${company}_${Date.now()}`);
    setExternalJobId(id);

    // Extract job details from the link server-side (only if URL is provided)
    let extractedTitle = "";
    let extractedCompany = "";
    let extractedLocation = "";
    let extractedDescription = "";
    setCoverLetterErrorByJobId((prev) => ({ ...prev, [id]: "" }));
    
    if (url) {
      setCoverLetterLoadingId(id);
      try {
        const res = await fetch("/api/extract-job", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // If extraction fails but we have manual data, continue anyway
          if (!description && !title && !company) {
            throw new Error(data?.error || "Failed to extract job details from the link");
          }
        } else {
          const jobFromLink = data?.job;
          extractedTitle = String(jobFromLink?.title || "");
          extractedCompany = String(jobFromLink?.company || "");
          extractedLocation = String(jobFromLink?.location || "");
          extractedDescription = String(jobFromLink?.description || "");
        }
      } catch (e: any) {
        // If we have manual data, continue anyway
        if (!description && !title && !company) {
          const msg =
            e?.message ||
            "We couldn't extract the job details from this link (the website may block automated access).";
          setExternalFormError(msg);
          setCoverLetterErrorByJobId((prev) => ({
            ...prev,
            [id]: msg,
          }));
          setCoverLetterLoadingId(null);
          return;
        }
      } finally {
        setCoverLetterLoadingId(null);
      }
    }

    // Use manually entered fields if available, otherwise use extracted values
    const finalTitle = title || extractedTitle.trim() || "Job opportunity";
    const finalCompany = company || extractedCompany.trim() || "Company";
    const finalLocation = externalJobLocation.trim() || extractedLocation.trim();
    const finalDescription = description || extractedDescription;

    const draft: ExternalJobDraft = {
      id,
      url: url || "",
      title: finalTitle,
      company: finalCompany,
      location: finalLocation,
      description: finalDescription,
      updatedAt: new Date().toISOString(),
    };
    setExternalJob(draft);
    writeExternalJobDraft(draft);

    const job: Job = {
      id,
      title: finalTitle,
      company: finalCompany,
      location: finalLocation,
      url,
      description: finalDescription,
    };

    await onGenerateCoverLetter(job, preferredLanguage, customTemplate, paragraphSettings, customInstructions);
  }, [
    externalUrl,
    externalJobTitle,
    externalJobCompany,
    externalJobLocation,
    externalJobDescription,
    externalAiInstructions,
    onGenerateCoverLetter,
    writeExternalJobDraft,
  ]);

  const confirmCoverLetterLanguage = useCallback(
    async (lang: "auto" | "en") => {
      setCoverLetterLangModalOpen(false);
      // Get the selected template content if one is selected
      const customTemplate = selectedTemplateId 
        ? coverLetterTemplates.find(t => t.id === selectedTemplateId)?.content 
        : undefined;
      
      // Build paragraph settings for the API
      // Format: { paragraphIndex: true (fixed) | false (adapt) }
      const paragraphSettings = selectedTemplateId && Object.keys(templateParagraphSettings).length > 0
        ? templateParagraphSettings
        : undefined;
      
      try {
        if (coverLetterLangModalSource === "external") {
          // For external jobs, pass the AI instructions from the form
          const customInstructions = externalAiInstructions.trim() || undefined;
          await onGenerateExternalCoverLetter(lang, customTemplate, paragraphSettings, customInstructions);
          return;
        }
        if (coverLetterLangModalJob) {
          await onGenerateCoverLetter(coverLetterLangModalJob, lang, customTemplate, paragraphSettings);
        }
      } finally {
        setCoverLetterLangModalJob(null);
        setSelectedTemplateId(null); // Reset template selection after generating
        setTemplateParagraphSettings({}); // Reset paragraph settings
      }
    },
    [coverLetterLangModalJob, coverLetterLangModalSource, onGenerateCoverLetter, onGenerateExternalCoverLetter, selectedTemplateId, coverLetterTemplates, templateParagraphSettings, externalAiInstructions]
  );

  // 1) Gate di accesso: solo profilo (login già fatto prima)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Don't run if we're logging out (check all storage locations and URL)
      if (isLoggingOut()) {
        // If we're on login page, clear all flags
        if (window.location.pathname.includes('/login')) {
          sessionStorage.removeItem('jobpicks_logging_out');
          localStorage.removeItem('jobpicks_logging_out');
          document.cookie = 'jobpicks_logging_out=; path=/; max-age=0';
          // Clean URL
          const url = new URL(window.location.href);
          url.searchParams.delete('logout');
          window.history.replaceState({}, '', url.toString());
        }
        return;
      }
      
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
      // MA solo se non siamo sulla pagina login e non stiamo facendo logout
      if (!session && !window.location.pathname.includes('/login') && !isLoggingOut()) {
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
      
      // Don't proceed if we're logging out (check all storage locations and URL)
      if (isLoggingOut()) {
        return;
      }

      // If no session, redirect to login (unless we're already there)
      if (!session) {
        if (!window.location.pathname.includes('/login')) {
          router.replace("/login");
          return;
        }
        // If we're on login page and no session, don't try to restore from localStorage
        return;
      }

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
        // Don't restore from localStorage if we're on login page or logging out
        if (!window.location.pathname.includes('/login') && !isLoggingOut()) {
          const savedEmail = localStorage.getItem('jobpicks_user_email');
          if (savedEmail) {
            setEmail(savedEmail);
            setUserName(savedEmail.split("@")[0]);
          }
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
    // BUT: Don't poll if we're logging out
    const intervalId = setInterval(() => {
      if (isLoggingOut()) {
        return; // Don't update if logging out
      }
      if (!email) {
        updateUserInfo();
      }
    }, 1000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Don't restore session if we're logging out (check all storage locations)
      if (isLoggingOut()) {
        return;
      }
      
      // Don't restore on SIGNED_OUT event
      if (event === 'SIGNED_OUT') {
        // Clear all flags when we receive SIGNED_OUT
        sessionStorage.removeItem('jobpicks_logging_out');
        localStorage.removeItem('jobpicks_logging_out');
        document.cookie = 'jobpicks_logging_out=; path=/; max-age=0';
        return;
      }
      
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
        // Se la sessione è null, prova a recuperarla solo se non stiamo facendo logout
        if (!isLoggingOut()) {
          updateUserInfo();
        }
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
    try {
      // Set a flag to prevent auto-restore after logout (use both sessionStorage and localStorage for reliability)
      // Use a timestamp to make it unique and harder to bypass
      const logoutTimestamp = Date.now().toString();
      sessionStorage.setItem('jobpicks_logging_out', logoutTimestamp);
      localStorage.setItem('jobpicks_logging_out', logoutTimestamp);
      
      // Also set a cookie as additional safeguard (works better on mobile)
      // Use longer expiration on mobile
      const isMobileCookie = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const cookieMaxAge = isMobileCookie ? 30 : 10;
      document.cookie = `jobpicks_logging_out=${logoutTimestamp}; path=/; max-age=${cookieMaxAge}; SameSite=Strict`;
      
      // Clear Supabase session with global scope to clear all sessions
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error("Logout error:", error);
      }
      
      // Clear all localStorage data that might cause auto-login
      localStorage.removeItem('jobpicks_user_email');
      
      // Detect mobile for longer delays
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Wait longer on mobile to ensure signOut completes and all listeners have processed
      // Mobile browsers need more time to process storage operations and event handlers
      const waitTime = isMobile ? 1000 : 500;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Double-check that session is actually cleared
      const { data: { session: verifySession } } = await supabase.auth.getSession();
      if (verifySession) {
        // If session still exists, try signOut again
        console.warn("Session still exists after logout, retrying...");
        await supabase.auth.signOut({ scope: 'global' });
        await new Promise(resolve => setTimeout(resolve, isMobile ? 500 : 300));
      }
      
      // Clear sessionStorage flag after a longer delay (mobile needs more time)
      const clearDelay = isMobile ? 10000 : 5000;
      setTimeout(() => {
        sessionStorage.removeItem('jobpicks_logging_out');
        localStorage.removeItem('jobpicks_logging_out');
        // Clear cookie
        document.cookie = 'jobpicks_logging_out=; path=/; max-age=0';
      }, clearDelay);
      
      // Force a hard redirect to login to prevent any useEffect from interfering
      // Add a timestamp and logout flag to prevent cache issues
      // Use replace on mobile for better reliability
      const redirectUrl = `/login?logout=${logoutTimestamp}&t=${Date.now()}`;
      if (isMobile || window.location.replace) {
        window.location.replace(redirectUrl);
      } else {
        window.location.href = redirectUrl;
      }
    } catch (error) {
      console.error("Error during logout:", error);
      // Even if there's an error, try to redirect
      const logoutTimestamp = Date.now().toString();
      const isMobileError = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      localStorage.setItem('jobpicks_logging_out', logoutTimestamp);
      sessionStorage.setItem('jobpicks_logging_out', logoutTimestamp);
      document.cookie = `jobpicks_logging_out=${logoutTimestamp}; path=/; max-age=30; SameSite=Strict`;
      
      const redirectUrl = `/login?logout=${logoutTimestamp}&t=${Date.now()}`;
      if (isMobileError || window.location.replace) {
        window.location.replace(redirectUrl);
      } else {
        window.location.href = redirectUrl;
      }
    }
  }

  function editProfile() {
    router.push("/profile/edit");
  }

  // State for search/filter
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filter jobs based on search query
  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    const q = searchQuery.toLowerCase();
    return jobs.filter(
      (job) =>
        job.title?.toLowerCase().includes(q) ||
        job.company?.toLowerCase().includes(q) ||
        job.location?.toLowerCase().includes(q)
    );
  }, [jobs, searchQuery]);

  // UI di stato (evita flash strani e rimbalzi)
  if (gate === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="flex items-center gap-3 text-lg" style={{ color: "var(--foreground)" }}>
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Loading your account...
        </div>
      </div>
    );
  }

  if (gate === "need_profile") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="flex items-center gap-3 text-lg" style={{ color: "var(--foreground)" }}>
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Redirecting to profile...
        </div>
      </div>
    );
  }

  // gate === "ready"
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl" style={{ 
        borderBottom: "1px solid var(--border)", 
        background: "rgba(var(--background), 0.8)" 
      }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
          {/* Left: Logo & User */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
                <Briefcase className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Job Picks</span>
            </div>
            <div className="hidden items-center gap-3 text-sm md:flex" style={{ color: "var(--muted-foreground)" }}>
              <span style={{ opacity: 0.5 }}>|</span>
              <span>{email ?? "-"}</span>
              {subscriptionTier === "premium" ? (
                <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium" style={{
                  background: "rgba(234, 179, 8, 0.2)",
                  color: "var(--warning)",
                  border: "1px solid rgba(234, 179, 8, 0.3)"
                }}>
                  <Crown className="h-3 w-3" />
                  Premium
                </div>
              ) : (
                <Link
                  href="/upgrade"
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{
                    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                    color: "white"
                  }}
                >
                  Upgrade →
                </Link>
              )}
            </div>
          </div>

          {/* Right: Navigation */}
          <nav className="hidden items-center gap-1 lg:flex">
            <Link
              href="/saved"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 hover:opacity-80"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Bookmark className="h-4 w-4" />
              Saved jobs
            </Link>
            <Link
              href={`/cover-letter/setup?returnTo=${encodeURIComponent("/home")}`}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 hover:opacity-80"
              style={{ color: "var(--muted-foreground)" }}
            >
              <FileText className="h-4 w-4" />
              CV
            </Link>
            <Link
              href="/cover-letters"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 hover:opacity-80"
              style={{ color: "var(--muted-foreground)" }}
            >
              <LayoutTemplate className="h-4 w-4" />
              Templates
            </Link>
            <button
              onClick={editProfile}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 gradient-primary text-white hover:opacity-90"
            >
              <Settings className="h-4 w-4" />
              Edit job search
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 hover:opacity-80"
              style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </nav>

          {/* Mobile menu button */}
          <button 
            className="flex h-10 w-10 items-center justify-center rounded-lg lg:hidden"
            style={{ color: "var(--foreground)" }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <ChevronDown className={`h-5 w-5 transition-transform ${mobileMenuOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden px-4 pb-4 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
            <Link href="/saved" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium" style={{ color: "var(--foreground)" }}>
              <Bookmark className="h-4 w-4" /> Saved jobs
            </Link>
            <Link href={`/cover-letter/setup?returnTo=${encodeURIComponent("/home")}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium" style={{ color: "var(--foreground)" }}>
              <FileText className="h-4 w-4" /> CV
            </Link>
            <Link href="/cover-letters" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium" style={{ color: "var(--foreground)" }}>
              <LayoutTemplate className="h-4 w-4" /> Templates
            </Link>
            <button onClick={editProfile} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium gradient-primary text-white">
              <Settings className="h-4 w-4" /> Edit job search
            </button>
            <button onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        )}
      </header>

      <main className="h-[calc(100vh-73px)] overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
          {/* Tab Switcher */}
          <div className="mb-6 flex items-center gap-2 p-1.5 rounded-xl w-fit" style={{ background: "var(--secondary)" }}>
            <button
              onClick={() => setActiveTab("picks")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "picks"
                  ? "gradient-primary text-white shadow-md"
                  : "hover:bg-white/10"
              }`}
            >
              <Briefcase className="h-4 w-4" />
              Job Picks
            </button>
            <button
              onClick={() => setActiveTab("external")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "external"
                  ? "gradient-primary text-white shadow-md"
                  : "hover:bg-white/10"
              }`}
            >
              <ExternalLink className="h-4 w-4" />
              External Job
            </button>
          </div>

          {/* Job Picks Tab */}
          {activeTab === "picks" && (
            <>
              {/* Header */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Today's picks</h1>
                <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
                  {subscriptionTier === "premium"
                    ? "Showing up to 10 best matches for your profile"
                    : "Showing 3 picks for your profile"}
                </p>
              </div>

              <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between" style={{
              border: "1px solid var(--border)",
              background: "var(--card)"
            }}>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
                <input
                  type="text"
                  placeholder="Search jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none transition-all"
                  style={{
                    background: "var(--secondary)",
                    color: "var(--foreground)",
                    border: "none"
                  }}
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full sm:w-44 rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--secondary)",
                  color: "var(--foreground)",
                  border: "none"
                }}
              >
                <option value="relevance">Most relevant</option>
                <option value="recent">Most recent</option>
              </select>
            </div>

            {/* Loading state */}
            {jobsLoading && !error && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl p-5 animate-pulse" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                    <div className="space-y-3">
                      <div className="h-6 w-3/4 rounded" style={{ background: "var(--muted)" }} />
                      <div className="flex items-center gap-4">
                        <div className="h-4 w-28 rounded" style={{ background: "var(--muted)" }} />
                        <div className="h-4 w-24 rounded" style={{ background: "var(--muted)" }} />
                      </div>
                      <div className="h-4 w-full rounded" style={{ background: "var(--muted)" }} />
                      <div className="h-4 w-2/3 rounded" style={{ background: "var(--muted)" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="rounded-xl p-4" style={{ 
                border: "1px solid rgba(239, 68, 68, 0.3)",
                background: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444"
              }}>
                {error}
              </div>
            )}

            {/* Empty state */}
            {!jobsLoading && !error && filteredJobs.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl py-16 px-6 text-center" style={{
                border: "1px dashed var(--border)",
                background: "rgba(var(--card), 0.5)"
              }}>
                <div className="flex h-14 w-14 items-center justify-center rounded-full mb-4" style={{ background: "var(--muted)" }}>
                  <Inbox className="h-7 w-7" style={{ color: "var(--muted-foreground)" }} />
                </div>
                <h3 className="text-lg font-medium mb-1" style={{ color: "var(--foreground)" }}>No picks yet</h3>
                <p className="text-sm max-w-sm" style={{ color: "var(--muted-foreground)" }}>
                  {searchQuery ? "No jobs match your search. Try a different query." : "We're searching for the best matches. Check back soon or adjust your job preferences."}
                </p>
                <button
                  onClick={editProfile}
                  className="mt-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                  style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  <Settings className="h-4 w-4" />
                  Edit preferences
                </button>
              </div>
            )}

            {!jobsLoading && !error && filteredJobs.length > 0 && (
              <div className="space-y-4">
                {filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    className="group rounded-xl p-5 transition-all duration-200 animate-fade-in hover:border-purple-500/30"
                    style={{
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                    }}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      {/* Left: Job info */}
                      <div className="flex-1 space-y-3 min-w-0">
                        <h3 
                          className="text-lg font-semibold transition-colors group-hover:text-purple-400"
                          style={{ color: "var(--foreground)" }}
                        >
                          {job.title}
                        </h3>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
                          <span className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" />
                            {job.company}
                          </span>
                          {job.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" />
                              {job.location}
                            </span>
                          )}
                        </div>

                        {/* Metadata badges */}
                        {(() => {
                          const meta = extractJobMetaFromDescription(job.description);
                          const showLang = meta.language && meta.language !== "N/A";
                          const showAct = meta.activityRate && meta.activityRate !== "N/A";
                          const hasSalary = job.salaryMin || job.salaryMax;
                          if (!showLang && !showAct && !hasSalary) return null;
                          return (
                            <div className="flex flex-wrap gap-2">
                              {showLang && (
                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{
                                  background: "var(--secondary)",
                                  color: "var(--foreground)"
                                }}>
                                  {meta.language}
                                </span>
                              )}
                              {showAct && (
                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{
                                  background: "var(--secondary)",
                                  color: "var(--foreground)"
                                }}>
                                  {meta.activityRate}
                                </span>
                              )}
                              {hasSalary && (
                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{
                                  background: "rgba(16, 185, 129, 0.15)",
                                  color: "#10b981"
                                }}>
                                  💰 {job.salaryMin && job.salaryMax 
                                    ? `${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}` 
                                    : job.salaryMin 
                                    ? `From ${job.salaryMin.toLocaleString()}` 
                                    : `Up to ${job.salaryMax?.toLocaleString()}`}
                                </span>
                              )}
                            </div>
                          );
                        })()}

                        {job.description && (
                          <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                            {job.description.substring(0, 200)}
                            {job.description.length > 200 && "..."}
                          </p>
                        )}

                        {/* Actions row */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <a
                            href={job.url || "#"}
                            target="_blank"
                            rel="noreferrer noopener"
                            onClick={async (e) => {
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
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 gradient-primary"
                          >
                            View position
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>

                          <button
                            onClick={() => onSaveForLater(job)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                            style={{
                              background: "var(--secondary)",
                              color: "var(--foreground)"
                            }}
                          >
                            <Bookmark className="h-3.5 w-3.5" />
                            Save
                          </button>

                          <button
                            onClick={() => onDiscardJob(job)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:text-red-400"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            <X className="h-3.5 w-3.5" />
                            Discard
                          </button>
                        </div>
                      </div>

                      {/* Right: Generate CTA */}
                      <div className="lg:ml-4 lg:flex-shrink-0">
                        <button
                          onClick={() => openCoverLetterLanguageModalForJob(job)}
                          disabled={coverLetterLoadingId === String(job.id)}
                          className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 gradient-accent disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Sparkles className="h-4 w-4" />
                          {coverLetterLoadingId === String(job.id) ? "Generating..." : "Generate cover letter"}
                        </button>
                      </div>
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
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>Cover letter</div>
                        {(coverLetterShortByJobId[String(job.id)] ||
                          coverLetterVeryShortByJobId[String(job.id)] ||
                          coverLetterCreativeByJobId[String(job.id)]) && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <button
                              onClick={() =>
                                setSelectedCoverLetterVersion((prev) => ({
                                  ...prev,
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
                                setSelectedCoverLetterVersion((prev) => ({
                                  ...prev,
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
                            {coverLetterVeryShortByJobId[String(job.id)] && (
                              <button
                                onClick={() =>
                                  setSelectedCoverLetterVersion((prev) => ({
                                    ...prev,
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
                            {coverLetterCreativeByJobId[String(job.id)] && (
                              <button
                                onClick={() =>
                                  setSelectedCoverLetterVersion((prev) => ({
                                    ...prev,
                                    [String(job.id)]: "creative",
                                  }))
                                }
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 8,
                                  border: "1px solid var(--jp-panel-border)",
                                  backgroundColor:
                                    selectedCoverLetterVersion[String(job.id)] === "creative"
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
                        value={
                          (selectedCoverLetterVersion[String(job.id)] || "long") === "creative"
                            ? coverLetterCreativeByJobId[String(job.id)] || coverLetterByJobId[String(job.id)]
                            : (selectedCoverLetterVersion[String(job.id)] || "long") === "very_short"
                            ? coverLetterVeryShortByJobId[String(job.id)] ||
                              coverLetterShortByJobId[String(job.id)] ||
                              coverLetterByJobId[String(job.id)]
                            : (selectedCoverLetterVersion[String(job.id)] || "long") === "short"
                            ? coverLetterShortByJobId[String(job.id)] || coverLetterByJobId[String(job.id)]
                            : coverLetterByJobId[String(job.id)]
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
                      
                      {/* Custom Instructions Section */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                            Custom instructions (optional)
                          </label>
                          <textarea
                            value={customInstructionsByJobId[String(job.id)] || ""}
                            onChange={(e) => setCustomInstructionsByJobId((prev) => ({ ...prev, [String(job.id)]: e.target.value }))}
                            placeholder="e.g., 'Make it more formal', 'Add more technical details', 'Emphasize leadership experience', 'Make it shorter'..."
                            style={{
                              width: "100%",
                              minHeight: 60,
                              padding: 10,
                              borderRadius: 10,
                              border: "1px solid var(--jp-input-border)",
                              backgroundColor: "var(--jp-input-bg)",
                              color: "var(--jp-input-fg)",
                              fontSize: 12,
                              lineHeight: 1.5,
                              resize: "vertical",
                              fontFamily: "inherit",
                            }}
                          />
                        </div>
                        <button
                          onClick={async () => {
                            const jobId = String(job.id);
                            const version = selectedCoverLetterVersion[jobId] || "long";
                            const instructions = customInstructionsByJobId[jobId]?.trim();
                            
                            if (!instructions) {
                              setCoverLetterErrorByJobId((prev) => ({
                                ...prev,
                                [jobId]: "Please enter custom instructions first.",
                              }));
                              return;
                            }
                            
                            setRegeneratingVersion((prev) => ({ ...prev, [jobId]: version }));
                            setCoverLetterErrorByJobId((prev) => ({ ...prev, [jobId]: "" }));
                            
                            try {
                              const candidate = await readCandidateProfile();
                              // Get the current cover letter text for the selected version
                              const currentText =
                                version === "creative"
                                  ? coverLetterCreativeByJobId[jobId] || coverLetterByJobId[jobId]
                                  : version === "very_short"
                                  ? coverLetterVeryShortByJobId[jobId] || coverLetterShortByJobId[jobId] || coverLetterByJobId[jobId]
                                  : version === "short"
                                  ? coverLetterShortByJobId[jobId] || coverLetterByJobId[jobId]
                                  : coverLetterByJobId[jobId];
                              
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
                                  candidate,
                                  preferredLanguage: "auto",
                                  customInstructions: instructions,
                                  regenerateVersion: version,
                                  currentCoverLetter: currentText,
                                }),
                              });
                              
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) {
                                throw new Error(data?.error || "Failed to regenerate cover letter");
                              }
                              
                              // Update the specific version
                              if (version === "creative" && data.coverLetterCreative) {
                                setCoverLetterCreativeByJobId((prev) => ({ ...prev, [jobId]: data.coverLetterCreative }));
                              } else if (version === "very_short" && data.coverLetterVeryShort) {
                                setCoverLetterVeryShortByJobId((prev) => ({ ...prev, [jobId]: data.coverLetterVeryShort }));
                              } else if (version === "short" && data.coverLetterShort) {
                                setCoverLetterShortByJobId((prev) => ({ ...prev, [jobId]: data.coverLetterShort }));
                              } else if (version === "long" && data.coverLetter) {
                                setCoverLetterByJobId((prev) => ({ ...prev, [jobId]: data.coverLetter }));
                              }
                              
                              // Update cache
                              const cache = readCoverLetterCache();
                              const cached = cache[jobId] || { text: "", createdAt: new Date().toISOString(), lang: "auto" };
                              const updatedCache: CoverLetterCache = {
                                ...cache,
                                [jobId]: {
                                  ...cached,
                                  text: version === "long" ? (data.coverLetter || cached.text) : cached.text,
                                  textShort: version === "short" ? (data.coverLetterShort || cached.textShort) : cached.textShort,
                                  textVeryShort: version === "very_short" ? (data.coverLetterVeryShort || cached.textVeryShort) : cached.textVeryShort,
                                  textCreative: version === "creative" ? (data.coverLetterCreative || cached.textCreative) : cached.textCreative,
                                },
                              };
                              writeCoverLetterCache(updatedCache);
                            } catch (e: any) {
                              setCoverLetterErrorByJobId((prev) => ({
                                ...prev,
                                [jobId]: e?.message || "Failed to regenerate cover letter",
                              }));
                            } finally {
                              setRegeneratingVersion((prev) => ({ ...prev, [jobId]: null }));
                            }
                          }}
                          disabled={!customInstructionsByJobId[String(job.id)]?.trim() || !!regeneratingVersion[String(job.id)]}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 10,
                            border: "1px solid var(--jp-panel-border)",
                            background: "linear-gradient(180deg, rgba(59,130,246,0.95), rgba(37,99,235,0.95))",
                            color: "white",
                            fontWeight: 700,
                            cursor: customInstructionsByJobId[String(job.id)]?.trim() && !regeneratingVersion[String(job.id)] ? "pointer" : "not-allowed",
                            opacity: customInstructionsByJobId[String(job.id)]?.trim() && !regeneratingVersion[String(job.id)] ? 1 : 0.5,
                            fontSize: 12,
                          }}
                        >
                          {regeneratingVersion[String(job.id)] ? "Regenerating..." : "Regenerate with custom instructions"}
                        </button>
                      </div>
                    </div>
                  )}
                  </div>
                ))}
                <div
                  className="mt-4 pt-4 text-center text-xs"
                  style={{
                    borderTop: "1px solid var(--border)",
                    color: "var(--muted-foreground)"
                  }}
                >
                  Jobs by{" "}
                  <a href="https://www.adzuna.com" target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                    Adzuna
                  </a>
                </div>
              </div>
            )}
              </div>
            </>
          )}

          {/* External Job Tab */}
          {activeTab === "external" && (
            <>
              {/* Header */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--foreground)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center gradient-primary">
                    <ExternalLink className="h-5 w-5 text-white" />
                  </div>
                  Generate from External Job
                </h1>
                <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Paste a job URL or description to create a tailored cover letter
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column - Form */}
                <div className="rounded-xl p-6" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>

                {/* Job URL Input */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Job Link</label>
                  <div className="relative">
                    <input
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      placeholder="https://linkedin.com/jobs/..."
                      className="w-full p-3 pl-10 rounded-xl text-base transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      style={{
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--secondary)",
                        color: "var(--foreground)",
                      }}
                    />
                    <ExternalLink className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-40" />
                  </div>
                </div>

                {/* Optional fields - compact row */}
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <input
                    value={externalJobTitle}
                    onChange={(e) => setExternalJobTitle(e.target.value)}
                    placeholder="Job title"
                    className="w-full p-3 rounded-xl text-base transition-all focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                    style={{
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--secondary)",
                      color: "var(--foreground)",
                    }}
                  />
                  <input
                    value={externalJobCompany}
                    onChange={(e) => setExternalJobCompany(e.target.value)}
                    placeholder="Company"
                    className="w-full p-3 rounded-xl text-base transition-all focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                    style={{
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--secondary)",
                      color: "var(--foreground)",
                    }}
                  />
                  <input
                    value={externalJobLocation}
                    onChange={(e) => setExternalJobLocation(e.target.value)}
                    placeholder="Location"
                    className="w-full p-3 rounded-xl text-base transition-all focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                    style={{
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--secondary)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>

                <div className="mt-5">
                  <label className="block text-sm font-semibold mb-2 opacity-80">
                    Job description <span className="font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={externalJobDescription}
                    onChange={(e) => setExternalJobDescription(e.target.value)}
                    placeholder="Paste job description here..."
                    className="w-full h-28 p-4 rounded-xl text-base resize-none transition-all focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                    style={{
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--secondary)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>

                <div className="mt-5">
                  <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" style={{ color: "var(--primary)" }} />
                    AI Instructions <span className="font-normal opacity-60">(optional)</span>
                  </label>
                  <textarea
                    value={externalAiInstructions}
                    onChange={(e) => setExternalAiInstructions(e.target.value)}
                    placeholder="E.g.: 'Emphasize project management experience', 'Use formal tone'..."
                    className="w-full h-24 p-4 rounded-xl text-base resize-none transition-all focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                    style={{
                      border: "1px solid rgba(168,85,247,0.4)",
                      backgroundColor: "rgba(168,85,247,0.08)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>

                {!!externalFormError && (
                  <div className="mt-2 text-[10px] text-red-400 whitespace-pre-wrap">
                    {externalFormError}
                  </div>
                )}

                  <div className="mt-6">
                    <button
                      onClick={openCoverLetterLanguageModalForExternal}
                      disabled={Boolean(
                        coverLetterLoadingId &&
                          coverLetterLoadingId === (externalJobId || stableIdFromString("ext", externalUrl.trim()))
                      )}
                      className="w-full py-4 rounded-xl gradient-primary text-white font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-lg"
                      aria-label="Generate cover letter (external job)"
                      title="Generate cover letter"
                    >
                      {coverLetterLoadingId &&
                      coverLetterLoadingId === (externalJobId || (externalUrl.trim() ? stableIdFromString("ext", externalUrl.trim()) : ""))
                        ? <>
                            <span className="animate-spin">⏳</span>
                            {externalUrl.trim() ? "Extracting..." : "Generating..."}
                          </>
                        : <>
                            <Sparkles className="h-5 w-5" />
                            Generate Cover Letter
                          </>}
                    </button>
                  </div>
                </div>

                {/* Right column - Cover Letter Output */}
                <div className="rounded-xl p-6" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5" style={{ color: "var(--primary)" }} />
                    <span className="font-bold text-lg">Generated Cover Letter</span>
                  </div>

                {/* Render the external cover letter using the same cache/state as internal jobs */}
                {(() => {
                  const id = externalJobId || (externalUrl.trim() ? stableIdFromString("ext", externalUrl.trim()) : "");
                  const text = id ? coverLetterByJobId[id] : "";
                  const err = id ? coverLetterErrorByJobId[id] : "";
                  
                  // Empty state
                  if (!id || (!text && !err && !externalJob?.title && !externalJob?.company && !externalJob?.location)) {
                    return (
                      <div className="flex flex-col items-center justify-center text-center py-16 opacity-50">
                        <FileText className="h-16 w-16 mb-4" style={{ color: "var(--muted-foreground)" }} />
                        <p className="text-lg font-medium">No cover letter yet</p>
                        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                          Fill in the job details and click Generate
                        </p>
                      </div>
                    );
                  }
                  const jobForDocx: Job = {
                    id,
                    title: externalJob?.title?.trim?.() || "Job opportunity",
                    company: externalJob?.company?.trim?.() || "Company",
                    location: externalJob?.location?.trim?.() || "",
                    url: externalUrl.trim(),
                    description: externalJob?.description?.trim?.() || "",
                  };
                  return (
                    <div>
                      {(externalJob?.title?.trim?.() ||
                        externalJob?.company?.trim?.() ||
                        externalJob?.location?.trim?.()) && (
                        <div className="mb-4 p-4 rounded-xl" style={{ background: "var(--secondary)" }}>
                          <div className="font-semibold text-base">
                            {externalJob?.title?.trim?.() || "Job opportunity"}
                          </div>
                          <div className="text-sm opacity-70 mt-1">
                            {externalJob?.company?.trim?.() || "Company"}
                            {externalJob?.location?.trim?.() ? ` • ${externalJob.location.trim()}` : ""}
                          </div>
                        </div>
                      )}

                      {!!err && (
                        <div className="mb-4 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-sm whitespace-pre-wrap">
                          {err}
                        </div>
                      )}
                      {!!text && (
                        <div>
                            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                            {(coverLetterShortByJobId[id] || coverLetterVeryShortByJobId[id] || coverLetterCreativeByJobId[id]) && (
                              <div className="flex gap-1 items-center p-1 rounded-lg" style={{ background: "var(--secondary)" }}>
                                <button
                                  onClick={() => setSelectedCoverLetterVersion((prev) => ({ ...prev, [id]: "long" }))}
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                    (selectedCoverLetterVersion[id] || "long") === "long" 
                                      ? "gradient-primary text-white" 
                                      : "hover:bg-white/10"
                                  }`}
                                >
                                  Long
                                </button>
                                <button
                                  onClick={() => setSelectedCoverLetterVersion((prev) => ({ ...prev, [id]: "short" }))}
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                    selectedCoverLetterVersion[id] === "short" 
                                      ? "gradient-primary text-white" 
                                      : "hover:bg-white/10"
                                  }`}
                                >
                                  Short
                                </button>
                                {coverLetterVeryShortByJobId[id] && (
                                  <button
                                    onClick={() =>
                                      setSelectedCoverLetterVersion((prev) => ({
                                        ...prev,
                                        [id]: "very_short",
                                      }))
                                    }
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                      selectedCoverLetterVersion[id] === "very_short"
                                        ? "gradient-primary text-white"
                                        : "hover:bg-white/10"
                                    }`}
                                  >
                                    Short
                                  </button>
                                )}
                                {coverLetterCreativeByJobId[id] && (
                                  <button
                                    onClick={() =>
                                      setSelectedCoverLetterVersion((prev) => ({
                                        ...prev,
                                        [id]: "creative",
                                      }))
                                    }
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                      selectedCoverLetterVersion[id] === "creative"
                                        ? "bg-orange-500/20 text-orange-400"
                                        : "hover:bg-white/10"
                                    }`}
                                  >
                                    ✨
                                  </button>
                                )}
                              </div>
                            )}
                            <div className="flex gap-3">
                              <button
                                onClick={() => onCopyCoverLetter(id)}
                                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-90 gradient-primary text-white"
                              >
                                <Copy className="h-4 w-4" />
                                Copy
                              </button>
                              <button
                                onClick={() => onDownloadCoverLetterDocx(jobForDocx)}
                                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                                style={{
                                  background: "var(--secondary)",
                                  color: "var(--foreground)"
                                }}
                              >
                                <Download className="h-4 w-4" />
                                Download .docx
                              </button>
                            </div>
                          </div>
                          <textarea
                            value={
                              (selectedCoverLetterVersion[id] || "long") === "creative"
                                ? coverLetterCreativeByJobId[id] || text
                                : (selectedCoverLetterVersion[id] || "long") === "very_short"
                                ? coverLetterVeryShortByJobId[id] || coverLetterShortByJobId[id] || text
                                : (selectedCoverLetterVersion[id] || "long") === "short"
                                ? coverLetterShortByJobId[id] || text
                                : text
                            }
                            readOnly
                            className="w-full mt-4 p-5 rounded-xl text-base leading-relaxed resize-y"
                            style={{
                              minHeight: 350,
                              border: "1px solid var(--border)",
                              backgroundColor: "var(--secondary)",
                              color: "var(--foreground)",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

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
            <div style={{ fontWeight: 900, fontSize: 14 }}>Cover letter options</div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              Choose the language and optionally select a custom template.
            </div>

            {/* Template selector */}
            <div style={{ marginTop: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, opacity: 0.9 }}>
                Template
              </label>
              <select
                value={selectedTemplateId || ""}
                onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--jp-input-border)",
                  backgroundColor: "var(--jp-input-bg)",
                  color: "var(--jp-input-fg)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <option value="">Default template (auto-generated)</option>
                {coverLetterTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {coverLetterTemplates.length === 0 && (
                <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
                  No custom templates. <Link href="/cover-letters" style={{ color: "var(--jp-accent)", textDecoration: "underline" }}>Create one</Link>
                </div>
              )}
            </div>

            {/* Paragraph settings - only show when a template is selected */}
            {selectedTemplateId && selectedTemplateParagraphs.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, opacity: 0.9 }}>
                  Paragraph Settings
                </label>
                <div style={{ fontSize: 11, marginBottom: 10, opacity: 0.7 }}>
                  For each paragraph, choose whether to keep it exactly as written or adapt it to the job position.
                </div>
                <div 
                  style={{ 
                    maxHeight: 200, 
                    overflowY: "auto",
                    border: "1px solid var(--jp-input-border)",
                    borderRadius: 10,
                    backgroundColor: "var(--jp-input-bg)",
                  }}
                >
                  {selectedTemplateParagraphs.map((paragraph, index) => (
                    <div 
                      key={index}
                      style={{
                        padding: "10px 12px",
                        borderBottom: index < selectedTemplateParagraphs.length - 1 ? "1px solid var(--jp-input-border)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div 
                            style={{ 
                              fontSize: 11, 
                              fontWeight: 600, 
                              marginBottom: 4,
                              color: templateParagraphSettings[index] ? "var(--jp-accent)" : "var(--jp-panel-fg)",
                              opacity: templateParagraphSettings[index] ? 1 : 0.7,
                            }}
                          >
                            Paragraph {index + 1} {templateParagraphSettings[index] ? "(Keep as-is)" : "(Adapt to position)"}
                          </div>
                          <div 
                            style={{ 
                              fontSize: 11, 
                              opacity: 0.8,
                              whiteSpace: "pre-wrap",
                              overflow: "hidden",
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              lineHeight: 1.4,
                            }}
                          >
                            {paragraph.length > 150 ? paragraph.substring(0, 150) + "..." : paragraph}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setTemplateParagraphSettings(prev => ({
                              ...prev,
                              [index]: !prev[index]
                            }));
                          }}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: templateParagraphSettings[index] 
                              ? "1px solid var(--jp-accent)" 
                              : "1px solid var(--jp-input-border)",
                            backgroundColor: templateParagraphSettings[index] 
                              ? "rgba(59,130,246,0.15)" 
                              : "transparent",
                            color: templateParagraphSettings[index] 
                              ? "var(--jp-accent)" 
                              : "var(--jp-panel-fg)",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: 10,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {templateParagraphSettings[index] ? "Fixed ✓" : "Adapt"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Language selector */}
            <div style={{ marginTop: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, opacity: 0.9 }}>
                Language
              </label>
              <div style={{ display: "grid", gap: 10 }}>
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
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setCoverLetterLangModalOpen(false);
                  setSelectedTemplateId(null);
                  setTemplateParagraphSettings({});
                }}
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
    </div>
  );
}
