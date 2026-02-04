"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PROFILE_KEY = "jobProfile";

type Profile = {
  roles: string[]; // Multiple job titles
  role?: string; // Legacy support - will be migrated to roles
  areas: string[]; // Empty array means all areas are considered
  experienceYears: number; // Years of professional experience
  country: string;
  city?: string;
  remote?: boolean; // Whether to accept remote positions
  // Legacy support
  seniority?: string | string[]; // For migration
  level?: string;
};

// Major cities by country for autocomplete suggestions
const CITIES_BY_COUNTRY: Record<string, string[]> = {
  "United States": [
    "New York",
    "Los Angeles",
    "Chicago",
    "Houston",
    "Phoenix",
    "Philadelphia",
    "San Antonio",
    "San Diego",
    "Dallas",
    "San Jose",
    "Austin",
    "San Francisco",
    "Seattle",
    "Denver",
    "Boston",
    "Washington",
    "Remote",
  ],
  "United Kingdom": ["London", "Birmingham", "Manchester", "Glasgow", "Liverpool", "Leeds", "Edinburgh", "Bristol", "Cardiff", "Remote"],
  Italy: ["Roma", "Milano", "Napoli", "Torino", "Palermo", "Genova", "Bologna", "Firenze", "Bari", "Catania", "Venezia", "Verona", "Remote"],
  Germany: ["Berlin", "Hamburg", "München", "Köln", "Frankfurt", "Stuttgart", "Düsseldorf", "Dortmund", "Essen", "Leipzig", "Remote"],
  France: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg", "Montpellier", "Bordeaux", "Lille", "Remote"],
  Spain: ["Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Málaga", "Murcia", "Bilbao", "Alicante", "Remote"],
  Netherlands: ["Amsterdam", "Rotterdam", "Den Haag", "Utrecht", "Eindhoven", "Groningen", "Tilburg", "Remote"],
  Switzerland: ["Zürich", "Genève", "Basel", "Bern", "Lausanne", "Remote"],
  Canada: ["Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg", "Remote"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra", "Remote"],
  Belgium: ["Brussels", "Antwerp", "Ghent", "Charleroi", "Liège", "Bruges", "Remote"],
  Austria: ["Vienna", "Graz", "Linz", "Salzburg", "Innsbruck", "Remote"],
  Sweden: ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Västerås", "Remote"],
  Norway: ["Oslo", "Bergen", "Trondheim", "Stavanger", "Remote"],
  Denmark: ["Copenhagen", "Aarhus", "Odense", "Aalborg", "Remote"],
  Poland: ["Warsaw", "Kraków", "Łódź", "Wrocław", "Poznań", "Remote"],
  Ireland: ["Dublin", "Cork", "Limerick", "Galway", "Remote"],
  Portugal: ["Lisbon", "Porto", "Braga", "Coimbra", "Remote"],
  Greece: ["Athens", "Thessaloniki", "Patras", "Heraklion", "Remote"],
  Japan: ["Tokyo", "Yokohama", "Osaka", "Nagoya", "Sapporo", "Remote"],
  Singapore: ["Singapore", "Remote"],
  "South Korea": ["Seoul", "Busan", "Incheon", "Daegu", "Remote"],
  India: ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Remote"],
  Brazil: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza", "Remote"],
  Mexico: ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Remote"],
  Argentina: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Remote"],
  Chile: ["Santiago", "Valparaíso", "Concepción", "Remote"],
  "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Remote"],
  Israel: ["Tel Aviv", "Jerusalem", "Haifa", "Remote"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah", "Remote"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Mecca", "Remote"],
  Turkey: ["Istanbul", "Ankara", "İzmir", "Bursa", "Remote"],
  Russia: ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Remote"],
  China: ["Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Remote"],
  Indonesia: ["Jakarta", "Surabaya", "Bandung", "Medan", "Remote"],
  Malaysia: ["Kuala Lumpur", "George Town", "Johor Bahru", "Remote"],
  Thailand: ["Bangkok", "Nonthaburi", "Chiang Mai", "Remote"],
  Philippines: ["Manila", "Quezon City", "Caloocan", "Remote"],
  Vietnam: ["Ho Chi Minh City", "Hanoi", "Da Nang", "Remote"],
};

