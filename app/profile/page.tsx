"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Area = "IT" | "Data" | "Business";
type Level = "junior" | "mid" | "senior";

type Profile = {
  role: string;
  area: Area;
  level: Level;
};

const STORAGE_KEY = "jobpicks_profile";

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile>({
    role: "",
    area: "IT",
    level: "mid",
  });

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // soft-validate shape
        if (parsed && typeof parsed === "object") {
          setProfile({
            role: typeof parsed.role === "string" ? parsed.role : "",
            area: ["IT", "Data", "Business"].includes(parsed.area) ? parsed.area : "IT",
            level: ["junior", "mid", "senior"].includes(parsed.level) ? parsed.level : "mid",
          });
        }
      } catch {
        // ignore
      }
    }
    setIsLoaded(true);
  }, []);

  const canContinue = useMemo(() => profile.role.trim().length >= 2, [profile.role]);

  function saveProfile(next: Profile) {
    setProfile(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function onContinue() {
    // ensure we save latest before navigating
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    router.push("/home");
  }

  function onReset() {
    localStorage.removeItem(STORAGE_KEY);
    setProfile({ role: "", area: "IT", level: "mid" });
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <header className="mb-8">
          <div className="text-xs font-semibold tracking-wider text-zinc-500">
            JOB PICKS
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            Set up your profile
          </h1>
          <p className="mt-2 text-zinc-600">
            Get 2–3 relevant jobs per day. No noise. You can change this anytime.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6">
            <div>
              <label className="text-sm font-medium text-zinc-900">Role</label>
              <p className="mt-1 text-sm text-zinc-500">
                Example: Data Analyst, Frontend Developer, Product Ops
              </p>
              <input
                value={profile.role}
                onChange={(e) =>
                  saveProfile({ ...profile, role: e.target.value })
                }
                placeholder="Type a role…"
                className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-400"
              />
              {!canContinue && isLoaded && (
                <p className="mt-2 text-sm text-zinc-500">
                  Add at least 2 characters to continue.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-zinc-900">Area</label>
                <select
                  value={profile.area}
                  onChange={(e) =>
                    saveProfile({
                      ...profile,
                      area: e.target.value as Area,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-400"
                >
                  <option value="IT">IT</option>
                  <option value="Data">Data</option>
                  <option value="Business">Business</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-900">Level</label>
                <select
                  value={profile.level}
                  onChange={(e) =>
                    saveProfile({
                      ...profile,
                      level: e.target.value as Level,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-400"
                >
                  <option value="junior">Junior</option>
                  <option value="mid">Mid</option>
                  <option value="senior">Senior</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={onContinue}
                disabled={!isLoaded || !canContinue}
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>

              <button
                onClick={onReset}
                className="text-sm text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline"
              >
                Reset profile
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
