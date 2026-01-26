"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadCandidateProfile, saveCandidateProfile, type CandidateProfile, type CvFileMeta } from "@/lib/candidateProfile";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export default function CoverLetterSetupPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 24, fontFamily: "system-ui" }}>
          Loading setup...
        </main>
      }
    >
      <CoverLetterSetupInner />
    </Suspense>
  );
}

function CoverLetterSetupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo = searchParams.get("returnTo") || "/home";
  const jobId = searchParams.get("jobId") || "";
  const lang = searchParams.get("lang") || "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [cvText, setCvText] = useState("");
  const [cvFile, setCvFile] = useState<CvFileMeta | null>(null);
  const [cvCustomPhrases, setCvCustomPhrases] = useState<string[]>([]);
  const [newPhrase, setNewPhrase] = useState("");
  const [editingPhraseIndex, setEditingPhraseIndex] = useState<number | null>(null);
  const [editingPhraseText, setEditingPhraseText] = useState("");
  const [showCvText, setShowCvText] = useState(false);
  const [loadingCv, setLoadingCv] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load existing profile from Supabase/localStorage
  useEffect(() => {
    const loadProfile = async () => {
      try {
        // First sync from Supabase to ensure we have the latest data
        const { syncCandidateProfileToSupabase } = await import("@/lib/candidateProfile");
        await syncCandidateProfileToSupabase();
        
        // Then load the profile
        const existing = await loadCandidateProfile();
        if (existing) {
          setFirstName(existing.firstName || "");
          setLastName(existing.lastName || "");
          setPhone(existing.phone || "");
          setAddressLine1(existing.addressLine1 || "");
          setZip(existing.zip || "");
          setCity(existing.city || "");
          setCountry(existing.country || "");
          setCvText(existing.cvText || "");
          setCvFile(existing.cvFile || null);
          setCvCustomPhrases(existing.cvCustomPhrases || []);
        }
      } catch (error) {
        console.error("Error loading candidate profile:", error);
      } finally {
        setLoadingProfile(false);
      }
    };
    loadProfile();
  }, []);

  // If we already have everything and user landed here from Generate, allow one-click continue
  const canContinue = Boolean(
    firstName.trim() &&
      lastName.trim() &&
      phone.trim() &&
      addressLine1.trim() &&
      zip.trim() &&
      city.trim() &&
      country.trim() &&
      cvText.trim()
  );

  async function onUpload(file: File) {
    setError(null);
    setLoadingCv(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse-cv", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const parts = [
          data?.error ? String(data.error) : `Failed to parse CV (HTTP ${res.status})`,
          data?.details ? `Details: ${String(data.details)}` : "",
          data?.hint ? `Hint: ${String(data.hint)}` : "",
        ].filter(Boolean);
        throw new Error(parts.join("\n"));
      }
      if (!data?.cvText) throw new Error("No cvText returned");
      setCvText(String(data.cvText));
      setCvFile({
        name: file.name || "CV",
        size: typeof file.size === "number" ? file.size : 0,
        type: file.type || "",
        uploadedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setError(e?.message || "Failed to parse CV");
    } finally {
      setLoadingCv(false);
    }
  }

  async function onSave() {
    setError(null);
    if (!canContinue) {
      setError("Please fill all fields and upload your CV.");
      return;
    }

    const candidate: CandidateProfile = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      addressLine1: addressLine1.trim(),
      zip: zip.trim(),
      city: city.trim(),
      country: country.trim(),
      cvText: cvText.trim(),
      cvFile,
      cvCustomPhrases: cvCustomPhrases.filter(p => p.trim().length > 0),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveCandidateProfile(candidate);
      
      const url = new URL(returnTo, window.location.origin);
      if (jobId) url.searchParams.set("generateCoverLetterFor", jobId);
      if (jobId && lang) url.searchParams.set("generateCoverLetterLang", lang);
      router.push(url.pathname + (url.search ? url.search : ""));
    } catch (e: any) {
      setError(e?.message || "Failed to save profile. Please try again.");
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 820, margin: "0 auto" }}>
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
        <h1 style={{ margin: 0 }}>Cover letter setup</h1>
        <p style={{ margin: "8px 0 0 0", opacity: 0.75 }}>
          Before generating your first cover letter, we need some personal details and your CV so we can personalize it.
        </p>
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>First name</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid var(--jp-input-border)",
              backgroundColor: "var(--jp-input-bg)",
              color: "var(--jp-input-fg)",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Last name</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid var(--jp-input-border)",
              backgroundColor: "var(--jp-input-bg)",
              color: "var(--jp-input-fg)",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+41 …"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid var(--jp-input-border)",
              backgroundColor: "var(--jp-input-bg)",
              color: "var(--jp-input-fg)",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Address (street + number)</label>
          <input
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="Street 12"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid var(--jp-input-border)",
              backgroundColor: "var(--jp-input-bg)",
              color: "var(--jp-input-fg)",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>ZIP code</label>
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid var(--jp-input-border)",
              backgroundColor: "var(--jp-input-bg)",
              color: "var(--jp-input-fg)",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>City</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid var(--jp-input-border)",
              backgroundColor: "var(--jp-input-bg)",
              color: "var(--jp-input-fg)",
            }}
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Country</label>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid var(--jp-input-border)",
              backgroundColor: "var(--jp-input-bg)",
              color: "var(--jp-input-fg)",
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid var(--jp-panel-border)",
            backgroundColor: "var(--jp-panel-bg)",
            color: "var(--jp-panel-fg)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 800 }}>CV upload</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Upload PDF, DOCX, or TXT. We extract text to personalize the cover letter.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {cvText.trim() && (
                <button
                  type="button"
                  onClick={() => setShowCvText((v) => !v)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--jp-panel-border)",
                    backgroundColor: "transparent",
                    color: "var(--jp-panel-fg)",
                    fontWeight: 800,
                    cursor: "pointer",
                    opacity: 0.9,
                    whiteSpace: "nowrap",
                  }}
                  title={showCvText ? "Hide extracted text" : "Edit extracted text"}
                  aria-label={showCvText ? "Hide extracted text" : "Edit extracted text"}
                >
                  {showCvText ? "Hide text" : "Edit text"}
                </button>
              )}

              <label
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--jp-panel-border)",
                  backgroundColor: "var(--jp-panel-bg)",
                  color: "var(--jp-panel-fg)",
                  fontWeight: 800,
                  cursor: loadingCv ? "not-allowed" : "pointer",
                  opacity: loadingCv ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {loadingCv ? "Parsing..." : cvText.trim() ? "Replace CV" : "Upload CV"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(f);
                    // allow re-uploading same file name
                    if (e.target) e.target.value = "";
                  }}
                  style={{ display: "none" }}
                  disabled={loadingCv}
                />
              </label>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {cvText.trim() ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--jp-input-border)",
                  backgroundColor: "var(--jp-input-bg)",
                  color: "var(--jp-input-fg)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, display: "flex", gap: 8, alignItems: "center" }}>
                    <span aria-hidden>📎</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cvFile?.name || "CV uploaded"}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                    {cvFile ? `${formatBytes(cvFile.size)}${cvFile.type ? ` • ${cvFile.type}` : ""}` : "Saved (text extracted)"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCvText("");
                    setCvFile(null);
                    setShowCvText(false);
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--jp-panel-border)",
                    backgroundColor: "transparent",
                    color: "var(--jp-panel-fg)",
                    fontWeight: 800,
                    cursor: "pointer",
                    opacity: 0.9,
                    whiteSpace: "nowrap",
                  }}
                  aria-label="Remove CV"
                  title="Remove CV"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                No CV uploaded yet. Use “Upload CV” to attach one.
              </div>
            )}
          </div>

          {showCvText && (
            <textarea
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder="Paste/edit extracted CV text (used to personalize the cover letter)."
              style={{
                marginTop: 12,
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
          )}
        </div>
      </div>

      {/* CV Custom Phrases Section */}
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid var(--jp-panel-border)",
            backgroundColor: "var(--jp-panel-bg)",
            color: "var(--jp-panel-fg)",
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>CV Personalization Phrases</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Save phrases that you can copy and paste into your CV to personalize it for specific job positions.
            </div>
          </div>

          {/* Add new phrase */}
          <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
            <textarea
              value={newPhrase}
              onChange={(e) => setNewPhrase(e.target.value)}
              placeholder="Enter a phrase to save (e.g., 'Led B2B customer segmentation initiatives...')"
              style={{
                flex: 1,
                minHeight: 60,
                padding: 10,
                borderRadius: 10,
                border: "1px solid var(--jp-input-border)",
                backgroundColor: "var(--jp-input-bg)",
                color: "var(--jp-input-fg)",
                fontSize: 13,
                lineHeight: 1.5,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (newPhrase.trim()) {
                  setCvCustomPhrases([...cvCustomPhrases, newPhrase.trim()]);
                  setNewPhrase("");
                }
              }}
              disabled={!newPhrase.trim()}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid var(--jp-panel-border)",
                background: "linear-gradient(180deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))",
                color: "white",
                fontWeight: 800,
                cursor: newPhrase.trim() ? "pointer" : "not-allowed",
                opacity: newPhrase.trim() ? 1 : 0.5,
                whiteSpace: "nowrap",
                alignSelf: "flex-start",
              }}
            >
              Add
            </button>
          </div>

          {/* List of saved phrases */}
          {cvCustomPhrases.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {cvCustomPhrases.map((phrase, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: 10,
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid var(--jp-panel-border)",
                    backgroundColor: "var(--jp-input-bg)",
                  }}
                >
                  {editingPhraseIndex === index ? (
                    <div>
                      <textarea
                        value={editingPhraseText}
                        onChange={(e) => setEditingPhraseText(e.target.value)}
                        style={{
                          width: "100%",
                          minHeight: 60,
                          padding: 10,
                          borderRadius: 8,
                          border: "1px solid var(--jp-input-border)",
                          backgroundColor: "var(--jp-panel-bg)",
                          color: "var(--jp-input-fg)",
                          fontSize: 13,
                          lineHeight: 1.5,
                          resize: "vertical",
                          fontFamily: "inherit",
                        }}
                      />
                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...cvCustomPhrases];
                            updated[index] = editingPhraseText.trim();
                            setCvCustomPhrases(updated);
                            setEditingPhraseIndex(null);
                            setEditingPhraseText("");
                          }}
                          disabled={!editingPhraseText.trim()}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--jp-panel-border)",
                            background: "linear-gradient(180deg, rgba(59,130,246,0.95), rgba(37,99,235,0.95))",
                            color: "white",
                            fontWeight: 700,
                            cursor: editingPhraseText.trim() ? "pointer" : "not-allowed",
                            opacity: editingPhraseText.trim() ? 1 : 0.5,
                            fontSize: 12,
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPhraseIndex(null);
                            setEditingPhraseText("");
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--jp-panel-border)",
                            backgroundColor: "transparent",
                            color: "var(--jp-panel-fg)",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8 }}>
                        {phrase}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(phrase);
                              // Visual feedback could be added here
                            } catch {
                              // Ignore clipboard errors
                            }
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--jp-panel-border)",
                            background: "linear-gradient(180deg, rgba(168,85,247,0.95), rgba(126,34,206,0.95))",
                            color: "white",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPhraseIndex(index);
                            setEditingPhraseText(phrase);
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--jp-panel-border)",
                            backgroundColor: "transparent",
                            color: "var(--jp-panel-fg)",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCvCustomPhrases(cvCustomPhrases.filter((_, i) => i !== index));
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--jp-panel-border)",
                            backgroundColor: "transparent",
                            color: "#ef4444",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {cvCustomPhrases.length === 0 && (
            <div style={{ fontSize: 13, opacity: 0.75, fontStyle: "italic", padding: "12px 0" }}>
              No phrases saved yet. Add phrases above to personalize your CV for different positions.
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, color: "#ef4444", fontWeight: 700 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: "10px 12px",
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
        <button
          onClick={onSave}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid var(--jp-panel-border)",
            background: "linear-gradient(180deg, rgba(168,85,247,0.95), rgba(79,70,229,0.95))",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "var(--jp-shadow)",
          }}
        >
          Save & continue
        </button>
      </div>
    </main>
  );
}