const AVAILABLE_AREAS = [
  "AI",
  "Business",
  "Consulting",
  "Content",
  "Customer Support",
  "Data",
  "Design",
  "Education",
  "Engineering",
  "Finance",
  "Healthcare",
  "HR",
  "IT",
  "Legal",
  "Marketing",
  "Operations",
  "Product",
  "Real Estate",
  "Sales",
];

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cape Verde",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "East Timor",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "North Korea",
  "South Korea",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

// ─────────────────────────────────────────────────────────────────────────────
// Small UI components (from Lovable, kept self-contained)
// ─────────────────────────────────────────────────────────────────────────────

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border bg-accent/20 text-accent-foreground border-accent/30 transition-all hover:bg-accent/30">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 p-0.5 rounded-full hover:bg-accent/40 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
        aria-label={`Remove ${label}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

function Toggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function AreaCheckbox({
  area,
  checked,
  onChange,
}: {
  area: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all hover:bg-muted/50 group">
      <div className="relative">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-5 h-5 rounded border-2 border-muted-foreground/40 bg-card transition-all peer-checked:border-primary peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary/50 peer-focus:ring-offset-2 peer-focus:ring-offset-background flex items-center justify-center">
          <svg
            className={`w-3 h-3 text-primary-foreground transition-opacity ${checked ? "opacity-100" : "opacity-0"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <span className="text-sm text-foreground/90 group-hover:text-foreground transition-colors">{area}</span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function EditProfilePage() {
  const router = useRouter();

  // Real state (your original logic)
  const [roles, setRoles] = useState<string[]>([]); // we keep this as "chips"
  const [areas, setAreas] = useState<string[]>([]); // empty means "all"
  const [experienceYears, setExperienceYears] = useState<number>(3);
  const [country, setCountry] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [remote, setRemote] = useState<boolean>(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI-only state (from Lovable)
  const [newJobTitle, setNewJobTitle] = useState("");
  const [areaSearch, setAreaSearch] = useState("");
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  // Load existing profile + keep your auth/email logic
  useEffect(() => {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      router.replace("/profile");
      return;
    }

    try {
      const p = JSON.parse(raw) as Partial<Profile>;

      // Roles migration
      if (Array.isArray(p.roles) && p.roles.length > 0) {
        const cleaned = p.roles.map((r) => r.trim()).filter((r) => r.length > 0);
        setRoles(cleaned);
      } else if (typeof p.role === "string" && p.role.trim().length > 0) {
        setRoles([p.role.trim()]);
      } else {
        setRoles([]);
      }

      // Areas migration
      if (Array.isArray(p.areas) && p.areas.length > 0) setAreas(p.areas);
      else if (typeof (p as any).area === "string") setAreas([(p as any).area]);
      else setAreas([]); // empty => all

      if (typeof p.remote === "boolean") setRemote(p.remote);

      // Experience migration
      if (typeof p.experienceYears === "number" && p.experienceYears >= 0) {
        setExperienceYears(p.experienceYears);
      } else if (typeof p.level === "string") {
        const levelMap: Record<string, number> = { Junior: 1, Mid: 3, Senior: 5 };
        setExperienceYears(levelMap[p.level] ?? 3);
      } else if (p.seniority) {
        const seniorityStr = Array.isArray(p.seniority)
          ? p.seniority[0]
          : typeof p.seniority === "string"
            ? p.seniority
            : "";
        if (seniorityStr) {
          const s = seniorityStr.toLowerCase();
          if (s.includes("intern") || s.includes("trainee")) setExperienceYears(0);
          else if (s.includes("junior")) setExperienceYears(1);
          else if (s.includes("regular") || s.includes("mid")) setExperienceYears(3);
          else if (s.includes("senior") && !s.includes("manager") && !s.includes("director")) setExperienceYears(5);
          else if (s.includes("lead") || s.includes("expert") || s.includes("principal")) setExperienceYears(7);
          else if (s.includes("team lead")) setExperienceYears(8);
          else if (s.includes("manager") && !s.includes("senior") && !s.includes("head")) setExperienceYears(10);
          else setExperienceYears(5);
        }
      }

      if (typeof p.country === "string") setCountry(p.country);
      if (typeof p.city === "string") setCity(p.city);
    } catch {
      localStorage.removeItem(PROFILE_KEY);
    }

    // Save email when session is available
    const saveEmail = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.email) localStorage.setItem("jobpicks_user_email", session.user.email);
    };
    saveEmail();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        sessionStorage.getItem("jobpicks_logging_out") === "true" ||
        localStorage.getItem("jobpicks_logging_out") === "true" ||
        event === "SIGNED_OUT"
      ) {
        return;
      }

      if (session?.user?.email) localStorage.setItem("jobpicks_user_email", session.user.email);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Keep city suggestions tied to country (your original behavior)
  useEffect(() => {
    if (!country) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      return;
    }
    const suggestions = CITIES_BY_COUNTRY[country] || [];
    setCitySuggestions(suggestions);
  }, [country]);

  // Filtered areas (Lovable UI behavior)
  const filteredAreas = useMemo(() => {
    const filtered = AVAILABLE_AREAS.filter((a) => a.toLowerCase().includes(areaSearch.toLowerCase()));
    if (!showAllAreas && !areaSearch) return filtered.slice(0, 10);
    return filtered;
  }, [areaSearch, showAllAreas]);

  const hiddenAreasCount = !showAllAreas && !areaSearch ? Math.max(0, AVAILABLE_AREAS.length - 10) : 0;

  // Job title chips (Lovable UX, backed by your roles[])
  const addJobTitle = () => {
    const t = newJobTitle.trim();
    if (!t) return;
    if (roles.some((r) => r.toLowerCase() === t.toLowerCase())) {
      setNewJobTitle("");
      return;
    }
    setRoles((prev) => [...prev, t]);
    setNewJobTitle("");
  };

  const removeJobTitle = (title: string) => setRoles((prev) => prev.filter((t) => t !== title));

  // Areas selection (same meaning: empty => all)
  const toggleArea = (area: string, checked: boolean) => {
    setAreas((prev) => (checked ? (prev.includes(area) ? prev : [...prev, area]) : prev.filter((a) => a !== area)));
  };

  const selectAllAreas = () => setAreas([...AVAILABLE_AREAS]);
  const clearAllAreas = () => setAreas([]); // empty => all

  // City autocomplete (your data, Lovable dropdown UX)
  const handleCityChange = (value: string) => {
    setCity(value);

    if (!country) {
      setShowCitySuggestions(false);
      return;
    }

    const all = CITIES_BY_COUNTRY[country] || [];
    if (value.length === 0) {
      setCitySuggestions(all);
      setShowCitySuggestions(false);
      return;
    }

    const filtered = all.filter((c) => c.toLowerCase().includes(value.toLowerCase()));
    setCitySuggestions(filtered);
    setShowCitySuggestions(filtered.length > 0 && filtered.length <= 20);
  };

  const selectCity = (selectedCity: string) => {
    setCity(selectedCity);
    setShowCitySuggestions(false);
  };

  // Save (your original onContinue logic)
  const onContinue = async () => {
    setError(null);

    const cleanRoles = roles.map((r) => r.trim()).filter((r) => r.length > 0);
    if (cleanRoles.length === 0) {
      setError("Please enter at least one job title (e.g. Data Analyst).");
      return;
    }

    if (!country || country.trim().length === 0) {
      setError("Please select a country.");
      return;
    }

    if (experienceYears < 0 || experienceYears > 50) {
      setError("Please enter a valid number of years of experience (0-50).");
      return;
    }

    setSaving(true);

    const profile: Profile = {
      roles: cleanRoles,
      areas, // can be empty => all
      experienceYears,
      country: country.trim(),
      city: city.trim() || undefined,
      remote,
    };

    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      router.push("/home");
    } catch (err) {
      console.error(err);
      setError("Could not save your profile. Try again.");
      setSaving(false);
    }
  };

  const onCancel = () => router.push("/home");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Job Picks</p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1 text-foreground">Edit your profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update your job preferences. Changes are saved when you click Save.
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-28 sm:pb-8">
        <div className="space-y-6">
          {/* Job Titles */}
          <section className="rounded-2xl border border-border/60 bg-card/60 shadow-sm p-5 sm:p-6">
            <div className="mb-4">
              <label htmlFor="job-title-input" className="text-sm font-semibold text-foreground">
                Job Titles
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Add the job titles you're interested in. Example: Data Analyst, Frontend Developer
              </p>
            </div>

            {roles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {roles.map((title) => (
                  <Chip key={title} label={title} onRemove={() => removeJobTitle(title)} />
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                id="job-title-input"
                type="text"
                value={newJobTitle}
                onChange={(e) => setNewJobTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addJobTitle();
                  }
                }}
                placeholder="Enter a job title..."
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={addJobTitle}
                className="inline-flex items-center justify-center rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-semibold hover:bg-muted/80 transition-colors"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
            </div>
          </section>

          {/* Areas */}
          <section className="rounded-2xl border border-border/60 bg-card/60 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Areas</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Select the areas that interest you. Leave empty to consider all areas.
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={selectAllAreas}
                  className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  Select all
                </button>
                <span className="text-muted-foreground/50">|</span>
                <button
                  type="button"
                  onClick={clearAllAreas}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="relative mb-4">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={areaSearch}
                onChange={(e) => setAreaSearch(e.target.value)}
                placeholder="Search areas..."
                className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {areas.length > 0 && (
              <p className="text-xs text-primary font-semibold mb-3">
                {areas.length} area{areas.length !== 1 ? "s" : ""} selected
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
              {filteredAreas.map((area) => (
                <AreaCheckbox
                  key={area}
                  area={area}
                  checked={areas.includes(area)}
                  onChange={(checked) => toggleArea(area, checked)}
                />
              ))}
            </div>

            {hiddenAreasCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllAreas(true)}
                className="mt-3 text-sm text-primary hover:text-primary/80 font-semibold flex items-center gap-1 transition-colors"
              >
                Show {hiddenAreasCount} more areas
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}

            {showAllAreas && !areaSearch && (
              <button
                type="button"
                onClick={() => setShowAllAreas(false)}
                className="mt-3 text-sm text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1 transition-colors"
              >
                Show less
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            )}

            {areas.length === 0 && (
              <p className="text-xs text-muted-foreground mt-3 italic">No areas selected – all areas will be considered</p>
            )}
          </section>

          {/* Location */}
          <section className="rounded-2xl border border-border/60 bg-card/60 shadow-sm p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Location</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-foreground/80 mb-1.5">
                  Country
                </label>
                <div className="relative">
                  <select
                    id="country"
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      // reset city UX when changing country
                      setCity("");
                      setShowCitySuggestions(false);
                    }}
                    className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  >
                    <option value="">-- Select a country --</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <div className="relative">
                <label htmlFor="city" className="block text-sm font-medium text-foreground/80 mb-1.5">
                  City <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  onFocus={() => {
                    if (!country) return;
                    if (citySuggestions.length > 0) setShowCitySuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
                  placeholder="e.g. Milano, London, New York"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  autoComplete="off"
                  disabled={!country}
                />

                {showCitySuggestions && citySuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    {citySuggestions.slice(0, 8).map((c) => (
                      <li key={c}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectCity(c);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                        >
                          {c}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* Preferences */}
          <section className="rounded-2xl border border-border/60 bg-card/60 shadow-sm p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Preferences</h2>

            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label htmlFor="remote-toggle" className="text-sm font-medium text-foreground/90">
                    Accept remote positions
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">Include remote job opportunities in your matches</p>
                </div>
                <Toggle id="remote-toggle" checked={remote} onChange={(v) => setRemote(v)} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label htmlFor="experience-slider" className="text-sm font-medium text-foreground/90">
                    Years of Experience
                  </label>
                  <span className="text-lg font-semibold text-primary tabular-nums">
                    {experienceYears} <span className="text-sm font-normal text-muted-foreground">years</span>
                  </span>
                </div>

                <input
                  id="experience-slider"
                  type="range"
                  min={0}
                  max={25}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />

                <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                  <span>0</span>
                  <span>5</span>
                  <span>10</span>
                  <span>15</span>
                  <span>20</span>
                  <span>25+</span>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
          </section>
        </div>
      </main>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 sm:static bg-background/95 backdrop-blur border-t border-border/50 sm:border-0 sm:bg-transparent sm:backdrop-blur-none">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-none rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm font-semibold hover:bg-muted/40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={saving}
            className="flex-1 sm:flex-none rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
