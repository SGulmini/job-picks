import { supabase } from "./supabaseClient";

export type CvFileMeta = {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
};

export type CandidateProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string; // street + number
  zip: string;
  city: string;
  country: string;
  cvText: string;
  cvFile?: CvFileMeta | null;
  updatedAt: string;
};

const CANDIDATE_KEY = "jobPicks_candidate_v1";

/**
 * Load candidate profile from Supabase (if authenticated) or localStorage (fallback)
 */
export async function loadCandidateProfile(): Promise<CandidateProfile | null> {
  try {
    // Try Supabase first if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user?.id) {
      const { data, error } = await supabase
        .from("candidate_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (!error && data) {
        // Sync to localStorage as backup
        const profile: CandidateProfile = {
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          phone: data.phone || "",
          addressLine1: data.address_line1 || "",
          zip: data.zip || "",
          city: data.city || "",
          country: data.country || "",
          cvText: data.cv_text || "",
          cvFile: data.cv_file ? JSON.parse(data.cv_file) : null,
          updatedAt: data.updated_at || new Date().toISOString(),
        };
        
        // Save to localStorage as backup
        try {
          localStorage.setItem(CANDIDATE_KEY, JSON.stringify(profile));
        } catch {
          // Ignore localStorage errors
        }
        
        return profile;
      }
    }

    // Fallback to localStorage
    const raw = localStorage.getItem(CANDIDATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    // Final fallback to localStorage
    try {
      const raw = localStorage.getItem(CANDIDATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
}

/**
 * Save candidate profile to Supabase (if authenticated) and localStorage (backup)
 */
export async function saveCandidateProfile(profile: CandidateProfile): Promise<void> {
  // Always save to localStorage as backup
  try {
    localStorage.setItem(CANDIDATE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore localStorage errors
  }

  // Try to save to Supabase if user is authenticated
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user?.id) {
      const { error } = await supabase
        .from("candidate_profiles")
        .upsert({
          user_id: session.user.id,
          first_name: profile.firstName,
          last_name: profile.lastName,
          phone: profile.phone,
          address_line1: profile.addressLine1,
          zip: profile.zip,
          city: profile.city,
          country: profile.country,
          cv_text: profile.cvText,
          cv_file: profile.cvFile ? JSON.stringify(profile.cvFile) : null,
          updated_at: profile.updatedAt || new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (error) {
        console.error("Error saving candidate profile to Supabase:", error);
        // Continue anyway - localStorage backup is already saved
      }
    }
  } catch (error) {
    console.error("Error saving candidate profile to Supabase:", error);
    // Continue anyway - localStorage backup is already saved
  }
}

/**
 * Check if candidate profile exists and is valid
 */
export async function hasCandidateProfile(): Promise<boolean> {
  const profile = await loadCandidateProfile();
  if (!profile) return false;
  
  return Boolean(
    profile &&
      typeof profile.firstName === "string" &&
      profile.firstName.trim() &&
      typeof profile.lastName === "string" &&
      profile.lastName.trim() &&
      typeof profile.phone === "string" &&
      profile.phone.trim() &&
      typeof profile.addressLine1 === "string" &&
      profile.addressLine1.trim() &&
      typeof profile.zip === "string" &&
      profile.zip.trim() &&
      typeof profile.city === "string" &&
      profile.city.trim() &&
      typeof profile.country === "string" &&
      profile.country.trim() &&
      typeof profile.cvText === "string" &&
      profile.cvText.trim()
  );
}

/**
 * Synchronize localStorage data to Supabase when user logs in
 */
export async function syncCandidateProfileToSupabase(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    // Check if Supabase already has data
    const { data: existing } = await supabase
      .from("candidate_profiles")
      .select("updated_at")
      .eq("user_id", session.user.id)
      .single();

    // If Supabase has no data, try to migrate from localStorage
    if (!existing) {
      const raw = localStorage.getItem(CANDIDATE_KEY);
      if (raw) {
        try {
          const profile = JSON.parse(raw) as CandidateProfile;
          await saveCandidateProfile(profile);
        } catch {
          // Ignore parse errors
        }
      }
    } else {
      // Supabase has data, sync to localStorage as backup
      const profile = await loadCandidateProfile();
      if (profile) {
        try {
          localStorage.setItem(CANDIDATE_KEY, JSON.stringify(profile));
        } catch {
          // Ignore localStorage errors
        }
      }
    }
  } catch (error) {
    console.error("Error syncing candidate profile:", error);
  }
}
