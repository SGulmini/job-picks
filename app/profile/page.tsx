"use client";

import { useEffect, useState } from "react";
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
  subscriptionTier?: "free" | "premium"; // Subscription tier: free = 1 job, premium = 3 jobs
  // Legacy support
  seniority?: string | string[]; // For migration
  level?: string;
};

// Major cities by country for autocomplete suggestions
const CITIES_BY_COUNTRY: Record<string, string[]> = {
  "United States": ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "San Francisco", "Seattle", "Denver", "Boston", "Washington", "Remote"],
  "United Kingdom": ["London", "Birmingham", "Manchester", "Glasgow", "Liverpool", "Leeds", "Edinburgh", "Bristol", "Cardiff", "Remote"],
  "Italy": ["Roma", "Milano", "Napoli", "Torino", "Palermo", "Genova", "Bologna", "Firenze", "Bari", "Catania", "Venezia", "Verona", "Remote"],
  "Germany": ["Berlin", "Hamburg", "München", "Köln", "Frankfurt", "Stuttgart", "Düsseldorf", "Dortmund", "Essen", "Leipzig", "Remote"],
  "France": ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg", "Montpellier", "Bordeaux", "Lille", "Remote"],
  "Spain": ["Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Málaga", "Murcia", "Bilbao", "Alicante", "Remote"],
  "Netherlands": ["Amsterdam", "Rotterdam", "Den Haag", "Utrecht", "Eindhoven", "Groningen", "Tilburg", "Remote"],
  "Switzerland": ["Zürich", "Genève", "Basel", "Bern", "Lausanne", "Remote"],
  "Canada": ["Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg", "Remote"],
  "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra", "Remote"],
  "Belgium": ["Brussels", "Antwerp", "Ghent", "Charleroi", "Liège", "Bruges", "Remote"],
  "Austria": ["Vienna", "Graz", "Linz", "Salzburg", "Innsbruck", "Remote"],
  "Sweden": ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Västerås", "Remote"],
  "Norway": ["Oslo", "Bergen", "Trondheim", "Stavanger", "Remote"],
  "Denmark": ["Copenhagen", "Aarhus", "Odense", "Aalborg", "Remote"],
  "Poland": ["Warsaw", "Kraków", "Łódź", "Wrocław", "Poznań", "Remote"],
  "Ireland": ["Dublin", "Cork", "Limerick", "Galway", "Remote"],
  "Portugal": ["Lisbon", "Porto", "Braga", "Coimbra", "Remote"],
  "Greece": ["Athens", "Thessaloniki", "Patras", "Heraklion", "Remote"],
  "Japan": ["Tokyo", "Yokohama", "Osaka", "Nagoya", "Sapporo", "Remote"],
  "Singapore": ["Singapore", "Remote"],
  "South Korea": ["Seoul", "Busan", "Incheon", "Daegu", "Remote"],
  "India": ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Remote"],
  "Brazil": ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza", "Remote"],
  "Mexico": ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Remote"],
  "Argentina": ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Remote"],
  "Chile": ["Santiago", "Valparaíso", "Concepción", "Remote"],
  "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Remote"],
  "Israel": ["Tel Aviv", "Jerusalem", "Haifa", "Remote"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah", "Remote"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Mecca", "Remote"],
  "Turkey": ["Istanbul", "Ankara", "İzmir", "Bursa", "Remote"],
  "Russia": ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Remote"],
  "China": ["Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Remote"],
  "Indonesia": ["Jakarta", "Surabaya", "Bandung", "Medan", "Remote"],
  "Malaysia": ["Kuala Lumpur", "George Town", "Johor Bahru", "Remote"],
  "Thailand": ["Bangkok", "Nonthaburi", "Chiang Mai", "Remote"],
  "Philippines": ["Manila", "Quezon City", "Caloocan", "Remote"],
  "Vietnam": ["Ho Chi Minh City", "Hanoi", "Da Nang", "Remote"],
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

