"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type CvFileMeta = {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
};

type CandidateProfile = {
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

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function readCandidate(): CandidateProfile | null {
  try {
    const raw = localStorage.getItem(CANDIDATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeCandidate(p: CandidateProfile) {
  localStorage.setItem(CANDIDATE_KEY, JSON.stringify(p));
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

  const existing = useMemo(() => readCandidate(), []);

  const [firstName, setFirstName] = useState(existing?.firstName || "");
  const [lastName, setLastName] = useState(existing?.lastName || "");
  const [phone, setPhone] = useState(existing?.phone || "");
  const [addressLine1, setAddressLine1] = useState(existing?.addressLine1 || "");
  const [zip, setZip] = useState(existing?.zip || "");
  const [city, setCity] = useState(existing?.city || "");
  const [country, setCountry] = useState(existing?.country || "");
  const [cvText, setCvText] = useState(existing?.cvText || "");
  const [cvFile, setCvFile] = useState<CvFileMeta | null>(existing?.cvFile || null);
  const [showCvText, setShowCvText] = useState(false);
  const [loadingCv, setLoadingCv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  function onSave() {
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
      updatedAt: new Date().toISOString(),
    };

    writeCandidate(candidate);

    const url = new URL(returnTo, window.location.origin);
    if (jobId) url.searchParams.set("generateCoverLetterFor", jobId);
    if (jobId && lang) url.searchParams.set("generateCoverLetterLang", lang);
    router.push(url.pathname + (url.search ? url.search : ""));
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

