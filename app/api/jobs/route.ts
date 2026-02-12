import { NextResponse } from "next/server";

// ============================================================================
// DIAGNOSIS: Root Causes of Zero-Result Queries
// ============================================================================
// 1. Query Construction: Using raw "crm" instead of expanded "CRM Manager" or synonyms
// 2. Location Normalization: "Milano" not mapped to "Milan", "Lombardia", or variations
// 3. No Query Expansion: Missing synonym dictionary (CRM -> Customer Relationship Management)
// 4. Strict Filtering: City filter too restrictive, no fallback to region/country
// 5. Tokenization: Case-sensitive matching, no fuzzy/partial matching
// 6. No Fallback Mechanism: If strict query returns 0, doesn't broaden search

// ============================================================================
// STAGE 1: QUERY EXPANSION & SYNONYM DICTIONARY
// ============================================================================

// Synonym dictionary for common job title acronyms and short inputs
const JOB_TITLE_SYNONYMS: Record<string, string[]> = {
  // CRM users often mean CRM platforms/ops roles too (Salesforce/HubSpot/etc.) — helps premium always get 3 relevant picks.
  "crm": [
    "customer relationship management",
    "customer relationship manager",
    "crm manager",
    "crm specialist",
    "crm analyst",
    "salesforce",
    "salesforce administrator",
    "salesforce consultant",
    "hubspot",
    "hubspot crm",
    "customer lifecycle",
    "loyalty",
  ],
  "hr": ["human resources", "hr manager", "hr specialist", "hr business partner", "people operations"],
  "it": ["information technology", "it specialist", "it support", "it technician", "systems administrator"],
  "qa": ["quality assurance", "qa engineer", "qa tester", "quality analyst", "test engineer"],
  "pm": ["product manager", "project manager", "program manager", "pm", "product owner"],
  "ui": ["user interface", "ui designer", "ui developer", "ui/ux designer"],
  "ux": ["user experience", "ux designer", "ux researcher", "ux/ui designer"],
  "dev": ["developer", "software developer", "web developer", "application developer"],
  "seo": ["search engine optimization", "seo specialist", "seo analyst", "seo manager"],
  "cmo": ["chief marketing officer", "marketing director", "head of marketing"],
  "cto": ["chief technology officer", "technology director", "head of technology"],
  "cfo": ["chief financial officer", "finance director", "head of finance"],
};

// Expand query with synonyms and related terms
export function expandQuery(role: string): string[] {
  const roleLower = role.toLowerCase().trim();
  const expansions: string[] = [role]; // Always include original
  
  // Check if role is in synonym dictionary
  if (JOB_TITLE_SYNONYMS[roleLower]) {
    expansions.push(...JOB_TITLE_SYNONYMS[roleLower]);
  }
  
  // For acronyms (2-4 chars, all caps or mixed), add variations
  if (role.length >= 2 && role.length <= 4 && /^[A-Za-z]+$/.test(role)) {
    // Add uppercase version
    expansions.push(role.toUpperCase());
    // Add title case version
    expansions.push(role.charAt(0).toUpperCase() + role.slice(1).toLowerCase());
  }
  
  return [...new Set(expansions)]; // Remove duplicates
}

// Build expanded search query for Adzuna API
function buildSearchQuery(roles: string[]): string {
  if (roles.length === 0) return "";
  
  const primaryRole = roles[0];
  const expansions = expandQuery(primaryRole);
  
  // Use the most specific expansion (longest) for better recall
  // But prioritize original if it's already descriptive
  const bestQuery = expansions
    .sort((a, b) => {
      // Prefer original if it's multi-word
      if (primaryRole.includes(" ") && a === primaryRole) return -1;
      if (primaryRole.includes(" ") && b === primaryRole) return 1;
      // Otherwise prefer longer, more descriptive terms
      return b.length - a.length;
    })[0];
  
  return bestQuery;
}

// ============================================================================
// STAGE 2: LOCATION NORMALIZATION & EXPANSION
// ============================================================================

