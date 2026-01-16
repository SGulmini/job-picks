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
// STAGE 3: ROBUST RETRIEVAL WITH FALLBACK
// ============================================================================

interface AdzunaQueryParams {
  searchQuery: string;
  city?: string;
  countryCode: string;
  page: number;
}

async function fetchFromAdzuna(
  appId: string,
  appKey: string,
  params: AdzunaQueryParams
): Promise<{ results: any[]; count: number }> {
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

  const jobKey = (j: any): string => {
    return (
      j?.id?.toString() ||
      j?.redirect_url ||
      j?.url ||
      `${j?.title || ""}::${j?.company?.display_name || ""}::${j?.location?.display_name || ""}`
    );
  };

  const addResults = (results: any[]) => {
    for (const j of results) {
      const k = jobKey(j);
      if (!k) continue;
      const rawId = j?.id?.toString?.() ? j.id.toString() : null;
      if (rawId && excludeIds && excludeIds.has(rawId)) continue;
      if (seen.has(k)) continue;
      seen.add(k);
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
    const jobs = await fetchJobsWithFallback(
      appId,
      appKey,
      allRoles,
      country,
      city,
      desiredCount,
      excludeIds
    );

    console.log(`[SCORING] Retrieved ${jobs.length} jobs from Adzuna`);

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

    // For both tiers, take the best from strict first, then fill from relaxed if needed.
    const picked: JobWithScore[] = [];
    for (const j of sortedStrict) {
      if (picked.length >= maxJobs) break;
      picked.push(j);
    }
    if (picked.length < maxJobs) {
      const seen = new Set(picked.map((p) => p.id));
      for (const j of relaxedCandidates) {
        if (picked.length >= maxJobs) break;
        if (seen.has(j.id)) continue;
        picked.push(j);
        seen.add(j.id);
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