export default function ProfilePage() {
  const router = useRouter();

  const [roles, setRoles] = useState<string[]>([""]); // Start with one empty role field
  const [areas, setAreas] = useState<string[]>([]); // Start empty - user can select or leave empty for all
  const [experienceYears, setExperienceYears] = useState<number>(3);
  const [country, setCountry] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [remote, setRemote] = useState<boolean>(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if this is a new profile setup or edit
  // If profile already exists and we're on /profile (not /profile/edit), redirect to home
  useEffect(() => {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw) as Partial<Profile>;
        // Check if profile is complete and valid
        // Areas can be empty array (means all areas)
        if (p.role && p.country && p.areas && Array.isArray(p.areas)) {
          // Check if we're on /profile (not /profile/edit)
          if (window.location.pathname === "/profile") {
            router.replace("/home");
            return;
          }
        }
      } catch {
        // Invalid profile, continue with form
      }
    }
  }, [router]);

  // Carica eventuale profilo salvato e salva l'email quando disponibile
  useEffect(() => {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return;

    try {
      const p = JSON.parse(raw) as Partial<Profile>;
      // Support new format (roles array) and old format (role string)
      if (Array.isArray(p.roles) && p.roles.length > 0) {
        setRoles(p.roles.filter(r => r && r.trim().length > 0));
        if (roles.length === 0) setRoles([""]); // Ensure at least one field
      } else if (typeof p.role === "string" && p.role.trim().length > 0) {
        // Migrate from old format
        setRoles([p.role]);
      } else {
        setRoles([""]);
      }
      // Support both old format (area as string) and new format (areas as array)
      if (Array.isArray(p.areas)) {
        setAreas(p.areas);
      } else if (typeof (p as any).area === "string") {
        // Migrate from old format
        setAreas([(p as any).area]);
      } else {
        // Empty array means all areas
        setAreas([]);
      }
      if (typeof p.remote === "boolean") {
        setRemote(p.remote);
      }
      // Support experienceYears (new format) and legacy formats (seniority, level)
      if (typeof p.experienceYears === "number" && p.experienceYears >= 0) {
        setExperienceYears(p.experienceYears);
      } else if (typeof p.experienceYears === "number" && p.experienceYears >= 0) {
        setExperienceYears(p.experienceYears);
      } else if (typeof p.level === "string") {
        // Migrate from old level format: Junior -> 1, Mid -> 3, Senior -> 5
        const levelMap: Record<string, number> = {
          Junior: 1,
          Mid: 3,
          Senior: 5,
        };
        setExperienceYears(levelMap[p.level] || 3);
      } else if (p.seniority) {
        // Migrate from seniority taxonomy to approximate years
        const seniorityStr = Array.isArray(p.seniority) ? p.seniority[0] : (typeof p.seniority === "string" ? p.seniority : "");
        if (seniorityStr) {
          const seniorityLower = seniorityStr.toLowerCase();
          if (seniorityLower.includes("intern") || seniorityLower.includes("trainee")) {
            setExperienceYears(0);
          } else if (seniorityLower.includes("junior")) {
            setExperienceYears(1);
          } else if (seniorityLower.includes("regular") || seniorityLower.includes("mid")) {
            setExperienceYears(3);
          } else if (seniorityLower.includes("senior") && !seniorityLower.includes("manager") && !seniorityLower.includes("director")) {
            setExperienceYears(5);
          } else if (seniorityLower.includes("lead") || seniorityLower.includes("expert") || seniorityLower.includes("principal")) {
            setExperienceYears(7);
          } else if (seniorityLower.includes("team lead")) {
            setExperienceYears(8);
          } else if (seniorityLower.includes("manager") && !seniorityLower.includes("senior") && !seniorityLower.includes("head")) {
            setExperienceYears(10);
          } else {
            setExperienceYears(5); // Default
          }
        }
      }
      // Load country if available
      if (typeof p.country === "string") {
        setCountry(p.country);
      }
      // Load city if available
      if (typeof p.city === "string") {
        setCity(p.city);
      }
    } catch {
      // se JSON rotto, lo puliamo
      localStorage.removeItem(PROFILE_KEY);
    }

    // Salva l'email quando la sessione è disponibile
    const saveEmail = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        localStorage.setItem('jobpicks_user_email', session.user.email);
      }
    };

    saveEmail();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Don't restore session if we're logging out
      if (sessionStorage.getItem('jobpicks_logging_out') === 'true' || event === 'SIGNED_OUT') {
        return;
      }
      
      if (session?.user?.email) {
        localStorage.setItem('jobpicks_user_email', session.user.email);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const onContinue = async (e?: React.MouseEvent | React.FormEvent) => {
    e?.preventDefault?.();

    setError(null);

    // Clean and validate roles - remove empty ones
    const cleanRoles = roles
      .map(r => r.trim())
      .filter(r => r.length > 0);
    
    if (cleanRoles.length === 0) {
      setError("Please enter at least one job title (e.g. Data Analyst).");
      return;
    }

    // Areas can be empty - that means all areas are considered

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
      roles: cleanRoles, // Array of job titles
      areas, // Can be empty array (means all areas)
      experienceYears, // Years of experience
      country: country.trim(),
      city: city.trim() || undefined, // Only save if not empty
      remote, // Whether to accept remote positions
    };

    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

      // Debug: verifica immediata
      console.log("Saved profile:", localStorage.getItem(PROFILE_KEY));

      // Redirect to home after saving
      router.push("/home");
    } catch (err) {
      console.error(err);
      setError("Could not save your profile. Try again.");
      setSaving(false);
    }
  };

  // Reset city suggestions when country changes
  useEffect(() => {
    if (country) {
      // Update city suggestions based on country
      const suggestions = CITIES_BY_COUNTRY[country] || [];
      setCitySuggestions(suggestions);
    } else {
      setCitySuggestions([]);
    }
  }, [country]);

  // Handle city input with autocomplete
  const handleCityChange = (value: string) => {
    setCity(value);
    if (country && value.length > 0) {
      const allSuggestions = CITIES_BY_COUNTRY[country] || [];
      const filtered = allSuggestions.filter((c) =>
        c.toLowerCase().includes(value.toLowerCase())
      );
      setCitySuggestions(filtered);
      setShowSuggestions(filtered.length > 0 && filtered.length <= 20); // Show max 20 suggestions
    } else if (country && value.length === 0) {
      // Show all suggestions when input is empty
      const allSuggestions = CITIES_BY_COUNTRY[country] || [];
      setCitySuggestions(allSuggestions);
      setShowSuggestions(false);
    } else {
      setCitySuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectCity = (selectedCity: string) => {
    setCity(selectedCity);
    setShowSuggestions(false);
  };

  const onReset = () => {
    localStorage.removeItem(PROFILE_KEY);
    setRoles([""]);
    setAreas([]);
    setExperienceYears(3);
    setCountry("");
    setCity("");
    setRemote(false);
    setError(null);
  };


  const addRole = () => {
    setRoles([...roles, ""]);
  };

  const removeRole = (index: number) => {
    if (roles.length > 1) {
      setRoles(roles.filter((_, i) => i !== index));
    }
  };

  const updateRole = (index: number, value: string) => {
    const newRoles = [...roles];
    newRoles[index] = value;
    setRoles(newRoles);
  };

  const toggleArea = (area: string) => {
    setAreas((prev) => {
      if (prev.includes(area)) {
        // Remove if already selected - allow empty array (means all areas)
        return prev.filter((a) => a !== area);
      } else {
        // Add if not selected
        return [...prev, area];
      }
    });
  };

  return (
    <main style={{ padding: "16px 24px", fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.7 }}>JOB PICKS</div>
        <h1 style={{ margin: "4px 0", fontSize: 24 }}>Set up your profile</h1>
        <p style={{ margin: 0, opacity: 0.8, fontSize: 13 }}>
          Get 2–3 relevant jobs per day. No noise. You can change this anytime.
        </p>
      </div>

      <form
        onSubmit={onContinue}
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
        }}
      >
        <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Job Titles</label>
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
          Add one or more job titles you're interested in. Example: Data Analyst, Frontend Developer, Product Manager
        </div>
        {roles.map((role, index) => (
          <div key={index} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
            <input
              value={role}
              onChange={(e) => updateRole(index, e.target.value)}
              placeholder="e.g. Data Analyst"
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ddd",
                outline: "none",
                fontSize: 14,
              }}
            />
            {roles.length > 1 && (
              <button
                type="button"
                onClick={() => removeRole(index)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                  color: "#d32f2f",
                  fontWeight: 600,
                  fontSize: 18,
                }}
                title="Remove this job title"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addRole}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#f5f5f5",
            cursor: "pointer",
            fontSize: 12,
            color: "#666",
            marginBottom: 12,
          }}
        >
          + Add another job title
        </button>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
            Areas (select one or more)
          </label>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
            Select all areas that interest you. You can select multiple. Leave empty to consider all areas.
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
              gap: 6,
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 8,
              maxHeight: 140,
              overflowY: "auto",
            }}
          >
            {AVAILABLE_AREAS.map((area) => (
              <label
                key={area}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  padding: 6,
                  borderRadius: 4,
                  backgroundColor: areas.includes(area) ? "#f0f0f0" : "transparent",
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={areas.includes(area)}
                  onChange={() => toggleArea(area)}
                  style={{ cursor: "pointer", width: 14, height: 14 }}
                />
                <span>{area}</span>
              </label>
            ))}
          </div>
          {areas.length > 0 ? (
            <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
              Selected: {areas.join(", ")}
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7, fontStyle: "italic" }}>
              No areas selected - all areas will be considered
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
              Country
            </label>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
              Select the country where you want to search for jobs
            </div>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid var(--jp-input-border)",
                backgroundColor: "var(--jp-input-bg)",
                color: "var(--jp-input-fg)",
                outline: "none",
                fontSize: 14,
              }}
              required
            >
              <option value="">-- Select a country --</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {country && (
            <div style={{ position: "relative" }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
                City (optional)
              </label>
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
                Enter a city name. Suggestions will appear as you type.
              </div>
              <input
                type="text"
                value={city}
                onChange={(e) => handleCityChange(e.target.value)}
                onFocus={() => {
                  if (country && citySuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding suggestions to allow clicks
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="e.g. Milano, London, New York"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid var(--jp-input-border)",
                  backgroundColor: "var(--jp-input-bg)",
                  color: "var(--jp-input-fg)",
                  outline: "none",
                  fontSize: 14,
                }}
              />
              {showSuggestions && citySuggestions.length > 0 && (
                <div
                  style={{
                    // Render in normal flow (no overlap). This pushes content down instead of covering it.
                    marginTop: 6,
                    backgroundColor: "var(--jp-panel-bg)",
                    color: "var(--jp-panel-fg)",
                    border: "1px solid var(--jp-panel-border)",
                    borderRadius: 8,
                    boxShadow: "var(--jp-shadow)",
                    maxHeight: 180,
                    overflowY: "auto",
                  }}
                >
                  {citySuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      // Use onMouseDown so selection happens before the input's onBlur hides the list.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectCity(suggestion);
                      }}
                      onClick={() => selectCity(suggestion)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        cursor: "pointer",
                        border: "none",
                        borderBottom: "1px solid var(--jp-panel-border)",
                        backgroundColor:
                          city === suggestion ? "var(--jp-panel-selected)" : "transparent",
                        color: "inherit",
                        fontSize: 13,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--jp-panel-hover)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          city === suggestion ? "var(--jp-panel-selected)" : "transparent";
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={remote}
                onChange={(e) => setRemote(e.target.checked)}
                style={{ cursor: "pointer", width: 16, height: 16 }}
              />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 14 }}>Accept remote positions</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  Include remote job opportunities
                </div>
              </div>
            </label>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
              Years of Experience
            </label>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
              How many years of professional experience do you have?
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="range"
                min="0"
                max="20"
                value={experienceYears}
                onChange={(e) => setExperienceYears(parseInt(e.target.value))}
                style={{ flex: 1, cursor: "pointer" }}
              />
              <input
                type="number"
                min="0"
                max="50"
                value={experienceYears}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 0 && val <= 50) {
                    setExperienceYears(val);
                  }
                }}
                style={{
                  width: 70,
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  textAlign: "center",
                  fontSize: 14,
                }}
              />
              <span style={{ fontSize: 13, opacity: 0.7, whiteSpace: "nowrap" }}>
                {experienceYears === 1 ? "year" : "years"}
              </span>
            </div>
          </div>
        </div>

        {error && <p style={{ color: "red", marginTop: 10, fontSize: 13 }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          {/* IMPORTANTISSIMO: type="button" evita submit involontari/reload */}
          <button
            type="button"
            onClick={onContinue}
            disabled={saving}
            style={{
              padding: "12px 24px",
              borderRadius: 8,
              border: "none",
              cursor: saving ? "not-allowed" : "pointer",
              background: "#111",
              color: "white",
              opacity: saving ? 0.7 : 1,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {saving ? "Saving..." : "Continue"}
          </button>

          <button
            type="button"
            onClick={onReset}
            style={{
              background: "transparent",
              border: "none",
              color: "#666",
              cursor: "pointer",
              textDecoration: "underline",
              opacity: 0.8,
              fontSize: 13,
            }}
          >
            Reset profile
          </button>
        </div>
      </form>
    </main>
  );
}