// Comprehensive city normalization map (Italian cities to English/Adzuna format)
const CITY_NORMALIZATION_MAP: Record<string, string[]> = {
  // Italian cities -> English names + variations
  "milano": ["Milan", "Milano", "Milano (MI)", "Lombardia", "Lombardy"],
  "roma": ["Rome", "Roma", "Roma (RM)", "Lazio"],
  "napoli": ["Naples", "Napoli", "Napoli (NA)", "Campania"],
  "torino": ["Turin", "Torino", "Torino (TO)", "Piemonte", "Piedmont"],
  "firenze": ["Florence", "Firenze", "Firenze (FI)", "Toscana", "Tuscany"],
  "genova": ["Genoa", "Genova", "Genova (GE)", "Liguria"],
  "bologna": ["Bologna", "Bologna (BO)", "Emilia-Romagna"],
  "venezia": ["Venice", "Venezia", "Venezia (VE)", "Veneto"],
  "palermo": ["Palermo", "Palermo (PA)", "Sicilia", "Sicily"],
  "bari": ["Bari", "Bari (BA)", "Puglia", "Apulia"],
  "catania": ["Catania", "Catania (CT)", "Sicilia", "Sicily"],
  "verona": ["Verona", "Verona (VR)", "Veneto"],
  "padova": ["Padua", "Padova", "Padova (PD)", "Veneto"],
  "trieste": ["Trieste", "Trieste (TS)", "Friuli-Venezia Giulia"],
  "brescia": ["Brescia", "Brescia (BS)", "Lombardia", "Lombardy"],
  "parma": ["Parma", "Parma (PR)", "Emilia-Romagna"],
  "modena": ["Modena", "Modena (MO)", "Emilia-Romagna"],
  "reggio calabria": ["Reggio Calabria", "Reggio Calabria (RC)", "Calabria"],
  "reggio emilia": ["Reggio Emilia", "Reggio Emilia (RE)", "Emilia-Romagna"],
  "perugia": ["Perugia", "Perugia (PG)", "Umbria"],
  "livorno": ["Livorno", "Livorno (LI)", "Toscana", "Tuscany"],
  "ravenna": ["Ravenna", "Ravenna (RA)", "Emilia-Romagna"],
  "cagliari": ["Cagliari", "Cagliari (CA)", "Sardegna", "Sardinia"],
  "foggia": ["Foggia", "Foggia (FG)", "Puglia", "Apulia"],
  "rimini": ["Rimini", "Rimini (RN)", "Emilia-Romagna"],
  "salerno": ["Salerno", "Salerno (SA)", "Campania"],
  "ferrara": ["Ferrara", "Ferrara (FE)", "Emilia-Romagna"],
  "sassari": ["Sassari", "Sassari (SS)", "Sardegna", "Sardinia"],
  "latina": ["Latina", "Latina (LT)", "Lazio"],
  "giugliano in campania": ["Giugliano in Campania", "Giugliano", "Campania"],
  "monza": ["Monza", "Monza (MB)", "Lombardia", "Lombardy"],
  "syracuse": ["Syracuse", "Siracusa", "Siracusa (SR)", "Sicilia", "Sicily"],
  "bergamo": ["Bergamo", "Bergamo (BG)", "Lombardia", "Lombardy"],
  "pescara": ["Pescara", "Pescara (PE)", "Abruzzo"],
  "trento": ["Trento", "Trento (TN)", "Trentino-Alto Adige"],
  "vicenza": ["Vicenza", "Vicenza (VI)", "Veneto"],
  "bolzano": ["Bolzano", "Bolzano (BZ)", "Trentino-Alto Adige", "Alto Adige"],
  "novara": ["Novara", "Novara (NO)", "Piemonte", "Piedmont"],
  "prato": ["Prato", "Prato (PO)", "Toscana", "Tuscany"],
  "arezzo": ["Arezzo", "Arezzo (AR)", "Toscana", "Tuscany"],
};

// Normalize city name for Adzuna API
export function normalizeCityForAdzuna(city: string): string {
  const cityLower = city.toLowerCase().trim();
  
  // Check normalization map
  if (CITY_NORMALIZATION_MAP[cityLower]) {
    // Return the first (most common) variant for Adzuna
    return CITY_NORMALIZATION_MAP[cityLower][0];
  }
  
  // Return original if not found
  return city;
}

// Get all location variants for matching (used in scoring)
export function getLocationVariants(city: string): string[] {
  const cityLower = city.toLowerCase().trim();
  const variants = [cityLower, city]; // Include original and lowercase
  
  if (CITY_NORMALIZATION_MAP[cityLower]) {
    variants.push(...CITY_NORMALIZATION_MAP[cityLower].map(v => v.toLowerCase()));
  }
  
  return [...new Set(variants)];
}

// ============================================================================
// STAGE 3: MULTI-PROVIDER JOB RETRIEVAL SYSTEM
// ============================================================================

// Common interface for all job providers
interface JobProvider {
  name: string;
  fetchJobs(params: {
    searchQuery: string;
    city?: string;
    country: string;
    countryCode?: string;
    page?: number;
    desiredCount?: number;
  }): Promise<{ results: any[]; count: number; provider: string }>;
}

interface AdzunaQueryParams {
  searchQuery: string;
  city?: string;
  countryCode: string;
  page: number;
}

// ============================================================================
// PROVIDER 1: ADZUNA
// ============================================================================

