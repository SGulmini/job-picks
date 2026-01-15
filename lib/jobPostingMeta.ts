export type JobMeta = {
  language: string; // e.g. "English" | "French" | "N/A"
  activityRate: string; // e.g. "80–100%" | "Full-time" | "N/A"
};

function norm(s: string) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTagsToNewlines(s: string) {
  // Preserve some structure so "Languages:" sections survive (best effort).
  return String(s || "").replace(/<[^>]+>/g, "\n");
}

function pickLanguageLabel(token: string): string | null {
  const t = token.toLowerCase();
  if (/(^|[^a-z])english([^a-z]|$)/i.test(token) || /anglais/.test(t)) return "English";
  if (/(^|[^a-z])french([^a-z]|$)/i.test(token) || /fran[çc]ais/.test(t)) return "French";
  if (/(^|[^a-z])german([^a-z]|$)/i.test(token) || /allemand/.test(t) || /deutsch/.test(t)) return "German";
  if (/(^|[^a-z])italian([^a-z]|$)/i.test(token) || /italien/.test(t) || /italiano/.test(t)) return "Italian";
  if (/(^|[^a-z])spanish([^a-z]|$)/i.test(token) || /espagnol/.test(t) || /espa[nñ]ol/.test(t)) return "Spanish";
  return null;
}

type LangHit = { label: string; level?: string; kind?: "required" | "plus" };

function extractLanguagesFromChunk(chunkRaw: string): LangHit[] {
  const chunk = norm(chunkRaw);
  if (!chunk) return [];

  const lower = chunk.toLowerCase();

  const kind: LangHit["kind"] =
    /\b(plus|nice to have|preferred|asset|atout|bonus|serait un plus|un plus)\b/i.test(chunk)
      ? "plus"
      : /\b(required|mandatory|must|fluent|excellent|native|bilingual|good command|proficient|proficiency)\b/i.test(
            chunk
          ) || /\b([abc][12])\b/i.test(chunk)
        ? "required"
        : undefined;

  const levelMatch = chunk.match(/\b([ABC][12])\b/);
  const level = levelMatch ? levelMatch[1].toUpperCase() : undefined;

  // Find all languages mentioned in this chunk.
  const candidates = [
    { label: "English", re: /\b(english|anglais)\b/i },
    { label: "French", re: /\b(french|fran[çc]ais)\b/i },
    { label: "German", re: /\b(german|allemand|deutsch)\b/i },
    { label: "Italian", re: /\b(italian|italien|italiano)\b/i },
    { label: "Spanish", re: /\b(spanish|espagnol|espa[nñ]ol)\b/i },
  ];

  const hits: LangHit[] = [];
  for (const c of candidates) {
    if (c.re.test(lower)) hits.push({ label: c.label, level, kind });
  }
  return hits;
}

function formatLangHits(hits: LangHit[]): string {
  if (!hits.length) return "N/A";

  // Merge by language, preferring "required" over "plus", and keeping best CEFR level if present.
  const rankKind = (k?: LangHit["kind"]) => (k === "required" ? 2 : k === "plus" ? 1 : 0);
  const rankLevel = (lvl?: string) => {
    if (!lvl) return 0;
    const m = lvl.toUpperCase();
    return m === "C2" ? 6 : m === "C1" ? 5 : m === "B2" ? 4 : m === "B1" ? 3 : m === "A2" ? 2 : m === "A1" ? 1 : 0;
  };

  const merged = new Map<string, LangHit>();
  for (const h of hits) {
    const prev = merged.get(h.label);
    if (!prev) {
      merged.set(h.label, h);
      continue;
    }
    const next: LangHit = { label: h.label };
    next.kind = rankKind(h.kind) >= rankKind(prev.kind) ? h.kind : prev.kind;
    next.level = rankLevel(h.level) >= rankLevel(prev.level) ? h.level : prev.level;
    merged.set(h.label, next);
  }

  const ordered = Array.from(merged.values()).sort((a, b) => {
    const dk = rankKind(b.kind) - rankKind(a.kind);
    if (dk !== 0) return dk;
    const dl = rankLevel(b.level) - rankLevel(a.level);
    if (dl !== 0) return dl;
    return a.label.localeCompare(b.label);
  });

  return ordered
    .map((h) => {
      const parts: string[] = [h.label];
      if (h.level) parts.push(h.level);
      if (h.kind === "plus") parts.push("plus");
      // If required is implied, we omit the word to keep the chip short.
      return parts.length > 1 ? `${parts[0]} (${parts.slice(1).join(", ")})` : parts[0];
    })
    .join(", ");
}

export function extractJobMetaFromDescription(description?: string): JobMeta {
  const raw = String(description || "");
  const text = norm(raw);
  if (!text) return { language: "N/A", activityRate: "N/A" };

  // --- Activity rate ---
  // Prefer explicit "activity rate" / "taux d'activité" lines
  const rangePct =
    text.match(/\b(\d{2,3})\s*[-–]\s*(\d{2,3})\s*%\b/i) ||
    text.match(/\b(taux d['’]activit[eé]|activity rate)\s*[:\-]?\s*(\d{2,3})\s*[-–]\s*(\d{2,3})\s*%\b/i);
  let activityRate = "N/A";
  if (rangePct) {
    const a = rangePct[1] && /\d/.test(rangePct[1]) ? rangePct[1] : rangePct[2];
    const b = rangePct[2] && /\d/.test(rangePct[2]) ? rangePct[2] : rangePct[3];
    if (a && b) activityRate = `${a}–${b}%`;
  } else {
    const pct =
      text.match(/\b(taux d['’]activit[eé]|activity rate)\s*[:\-]?\s*(\d{2,3})\s*%\b/i) ||
      text.match(/\b(\d{2,3})\s*%\b/);
    if (pct) {
      const val = pct[pct.length - 1];
      const n = parseInt(val, 10);
      if (Number.isFinite(n) && n >= 10 && n <= 100) activityRate = `${n}%`;
    }
  }
  if (activityRate === "N/A") {
    if (/\b(full[-\s]?time|100%\b)\b/i.test(text)) activityRate = "Full-time";
    else if (/\b(part[-\s]?time)\b/i.test(text)) activityRate = "Part-time";
  }

  // --- Language requirement ---
  // Scan for language requirements anywhere in the description. Many postings include it in bullet points or sections.
  const scan = stripTagsToNewlines(raw).replace(/\u00a0/g, " ").replace(/\r/g, "");
  const chunks = [
    ...scan.split("\n").map((x) => x.trim()).filter(Boolean),
    ...scan.split(/[.!?•]+/).map((x) => x.trim()).filter(Boolean),
  ];

  // Prefer chunks that look like "Languages:" / "Langues:" / "Language requirements".
  const priority = chunks.filter((c) => /\b(language|languages|langue|langues|sprach|sprache|lingua|idioma)\b/i.test(c));
  const secondary = chunks.filter((c) =>
    /\b(required|mandatory|must|fluent|bilingual|native|proficient|proficiency|excellent)\b/i.test(c)
  );

  const hits: LangHit[] = [];
  for (const c of [...priority, ...secondary, ...chunks]) {
    hits.push(...extractLanguagesFromChunk(c));
  }
  const language = formatLangHits(hits);

  return { language, activityRate };
}