async function fetchFromAdzuna(
  appId: string,
  appKey: string,
  params: AdzunaQueryParams
): Promise<{ results: any[]; count: number; provider: string }> {
  const { searchQuery, city, countryCode, page } = params;
  
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${countryCode}/search/${page}`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("results_per_page", "50");
  url.searchParams.set("what", searchQuery);
  url.searchParams.set("content-type", "application/json");
  
  if (city) {
    url.searchParams.set("where", city);
  }
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Log first job structure for debugging (only in development)
  if (process.env.NODE_ENV === 'development' && data.results && data.results.length > 0) {
    const firstJob = data.results[0];
    console.log('[Adzuna API Response] First job URL fields:', {
      'redirect_url': firstJob.redirect_url,
      'url': firstJob.url,
      'external_url': firstJob.external_url,
      'link': firstJob.link,
      'original_url': firstJob.original_url,
      'source_url': firstJob.source_url,
      'company.url': firstJob.company?.url,
      'allKeys': Object.keys(firstJob).filter(k => k.toLowerCase().includes('url') || k.toLowerCase().includes('link'))
    });
  }
  
  return {
    results: data.results || [],
    count: data.count || 0,
    provider: "adzuna",
  };
}

// Progressive query broadening strategy
async function fetchJobsWithFallback(
  appId: string,
  appKey: string,
  roles: string[],
  country: string,
  city: string | null,
  desiredCount: number = 50,
  excludeIds?: Set<string>
): Promise<any[]> {
  const countryCode = getCountryCode(country);
  const primaryRole = roles[0];
  const expansions = expandQuery(primaryRole);

  const collected: any[] = [];
  const seen = new Set<string>();

  // Retrieval-level dedup: use multiple keys per job to catch duplicates
  // that appear with different IDs but same title+company
  const TITLE_NOISE_RE = /\s*[\(\[][^)\]]*[\)\]]\s*/g;
  const SUFFIX_RE = /\b(s\.?r\.?l\.?|s\.?p\.?a\.?|gmbh|ag|ltd\.?|llc|inc\.?|corp\.?|co\.?|plc|limited|group|holding|srl|spa)\b/gi;

  const descFP = (desc: string): string => {
    if (!desc || desc.length < 80) return "";
    return desc.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 200);
  };

  const retrievalKeys = (j: any): string[] => {
    const keys: string[] = [];
    const id = j?.id?.toString?.();
    if (id) keys.push("id:" + id);
    const url = j?.redirect_url || j?.url;
    if (url) {
      try { const u = new URL(url); keys.push("url:" + u.origin + u.pathname); } catch { keys.push("url:" + url); }
    }
    const title = (j?.title || "").toLowerCase().replace(TITLE_NOISE_RE, " ").replace(/\s+/g, " ").trim();
    const company = (j?.company?.display_name || "").toLowerCase().replace(SUFFIX_RE, "").replace(/[^a-z0-9]/g, "").trim();
    if (title && company) keys.push("tc:" + title + "::" + company);
    // Description fingerprint: same company + same description = duplicate
    const desc = j?.description || "";
    const fp = descFP(desc);
    if (company && fp.length >= 60) keys.push("desc:" + company + "::" + fp);
    if (fp.length >= 150) keys.push("desconly:" + fp);
    return keys;
  };

  const addResults = (results: any[]) => {
    for (const j of results) {
      const keys = retrievalKeys(j);
      if (keys.length === 0) continue;
      const rawId = j?.id?.toString?.() ? j.id.toString() : null;
      if (rawId && excludeIds && excludeIds.has(rawId)) continue;
      if (keys.some(k => seen.has(k))) continue;
      keys.forEach(k => seen.add(k));
      collected.push(j);
      if (collected.length >= desiredCount) return;
    }
  };

  const normalizedCity =
    city && city.toLowerCase() !== "remote" ? normalizeCityForAdzuna(city) : null;

  const candidatesToTry: Array<{ label: string; searchQuery: string; withCity: boolean }> = [];

  // Prefer: best query (often longer), then synonyms/platform terms, then raw role.
  const bestQuery = buildSearchQuery(roles);
  const expandedQueries = expansions
    .slice()
    .sort((a, b) => b.length - a.length)
    .slice(0, 6); // keep it bounded

  if (normalizedCity) {
    candidatesToTry.push({ label: "S1 best+city", searchQuery: bestQuery, withCity: true });
    for (const q of expandedQueries) {
      candidatesToTry.push({ label: `S2 exp+city`, searchQuery: q, withCity: true });
    }
    candidatesToTry.push({ label: "S3 raw+city", searchQuery: primaryRole, withCity: true });
  }

  candidatesToTry.push({ label: "S4 best+country", searchQuery: bestQuery, withCity: false });
  for (const q of expandedQueries) {
    candidatesToTry.push({ label: `S5 exp+country`, searchQuery: q, withCity: false });
  }
  candidatesToTry.push({ label: "S6 raw+country", searchQuery: primaryRole, withCity: false });

  const pagesToTry =
    excludeIds && excludeIds.size > 0 ? [1, 2, 3] : [1, 2];

  for (const c of candidatesToTry) {
    if (collected.length >= desiredCount) break;
    const where = c.withCity ? `"${normalizedCity}"` : "entire country";
    console.log(`[RETRIEVAL] ${c.label}: "${c.searchQuery}" in ${where}`);
    try {
      // Pull a bit more inventory when we need to avoid repeats.
      for (const page of pagesToTry) {
        if (collected.length >= desiredCount) break;
        const result = await fetchFromAdzuna(appId, appKey, {
          searchQuery: c.searchQuery,
          city: c.withCity ? (normalizedCity as string) : undefined,
          countryCode,
          page,
        });
        console.log(`[RETRIEVAL] ${c.label} page ${page} -> ${result.results.length} results`);
        addResults(result.results);
      }
    } catch (error) {
      console.log(`[RETRIEVAL] ${c.label} failed:`, error);
    }
  }

  return collected;
}

// ============================================================================
// PROVIDER 2: JSEARCH API (RapidAPI - Free tier available)
// ============================================================================

interface JSearchQueryParams {
  searchQuery: string;
  city?: string;
  country: string;
  page?: number;
}

/**
 * Fetch jobs from JSearch API (via RapidAPI)
 * Free tier: 500 requests/month
 * Documentation: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
 */
async function fetchFromJSearch(
  apiKey: string,
  params: JSearchQueryParams
): Promise<{ results: any[]; count: number; provider: string }> {
  const { searchQuery, city, country, page = 1 } = params;
  
  try {
    // JSearch uses RapidAPI, so we need to use their endpoint
    const url = new URL("https://jsearch.p.rapidapi.com/search");
    url.searchParams.set("query", searchQuery);
    url.searchParams.set("page", page.toString());
    url.searchParams.set("num_pages", "1");
    
    // Location handling - JSearch uses different format
    if (city) {
      url.searchParams.set("location", `${city}, ${country}`);
    } else {
      url.searchParams.set("location", country);
    }
    
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
    });
    
    if (!response.ok) {
      throw new Error(`JSearch API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // JSearch returns data in a different structure
    const jobs = data.data || [];
    
    // Log first job structure for debugging (only in development)
    if (process.env.NODE_ENV === 'development' && jobs.length > 0) {
      const firstJob = jobs[0];
      console.log('[JSearch API Response] First job structure:', {
        'job_id': firstJob.job_id,
        'job_title': firstJob.job_title,
        'employer_name': firstJob.employer_name,
        'job_city': firstJob.job_city,
        'job_state': firstJob.job_state,
        'job_country': firstJob.job_country,
        'job_apply_link': firstJob.job_apply_link,
        'job_google_link': firstJob.job_google_link,
        'allKeys': Object.keys(firstJob)
      });
    }
    
    return {
      results: jobs,
      count: jobs.length,
      provider: "jsearch",
    };
  } catch (error: any) {
    console.error("[JSearch] Error fetching jobs:", error.message);
    // Return empty results on error, don't throw
    return {
      results: [],
      count: 0,
      provider: "jsearch",
    };
  }
}

/**
 * Normalize JSearch job format to our common format
 */
function normalizeJSearchJob(job: any, index: number): any {
  return {
    id: job.job_id || `jsearch-${index}`,
    title: job.job_title || "Untitled Position",
    company: {
      display_name: job.employer_name || "Unknown Company",
    },
    location: {
      display_name: [job.job_city, job.job_state, job.job_country]
        .filter(Boolean)
        .join(", ") || "",
    },
    // JSearch provides direct apply links, which is better than Adzuna redirects
    url: job.job_apply_link || job.job_google_link || "#",
    redirect_url: job.job_apply_link || job.job_google_link || "#",
    description: job.job_description || job.job_highlights?.summary || "",
    salary_min: job.job_min_salary,
    salary_max: job.job_max_salary,
    created: job.job_posted_at_datetime_utc || job.job_posted_at_timestamp,
    // Store original for debugging
    _source: "jsearch",
  };
}

// ============================================================================
// MULTI-PROVIDER FETCH FUNCTION
// ============================================================================

/**
 * Fetch jobs from multiple providers and merge results
 */
async function fetchJobsFromMultipleProviders(
  roles: string[],
  country: string,
  city: string | null,
  desiredCount: number = 50,
  excludeIds?: Set<string>
): Promise<any[]> {
  const collected: any[] = [];
  const seen = new Set<string>();

  // Multi-provider dedup: use multiple keys per job
  const TITLE_NOISE_RE = /\s*[\(\[][^)\]]*[\)\]]\s*/g;
  const SUFFIX_RE = /\b(s\.?r\.?l\.?|s\.?p\.?a\.?|gmbh|ag|ltd\.?|llc|inc\.?|corp\.?|co\.?|plc|limited|group|holding|srl|spa)\b/gi;

  const mpDescFP = (desc: string): string => {
    if (!desc || desc.length < 80) return "";
    return desc.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 200);
  };

  const mpKeys = (j: any): string[] => {
    const keys: string[] = [];
    const id = j?.id?.toString?.();
    if (id) keys.push("id:" + id);
    const url = j?.redirect_url || j?.url;
    if (url) {
      try { const u = new URL(url); keys.push("url:" + u.origin + u.pathname); } catch { keys.push("url:" + url); }
    }
    const title = (j?.title || "").toLowerCase().replace(TITLE_NOISE_RE, " ").replace(/\s+/g, " ").trim();
    const company = (j?.company?.display_name || "").toLowerCase().replace(SUFFIX_RE, "").replace(/[^a-z0-9]/gi, "").trim();
    if (title && company) keys.push("tc:" + title + "::" + company);
    // Description fingerprint: same company + same description = duplicate
    const desc = j?.description || "";
    const fp = mpDescFP(desc);
    if (company && fp.length >= 60) keys.push("desc:" + company + "::" + fp);
    if (fp.length >= 150) keys.push("desconly:" + fp);
    return keys;
  };
  
  const addResults = (results: any[], _provider: string) => {
    for (const j of results) {
      const keys = mpKeys(j);
      if (keys.length === 0) continue;
      if (keys.some(k => seen.has(k))) continue;
      keys.forEach(k => seen.add(k));
      collected.push(j);
      if (collected.length >= desiredCount) return;
    }
  };
  
  const primaryRole = roles[0];
  const searchQuery = buildSearchQuery(roles);
  const countryCode = getCountryCode(country);
  const normalizedCity = city && city.toLowerCase() !== "remote" 
    ? normalizeCityForAdzuna(city) 
    : null;
  
  // Fetch from Adzuna (primary provider)
  const adzunaAppId = process.env.ADZUNA_APP_ID;
  const adzunaAppKey = process.env.ADZUNA_APP_KEY;
  
  if (adzunaAppId && adzunaAppKey) {
    try {
      const adzunaResults = await fetchFromAdzuna(adzunaAppId, adzunaAppKey, {
        searchQuery,
        city: normalizedCity || undefined,
        countryCode,
        page: 1,
      });
      
      // Filter excluded IDs
      const filtered = adzunaResults.results.filter((j: any) => {
        const id = j?.id?.toString?.() ? j.id.toString() : null;
        return !(excludeIds && id && excludeIds.has(id));
      });
      
      addResults(filtered, "adzuna");
      console.log(`[Multi-Provider] Added ${filtered.length} jobs from Adzuna`);
    } catch (error: any) {
      console.error("[Multi-Provider] Adzuna error:", error.message);
    }
  }
  
  // Fetch from JSearch (secondary provider) if we need more results
  if (collected.length < desiredCount) {
    const jsearchApiKey = process.env.JSEARCH_API_KEY;
    
    if (jsearchApiKey) {
      try {
        const jsearchResults = await fetchFromJSearch(jsearchApiKey, {
          searchQuery,
          city: normalizedCity || undefined,
          country,
          page: 1,
        });
        
        // Normalize JSearch format to match Adzuna format
        const normalized = jsearchResults.results.map((job: any, idx: number) => 
          normalizeJSearchJob(job, idx)
        );
        
        // Filter excluded IDs (dedup is handled inside addResults)
        const filtered = normalized.filter((j: any) => {
          const id = j?.id?.toString?.() ? j.id.toString() : null;
          if (excludeIds && id && excludeIds.has(id)) return false;
          return true;
        });
        
        addResults(filtered, "jsearch");
        console.log(`[Multi-Provider] Added ${filtered.length} jobs from JSearch`);
      } catch (error: any) {
        console.error("[Multi-Provider] JSearch error:", error.message);
      }
    }
  }
  
  return collected;
}

// ============================================================================
// STAGE 4: IMPROVED SCORING WITH NORMALIZED MATCHING
// ============================================================================

// Normalize text for matching (lowercase, remove special chars, normalize spaces)
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Replace special chars with space
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// Tokenize text into words
export function tokenize(text: string): Set<string> {
  const normalized = normalizeText(text);
  return new Set(normalized.split(/\s+/).filter(w => w.length >= 2));
}

// Check if role matches title (fuzzy, token-based matching)
export function roleMatchesTitle(role: string, title: string): { matches: boolean; score: number } {
  const roleLower = role.toLowerCase().trim();
  const titleLower = title.toLowerCase();
  
  // Exact match (case-insensitive)
  if (titleLower === roleLower) {
    return { matches: true, score: 200 };
  }
  
  // Role at start of title
  if (titleLower.startsWith(roleLower + " ")) {
    return { matches: true, score: 200 };
  }
  
  // Role as separate word
  const wordBoundaryRegex = new RegExp(`\\b${roleLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  if (wordBoundaryRegex.test(title)) {
    if (titleLower.includes(" " + roleLower + " ") || titleLower.endsWith(" " + roleLower)) {
      return { matches: true, score: 190 };
    }
    return { matches: true, score: 180 };
  }
  
  // Role appears anywhere (partial match)
  if (titleLower.includes(roleLower)) {
    return { matches: true, score: 160 };
  }
  
  // For single-word roles, check token overlap
  const roleTokens = tokenize(role);
  const titleTokens = tokenize(title);
  
  if (roleTokens.size > 0) {
    const overlap = Array.from(roleTokens).filter(t => titleTokens.has(t));
    if (overlap.length === roleTokens.size) {
      return { matches: true, score: 150 }; // All tokens match
    }
    if (overlap.length > 0) {
      return { matches: true, score: 120 }; // Partial token match
    }
  }
  
  return { matches: false, score: 0 };
}

// Check if location matches (fuzzy matching with variants)
export function locationMatches(location: string, cityVariants: string[]): boolean {
  const locationLower = location.toLowerCase();
  return cityVariants.some(variant => locationLower.includes(variant));
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

// Map country names to Adzuna country codes
const COUNTRY_CODE_MAP: Record<string, string> = {
  "United States": "us",
  "United Kingdom": "gb",
  "Italy": "it",
  "Germany": "de",
  "France": "fr",
  "Spain": "es",
  "Netherlands": "nl",
  "Belgium": "be",
  "Switzerland": "ch",
  "Austria": "at",
  "Sweden": "se",
  "Norway": "no",
  "Denmark": "dk",
  "Finland": "fi",
  "Poland": "pl",
  "Canada": "ca",
  "Australia": "au",
  "New Zealand": "nz",
  "Ireland": "ie",
  "Portugal": "pt",
  "Greece": "gr",
  "Czech Republic": "cz",
  "Hungary": "hu",
  "Romania": "ro",
  "Bulgaria": "bg",
  "Croatia": "hr",
  "Slovenia": "si",
  "Slovakia": "sk",
  "Lithuania": "lt",
  "Latvia": "lv",
  "Estonia": "ee",
  "Luxembourg": "lu",
  "Malta": "mt",
  "Cyprus": "cy",
  "Japan": "jp",
  "Singapore": "sg",
  "South Korea": "kr",
  "Hong Kong": "hk",
  "India": "in",
  "Brazil": "br",
  "Mexico": "mx",
  "Argentina": "ar",
  "Chile": "cl",
  "Colombia": "co",
  "Peru": "pe",
  "South Africa": "za",
  "Israel": "il",
  "United Arab Emirates": "ae",
  "Saudi Arabia": "sa",
  "Turkey": "tr",
  "Russia": "ru",
  "China": "cn",
  "Indonesia": "id",
  "Malaysia": "my",
  "Thailand": "th",
  "Philippines": "ph",
  "Vietnam": "vn",
};

function getCountryCode(countryName: string): string {
  return COUNTRY_CODE_MAP[countryName] || "us";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roles = searchParams.get("roles");
  const role = searchParams.get("role");
  const areas = searchParams.get("areas");
  const country = searchParams.get("country");
  const city = searchParams.get("city");
  const experienceYears = searchParams.get("experienceYears");
  const remote = searchParams.get("remote") === "true";
  const date = searchParams.get("date");
  const excludeIdsParam = searchParams.get("excludeIds");
  const subscriptionTier = searchParams.get("subscriptionTier") || "free"; // Default to free

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    return NextResponse.json(
      { error: "Adzuna API credentials not configured" },
      { status: 500 }
    );
  }

  const rolesList = roles ? roles.split(",").map(r => r.trim()).filter(r => r.length > 0) : [];
  const roleFallback = role ? [role.trim()] : [];
  const allRoles = rolesList.length > 0 ? rolesList : roleFallback;

  if (allRoles.length === 0 || !country) {
    return NextResponse.json(
      { error: "Missing required parameters: roles (or role) and country" },
      { status: 400 }
    );
  }

  try {
    // STAGE 1: RETRIEVAL with fallback
    // Retrieve more inventory for premium since we may return "all matches"
    const desiredCount = subscriptionTier === "premium" ? 200 : 80;
    const excludeIds = excludeIdsParam
      ? new Set(
          excludeIdsParam
            .split(",")
            .map((x) => x.trim())
            .filter((x) => x.length > 0)
        )
      : undefined;
    
    // Try multi-provider fetch first (if JSearch is configured)
    // Otherwise fall back to Adzuna-only
    const jsearchApiKey = process.env.JSEARCH_API_KEY;
    let jobs: any[];
    
    if (jsearchApiKey) {
      // Use multi-provider fetch
      jobs = await fetchJobsFromMultipleProviders(
        allRoles,
        country,
        city,
        desiredCount,
        excludeIds
      );
      console.log(`[SCORING] Retrieved ${jobs.length} jobs from multiple providers`);
    } else {
      // Fall back to Adzuna-only (original behavior)
      jobs = await fetchJobsWithFallback(
        appId,
        appKey,
        allRoles,
        country,
        city,
        desiredCount,
        excludeIds
      );
      console.log(`[SCORING] Retrieved ${jobs.length} jobs from Adzuna`);
    }

    // STAGE 2: RANKING
    const rolesLower = allRoles.map(r => r.toLowerCase());
    const areasList = areas ? areas.split(",").map(a => a.trim().toLowerCase()) : [];
    const cityVariants = city ? getLocationVariants(city) : [];
    const expYears = experienceYears ? parseInt(experienceYears) : null;

    type JobWithScore = {
      id: string;
      title: string;
      company: string;
      location: string;
      url: string;
      description: string;
      salaryMin?: number;
      salaryMax?: number;
      created?: string;
      score: number;
      // Matching diagnostics (used to ensure premium can be filled to 3 with relevant jobs)
      matchedKeywordsTitle: number;
      matchedKeywordsText: number;
    };

    const jobsWithScore: JobWithScore[] = jobs
      .filter((job: any) => {
        const id = job?.id?.toString?.() ? job.id.toString() : "";
        return !(excludeIds && id && excludeIds.has(id));
      })
      .map((job: any, index: number) => {
      const title = job.title || "Untitled Position";
      const titleLower = title.toLowerCase();
      const description = (job.description || "").toLowerCase();
      const location = job.location?.display_name || job.location?.area?.[0] || "";
      const locationLower = location.toLowerCase();

      let score = 0;
      let hasRoleMatch = false;
      let matchedKeywordsTitle = 0;
      let matchedKeywordsText = 0;

      // 1. Role matching (HIGHEST PRIORITY - user's keywords are most important)
      // Extract all keywords from user's roles (split by spaces, keep all words)
      const userKeywords: string[] = [];
      allRoles.forEach(role => {
        const words = role.toLowerCase().trim().split(/\s+/).filter(w => w.length >= 2);
        userKeywords.push(...words);
      });
      const uniqueKeywords = [...new Set(userKeywords)];

      // Check keyword presence in title vs (title+description)
      let exactRoleMatchTitle = false;
      let exactRoleMatchText = false;
      const fullText = `${titleLower} ${description}`;
      
      for (const keyword of uniqueKeywords) {
        const keywordRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (keywordRegex.test(title)) matchedKeywordsTitle++;
        if (keywordRegex.test(fullText)) matchedKeywordsText++;
      }

      // Determine exact role match in title vs full text (for better ranking)
      if (uniqueKeywords.length > 0) {
        exactRoleMatchTitle = allRoles.some(role => {
          const roleWords = role.toLowerCase().trim().split(/\s+/);
          return roleWords.every(word => {
            const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
            return re.test(title);
          });
        });

        exactRoleMatchText = allRoles.some(role => {
          const roleWords = role.toLowerCase().trim().split(/\s+/);
          return roleWords.every(word => {
            const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
            return re.test(fullText);
          });
        });
      }

      // Eligibility: at least one keyword must appear in title OR description (keeps relevance),
      // but we strongly prefer title matches. This also enables premium to always fill 3.
      if (matchedKeywordsText === 0 && uniqueKeywords.length > 0) {
        score = -1000; // Exclude jobs that don't contain any user keywords anywhere
      } else {
        hasRoleMatch = true;
        
        // Give MASSIVE priority to exact matches in title, then exact matches in text,
        // then partial matches in title, then partial matches in text.
        if (exactRoleMatchTitle) {
          score += 500;
        } else if (exactRoleMatchText) {
          score += 350;
        } else if (matchedKeywordsTitle > 0) {
          const ratio = matchedKeywordsTitle / Math.max(1, uniqueKeywords.length);
          score += 300 * ratio;
        } else {
          // Only description match: still relevant, but lower weight
          const ratio = matchedKeywordsText / Math.max(1, uniqueKeywords.length);
          score += 150 * ratio;
        }

        // Additional bonuses for keyword position and frequency (title gets most weight)
        for (const keyword of uniqueKeywords) {
          const keywordLower = keyword.toLowerCase();
          if (titleLower.startsWith(keywordLower + " ")) {
            score += 100;
          } else if (titleLower.includes(" " + keywordLower + " ") || titleLower.endsWith(" " + keywordLower)) {
            score += 80;
          } else if (titleLower.includes(keywordLower)) {
            score += 50;
          } else if (description.includes(keywordLower)) {
            score += 15; // keyword only in description
          }
        }
      }

      // 2. Area matching
      if (areasList.length > 0) {
        areasList.forEach(area => {
          if (titleLower.includes(area)) {
            score += 20;
          } else if (description.includes(area)) {
            score += 10;
          }
        });
      } else {
        score += 5; // No areas selected = all acceptable
      }

      // 3. Location matching (HIGH PRIORITY when city is specified)
      if (city && city.toLowerCase() !== "remote") {
        if (locationMatches(location, cityVariants)) {
          // MASSIVE bonus for exact city match - ensures city jobs are at the top
          score += 400; // Very high priority to put city matches at the top
        } else {
          // Small penalty for jobs not in the specified city
          score -= 50;
        }
      } else if (remote && locationLower.includes("remote")) {
        score += 30;
      } else if (!city && locationLower.includes("remote")) {
        score += 15;
      }

      // 4. Experience matching (bonus only) + filter junior/intern if expYears > 5
      if (expYears !== null && hasRoleMatch) {
        const descText = description + " " + titleLower;
        
        // FILTER: If user has > 5 years experience, exclude junior/intern positions
        if (expYears > 5) {
          if (/junior|intern|trainee|entry-level|graduate|associate/i.test(descText)) {
            score = -1000; // Exclude junior/intern positions for experienced users
          }
        }
        
        // BONUS: Match experience level
        const hasSenior = /senior|lead|principal|expert|director|manager/i.test(descText);
        const hasMid = /mid|intermediate|experienced|specialist/i.test(descText);
        const hasJunior = /junior|entry|graduate|intern|associate/i.test(descText);

        if (expYears >= 5 && hasSenior) {
          score += 25;
        } else if (expYears >= 2 && expYears < 5 && hasMid) {
          score += 25;
        } else if (expYears < 2 && hasJunior) {
          score += 25;
        }
      }

      // 5. Recency bonus
      if (job.created) {
        const daysAgo = (Date.now() - new Date(job.created).getTime()) / (1000 * 60 * 60 * 24);
        if (daysAgo < 7) score += 5;
        else if (daysAgo < 30) score += 2;
      }

      // 6. Salary info bonus
      if (job.salary_min || job.salary_max) {
        score += 3;
      }

      // Adzuna API typically only provides redirect_url which goes through Adzuna for tracking
      // We'll use redirect_url as-is, but note that it will pass through Adzuna
      // The frontend can optionally call /api/resolve-job-url to get the final destination
      const finalUrl = job.redirect_url || job.url || "#";
      
      // Log for debugging (only first job in development)
      if (index === 0 && process.env.NODE_ENV === 'development') {
        console.log('[Adzuna Job URL Debug]', {
          id: job.id,
          title: job.title,
          'redirect_url': job.redirect_url,
          'url': job.url,
          'finalUrl': finalUrl,
          'isAdzunaRedirect': finalUrl.includes('adzuna.com') || finalUrl.includes('adzuna.co.uk')
        });
      }

      return {
        id: job.id?.toString() || `adzuna-${index}`,
        title,
        company: job.company?.display_name || "Unknown Company",
        location,
        url: finalUrl,
        description: job.description || "",
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        created: job.created,
        score,
        matchedKeywordsTitle,
        matchedKeywordsText,
      };
    });

    // Filter and sort
    const isSingleWordRole = rolesLower.some(r => r.trim().split(/\s+/).length === 1);
    const MIN_SCORE_THRESHOLD = isSingleWordRole ? 0 : 50;

    // "Strict" set: keeps quality high
    const filteredJobs = jobsWithScore.filter(job => job.score >= MIN_SCORE_THRESHOLD);
    const sortedStrict = filteredJobs.sort((a, b) => b.score - a.score);

    // "Relaxed" set: still relevant enough to be considered for filling slots,
    // but below the strict threshold. Must match at least one keyword.
    const RELAXED_MIN_SCORE = isSingleWordRole ? 0 : 10;
    const relaxedCandidates = jobsWithScore
      .filter((j) => (j.matchedKeywordsTitle + j.matchedKeywordsText) >= 1 && j.score >= RELAXED_MIN_SCORE)
      .sort((a, b) => b.score - a.score);

    // Output policy:
    // - free: 3 picks/day
    // - premium: max 10 picks/day
    const maxJobs = subscriptionTier === "premium" ? 10 : 3;

    // ====================================================================
    // ROBUST DEDUPLICATION (5 layers)
    // ====================================================================
    // Jobs can appear as duplicates in several ways:
    //  1. Same Adzuna ID from different query expansions (caught by ID)
    //  2. Same URL with different query params (caught by normalized URL)
    //  3. Same role at same company posted multiple times with different IDs
    //     (caught by normalized title+company fingerprint)
    //  4. Slight title variations like "Software Engineer" vs
    //     "Software Engineer (m/f/d)" (caught by stripped title)
    //  5. Same company, different title but identical/near-identical description
    //     (caught by company + description fingerprint)
    // We reject a job if ANY key matches a previously seen key.

    const COMPANY_SUFFIXES = /\b(s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?r\.?l\.?s\.?|gmbh|ag|ltd\.?|llc|inc\.?|corp\.?|co\.?|plc|limited|group|holding|srl|spa)\b/gi;
    const TITLE_NOISE = /\s*[\(\[][^)\]]*[\)\]]\s*/g; // remove (m/f/d), [remote], etc.

    const normalizeCompanyName = (c: string): string =>
      c.toLowerCase().replace(COMPANY_SUFFIXES, "").replace(/[^a-z0-9]/g, "").trim();

    const normalizeTitleForDedup = (t: string): string =>
      t.toLowerCase().replace(TITLE_NOISE, " ").replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();

    // Create a fingerprint from the description to catch same-company reposts.
    // We strip HTML, normalize whitespace, then take the first 200 alphanumeric
    // characters. This is enough to uniquely identify a posting even when the
    // title or location differs slightly.
    const descriptionFingerprint = (desc: string): string => {
      if (!desc || desc.length < 80) return ""; // too short to be meaningful
      const stripped = desc
        .replace(/<[^>]*>/g, " ")  // strip HTML tags
        .replace(/&[a-z]+;/gi, " ") // strip HTML entities
        .replace(/[^a-z0-9]/gi, "") // only alphanumeric
        .toLowerCase();
      // take first 200 chars — the opening of a description is the most
      // distinctive part (requirements, intro paragraph, etc.)
      return stripped.slice(0, 200);
    };

    const getJobDeduKeys = (job: JobWithScore): string[] => {
      const keys: string[] = [];

      // Layer 1: normalized URL (strip query & fragment)
      if (job.url && job.url !== "#") {
        try {
          const u = new URL(job.url);
          keys.push("url:" + u.origin + u.pathname);
        } catch {
          keys.push("url:" + job.url);
        }
      }

      // Layer 2: exact title + company + location
      const title = (job.title || "").toLowerCase().trim();
      const company = (job.company || "").toLowerCase().trim();
      const location = (job.location || "").toLowerCase().trim();
      keys.push(`exact:${title}::${company}::${location}`);

      // Layer 3: fuzzy title + company (handles parenthetical variations,
      // company suffixes like LLC/SRL/GmbH, and location differences)
      const fuzzyTitle = normalizeTitleForDedup(job.title || "");
      const fuzzyCompany = normalizeCompanyName(job.company || "");
      if (fuzzyTitle && fuzzyCompany) {
        keys.push(`fuzzy:${fuzzyTitle}::${fuzzyCompany}`);
      }

      // Layer 4: company + description fingerprint
      // Catches the case where the same company posts the same role with
      // a different title or in a different city but reuses the same description.
      if (fuzzyCompany) {
        const descFP = descriptionFingerprint(job.description || "");
        if (descFP.length >= 60) { // only if we got a meaningful fingerprint
          keys.push(`desc:${fuzzyCompany}::${descFP}`);
        }
      }

      // Layer 5: description-only fingerprint (catches reposts by recruitment
      // agencies that copy-paste the same description under different company names)
      {
        const descFP = descriptionFingerprint(job.description || "");
        if (descFP.length >= 150) { // high threshold to avoid false positives
          keys.push(`desconly:${descFP}`);
        }
      }

      return keys;
    };

    // For both tiers, take the best from strict first, then fill from relaxed if needed.
    // Use robust multi-layer deduplication to prevent same job appearing multiple times.
    const picked: JobWithScore[] = [];
    const seenKeys = new Set<string>();

    const tryPick = (j: JobWithScore): boolean => {
      const keys = getJobDeduKeys(j);
      // If ANY key was already seen, this is a duplicate
      if (keys.some(k => seenKeys.has(k))) return false;
      keys.forEach(k => seenKeys.add(k));
      picked.push(j);
      return true;
    };
    
    for (const j of sortedStrict) {
      if (picked.length >= maxJobs) break;
      tryPick(j);
    }
    
    if (picked.length < maxJobs) {
      for (const j of relaxedCandidates) {
        if (picked.length >= maxJobs) break;
        tryPick(j);
      }
    }

    const topJobs = picked.map(({ score: _score, matchedKeywordsTitle: _mkt, matchedKeywordsText: _mxt, ...job }) => job);

    // Debug logging
    console.log("=== SCORING DEBUG ===");
    console.log("Subscription tier:", subscriptionTier);
    console.log("Retrieved:", jobs.length, "jobs");
    console.log("After scoring:", jobsWithScore.length, "jobs");
    console.log("After filtering (strict):", filteredJobs.length, "jobs");
    console.log("Max jobs allowed:", maxJobs);
    console.log("Final top jobs:", topJobs.length);
    if (picked.length > 0) {
      console.log(
        "Top picks:",
        picked.slice(0, Math.min(10, picked.length)).map(j => ({
          title: j.title.substring(0, 50),
          score: j.score,
          matchedKeywordsTitle: j.matchedKeywordsTitle,
          matchedKeywordsText: j.matchedKeywordsText,
        }))
      );
    }

    return NextResponse.json({
      jobs: topJobs,
      attribution: "Jobs by Adzuna",
    });
  } catch (error: any) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch jobs",
        message: error.message,
        jobs: [],
      },
      { status: 500 }
    );
  }
}
