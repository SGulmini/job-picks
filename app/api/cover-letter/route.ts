import { NextRequest, NextResponse } from "next/server";
import { 
  COVER_LETTER_TEMPLATE_EN, 
  COVER_LETTER_TEMPLATE_FR,
  COVER_LETTER_TEMPLATE_EN_SHORT,
  COVER_LETTER_TEMPLATE_FR_SHORT,
  COVER_LETTER_TEMPLATE_EN_VERY_SHORT,
  COVER_LETTER_TEMPLATE_FR_VERY_SHORT,
  COVER_LETTER_TEMPLATE_EN_CREATIVE,
  COVER_LETTER_TEMPLATE_FR_CREATIVE
} from "@/lib/coverLetterTemplate";

type JobInput = {
  id?: string;
  title?: string;
  company?: string;
  location?: string;
  url?: string;
  description?: string;
};

type ProfileInput = {
  roles?: string[];
  role?: string;
  areas?: string[];
  area?: string;
  country?: string;
  city?: string;
  remote?: boolean;
  experienceYears?: number;
};

type CandidateInput = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  addressLine1?: string;
  zip?: string;
  city?: string;
  country?: string;
  cvText?: string;
};

type PreferredLanguage = "auto" | "en";

function compactText(s: string, max = 6000) {
  const cleaned = s.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max) + "…" : cleaned;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function tryParseJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type DetectedLanguage = { code: string; name: string };

function detectLanguageFromText(text: string): DetectedLanguage {
  const raw = String(text || "");
  const tokens: string[] = raw.toLowerCase().match(/[a-z\u00c0-\u00ff]+/g) ?? [];
  if (tokens.length === 0) return { code: "en", name: "English" };
  const hasAccents = /[àâäçéèêëïîôöùûüÿœ]/i.test(raw);

  const langs: Array<{ code: string; name: string; words: Set<string> }> = [
    {
      code: "en",
      name: "English",
      words: new Set([
        "a",
        "an",
        "the",
        "and",
        "or",
        "to",
        "of",
        "in",
        "for",
        "with",
        "on",
        "at",
        "from",
        "by",
        "as",
        "be",
        "is",
        "are",
        "will",
        "this",
        "that",
        "your",
        "you",
        "we",
        "our",
        "role",
        "team",
        "experience",
        "responsibilities",
        "requirements",
        "skills",
        "work",
        "job",
        "join",
      ]),
    },
    {
      code: "fr",
      name: "French",
      words: new Set([
        "le",
        "la",
        "les",
        "des",
        "un",
        "une",
        "et",
        "de",
        "du",
        "dans",
        "pour",
        "avec",
        "vous",
        "nous",
        "poste",
        "expérience",
        "missions",
        "profil",
        "compétences",
        "travail",
      ]),
    },
    {
      code: "it",
      name: "Italian",
      words: new Set([
        "il",
        "lo",
        "la",
        "i",
        "gli",
        "le",
        "un",
        "una",
        "e",
        "di",
        "del",
        "della",
        "per",
        "con",
        "voi",
        "noi",
        "ruolo",
        "esperienza",
        "responsabilità",
        "requisiti",
      ]),
    },
    {
      code: "de",
      name: "German",
      words: new Set([
        "der",
        "die",
        "das",
        "und",
        "zu",
        "von",
        "für",
        "mit",
        "sie",
        "wir",
        "ihre",
        "rolle",
        "team",
        "erfahrung",
        "aufgaben",
        "anforderungen",
      ]),
    },
    {
      code: "es",
      name: "Spanish",
      words: new Set([
        "el",
        "la",
        "los",
        "las",
        "un",
        "una",
        "y",
        "de",
        "del",
        "para",
        "con",
        "usted",
        "nosotros",
        "puesto",
        "experiencia",
        "responsabilidades",
        "requisitos",
      ]),
    },
  ];

  const scores: Record<string, number> = {};
  for (const l of langs) scores[l.code] = 0;
  for (const t of tokens) {
    for (const l of langs) {
      if (l.words.has(t)) scores[l.code] += 1;
    }
  }
  const enScore = scores["en"] || 0;
  const frScore = scores["fr"] || 0;

  const hasEnglishSignature =
    tokens.includes("requirements") ||
    tokens.includes("responsibilities") ||
    tokens.includes("apply") ||
    tokens.includes("candidate") ||
    tokens.includes("hiring") ||
    tokens.includes("manager");
  const hasFrenchSignature =
    tokens.includes("madame") ||
    tokens.includes("monsieur") ||
    tokens.includes("poste") ||
    tokens.includes("candidature") ||
    tokens.includes("profil");
  if (hasEnglishSignature && !hasFrenchSignature) return { code: "en", name: "English" };
  if (hasFrenchSignature && !hasEnglishSignature) return { code: "fr", name: "French" };
  // Mixed-language postings: prefer English unless there are strong French signals (accents or higher French score).
  if (hasEnglishSignature && hasFrenchSignature) {
    if (!hasAccents && enScore >= frScore) return { code: "en", name: "English" };
    if (hasAccents && frScore > enScore) return { code: "fr", name: "French" };
  }

  const sorted = langs
    .map((l) => ({ ...l, score: scores[l.code] || 0 }))
    .sort((a, b) => b.score - a.score);

  const best = sorted[0];
  const second = sorted[1];

  // If we can't confidently detect, default to English.
  if (!best || best.score < 4) return { code: "en", name: "English" };
  if (second && (best.score - second.score) < 2) return { code: "en", name: "English" };
  return { code: best.code, name: best.name };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const job = (body as any).job as JobInput | undefined;
    const profile = (body as any).profile as ProfileInput | undefined;
    const candidate = (body as any).candidate as CandidateInput | undefined;
    const preferredLanguageRaw = (body as any).preferredLanguage as PreferredLanguage | undefined;
    const preferredLanguage: PreferredLanguage =
      preferredLanguageRaw === "en" || preferredLanguageRaw === "auto" ? preferredLanguageRaw : "auto";
    const customInstructions = (body as any).customInstructions as string | undefined;
    const regenerateVersion = (body as any).regenerateVersion as "long" | "short" | "very_short" | "creative" | undefined;
    const currentCoverLetter = (body as any).currentCoverLetter as string | undefined;
    const customTemplate = (body as any).customTemplate as string | undefined;
    const paragraphSettings = (body as any).paragraphSettings as Record<number, boolean> | undefined;

    if (!job?.title || !job?.company) {
      return NextResponse.json(
        { error: "Missing required job fields: title, company" },
        { status: 400 }
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const profileRoles =
      (Array.isArray(profile?.roles) ? profile?.roles : null) ??
      (typeof profile?.role === "string" ? [profile.role] : []);
    const profileAreas =
      (Array.isArray(profile?.areas) ? profile?.areas : null) ??
      (typeof profile?.area === "string" ? [profile.area] : []);

    const candidateName =
      candidate?.firstName && candidate?.lastName
        ? `${candidate.firstName} ${candidate.lastName}`.trim()
        : "";

    const todayIso = new Date().toISOString().split("T")[0];
    const languageInput = [job?.title || "", job?.description || ""].join("\n");
    const targetLang =
      preferredLanguage === "en"
        ? ({ code: "en", name: "English" } as const)
        : detectLanguageFromText(languageInput);
    
    // Use custom template if provided, otherwise use default templates
    const defaultBaseTemplate = targetLang.code === "fr" ? COVER_LETTER_TEMPLATE_FR : COVER_LETTER_TEMPLATE_EN;
    const baseTemplate = customTemplate || defaultBaseTemplate;
    const shortTemplate = targetLang.code === "fr" ? COVER_LETTER_TEMPLATE_FR_SHORT : COVER_LETTER_TEMPLATE_EN_SHORT;
    const veryShortTemplate =
      targetLang.code === "fr" ? COVER_LETTER_TEMPLATE_FR_VERY_SHORT : COVER_LETTER_TEMPLATE_EN_VERY_SHORT;
    
    // Helper to check if a text block is a "real paragraph" (not just personal info, dates, or addresses)
    const isRealParagraph = (text: string): boolean => {
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
    };

    // Parse template into paragraphs and build instructions if custom template with paragraph settings
    let paragraphInstructions = "";
    if (customTemplate && paragraphSettings && Object.keys(paragraphSettings).length > 0) {
      // Split and filter to get only real paragraphs (same logic as frontend)
      const allBlocks = customTemplate
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
      
      // Filter to keep only real paragraphs (not names, dates, addresses)
      const paragraphs = allBlocks.filter(block => isRealParagraph(block));
      
      if (paragraphs.length > 0) {
        const fixedParagraphs: number[] = [];
        const adaptableParagraphs: number[] = [];
        
        for (const [indexStr, isFixed] of Object.entries(paragraphSettings)) {
          const index = parseInt(indexStr, 10);
          // Only include if within valid range
          if (index < paragraphs.length) {
            if (isFixed) {
              fixedParagraphs.push(index + 1); // 1-indexed for readability
            } else {
              adaptableParagraphs.push(index + 1);
            }
          }
        }
        
        paragraphInstructions = [
          "",
          "PARAGRAPH INSTRUCTIONS:",
          `The template has ${paragraphs.length} content paragraphs (excluding headers, names, dates, and addresses). Follow these rules:`,
          fixedParagraphs.length > 0 
            ? `- KEEP EXACTLY AS WRITTEN (do NOT modify): Paragraph(s) ${fixedParagraphs.join(", ")}. Copy these word-for-word from the template, only replacing obvious placeholders like names, dates, company names, and job titles.`
            : "",
          adaptableParagraphs.length > 0 
            ? `- ADAPT TO THE POSITION: Paragraph(s) ${adaptableParagraphs.join(", ")}. Rewrite these to fit the specific job and candidate, while keeping the same general style and tone.`
            : "",
          "",
          "CONTENT PARAGRAPHS (for reference - these are the actual body paragraphs to control):",
          ...paragraphs.map((p, i) => `[Paragraph ${i + 1}${fixedParagraphs.includes(i + 1) ? " - KEEP AS-IS" : " - ADAPT"}]:\n${p}`),
        ].filter(Boolean).join("\n");
      }
    }
    const creativeTemplate =
      targetLang.code === "fr" ? COVER_LETTER_TEMPLATE_FR_CREATIVE : COVER_LETTER_TEMPLATE_EN_CREATIVE;

    // Generate long, short, very short and creative versions
    const generatePrompt = (template: string, mode: "long" | "short" | "very_short" | "creative", customInstructions?: string, isCustomTemplate: boolean = false) => {
      // For creative mode, completely ignore the template and create something unique
      if (mode === "creative") {
        return [
          "Write a COMPLETELY UNIQUE and DISTINCTIVE cover letter. IGNORE all standard cover letter templates and structures.",
          "",
          "CRITICAL REQUIREMENTS:",
          `- TARGET_LANGUAGE: ${targetLang.name} (code: ${targetLang.code}). Write entirely in this language.`,
          preferredLanguage === "en"
            ? "- USER CHOICE: The user requested the cover letter in English even if the job posting is in another language."
            : "- USER CHOICE: Use the job posting language (auto).",
          "- Do NOT use standard cover letter structure (no 'Dear Hiring Manager', no formal headers, no 'I am writing to apply').",
          "- Do NOT follow any template. Create your own unique structure.",
          "- Start with a HOOK: Begin with a question, a bold statement, a specific insight, a story, or a direct value proposition.",
          "- Be SMART and DIRECT: Go straight to what matters. No filler, no generic pleasantries.",
          "- Show AUTHENTIC PERSONALITY: Write like a real person having a meaningful conversation, not a robot filling a form.",
          "- Demonstrate HIGH EMPATHY: Show you understand their challenges, their needs, their perspective. Connect on a human level.",
          "- Be MEMORABLE: Use unexpected angles, specific examples, unique insights. Make them remember you.",
          "- Be CONCISE but POWERFUL: Maximum 3–4 paragraphs. Every word must earn its place.",
          "- Show INTELLIGENCE: Demonstrate strategic thinking, problem-solving, or industry insights.",
          "- AVOID ALL CLICHÉS: Never use phrases like 'I am writing to apply', 'I am excited about', 'I believe I would be a great fit', 'Thank you for your consideration', 'I am confident that', 'I would be honored'.",
          "- Structure can be UNCONVENTIONAL: You might use a story, a problem-solution approach, a direct pitch, or any creative format that works.",
          "",
          "JOB INFORMATION (use these specific details in the cover letter):",
          `Title: ${job.title}`,
          `Company: ${job.company}`,
          job.location ? `Location: ${job.location}` : "",
          job.description ? `Description: ${compactText(job.description)}` : "",
          "",
          "IMPORTANT: The cover letter MUST specifically reference the job title, company name, and key details from the job description above. Make it clear that you are applying for THIS specific position at THIS specific company.",
          "",
          "CANDIDATE INFORMATION:",
          candidateName ? `Name: ${candidateName}` : "Name: (not provided)",
          candidate?.city ? `City: ${candidate.city}` : "",
          candidate?.country ? `Country: ${candidate.country}` : "",
          "",
          "CV (raw text extract):",
          candidate?.cvText ? compactText(candidate.cvText, 9000) : "(not provided)",
          "",
          "CANDIDATE PROFILE:",
          profileRoles.length ? `Target roles: ${profileRoles.join(", ")}` : "Target roles: (not provided)",
          profileAreas.length ? `Areas: ${profileAreas.join(", ")}` : "Areas: (not provided)",
          profile?.experienceYears !== undefined
            ? `Experience: ${profile.experienceYears} years`
            : "Experience: (not provided)",
          "",
          "REMEMBER: This is NOT a standard cover letter. It's a smart, authentic, memorable communication that shows personality, empathy, and intelligence. Make it stand out completely from typical cover letters.",
        ]
          .filter(Boolean)
          .join("\n");
      }
      
      // For other modes, use the template structure
      return [
        isCustomTemplate 
          ? "Write a tailored cover letter using the USER'S CUSTOM TEMPLATE below as the basis. Follow its exact structure, style, and tone as closely as possible."
          : "Write a tailored cover letter using the TEMPLATE below as the basis (structure, style, tone).",
        "Requirements:",
        `- TARGET_LANGUAGE: ${targetLang.name} (code: ${targetLang.code}).`,
        preferredLanguage === "en"
          ? "- USER CHOICE: The user requested the cover letter in English even if the job posting is in another language."
          : "- USER CHOICE: Use the job posting language (auto).",
        "- The cover letter MUST be written entirely in TARGET_LANGUAGE. Do not mix languages.",
        isCustomTemplate
          ? "- IMPORTANT: This is a USER-PROVIDED CUSTOM TEMPLATE. Preserve its unique style, voice, and structure as much as possible. Adapt the content to match the job and candidate details, but maintain the template's distinctive character."
          : "- Use the same overall structure as the template. If the template language differs from TARGET_LANGUAGE, translate the template structure and standard phrases.",
        isCustomTemplate
          ? "- Adapt the template's format to fit the specific job, but keep its overall structure and writing style."
          : "- Keep the same overall structure as the template (header/contact block, date line, subject line, formal salutation, 3–5 short paragraphs, formal closing, signature).",
        "- Do not invent facts (companies, degrees, years). If something is missing, phrase it generically.",
        "- Do NOT mention that this letter was generated by AI.",
        "- Use the candidate details and CV text to personalize (skills, experiences, achievements).",
        "",
        isCustomTemplate ? "USER'S CUSTOM TEMPLATE (follow this structure and style closely):" : "TEMPLATE (placeholders between {{...}} must be replaced or omitted if unknown):",
        template,
        // Include paragraph-specific instructions if available (only for long version with custom template)
        isCustomTemplate && paragraphInstructions ? paragraphInstructions : "",
        "",
        "PLACEHOLDER RULES:",
        `- {{DATE}}: use ${todayIso} (or a long-form date in the target language); keep it consistent.`,
        "- {{CITY}}: use candidate city if provided, otherwise job location city, otherwise omit the city prefix entirely.",
        "- {{COMPANY_ADDRESS_LINE1}}/{{COMPANY_ZIP}}: usually unknown -> omit those lines cleanly (don't leave blank placeholder lines).",
        "- If a field is missing, remove that line entirely (no empty lines with placeholders).",
        "- {{OPENING_PARAGRAPH}} etc: write content that fits the job and candidate profile. Keep paragraphs short and specific.",
        "- {{FORMAL_CLOSING}}: use a standard formal closing line in the target language.",
        "- Translate the 'Annexes' line to the target language.",
        "",
        "JOB INFORMATION (use these specific details in the cover letter):",
        `Title: ${job.title}`,
        `Company: ${job.company}`,
        job.location ? `Location: ${job.location}` : "",
        job.url ? `URL: ${job.url}` : "",
        job.description ? `Description: ${compactText(job.description)}` : "",
        "",
        "IMPORTANT: The cover letter MUST specifically reference the job title, company name, and key details from the job description above. Make it clear that you are applying for THIS specific position at THIS specific company.",
        "",
        "CANDIDATE CONTACT DETAILS (provided by user):",
        candidateName ? `Name: ${candidateName}` : "Name: (not provided)",
        candidate?.phone ? `Phone: ${candidate.phone}` : "Phone: (not provided)",
        candidate?.addressLine1 ? `Address: ${candidate.addressLine1}` : "",
        candidate?.zip ? `ZIP: ${candidate.zip}` : "",
        candidate?.city ? `City: ${candidate.city}` : "",
        candidate?.country ? `Country: ${candidate.country}` : "",
        "",
        "CV (raw text extract):",
        candidate?.cvText ? compactText(candidate.cvText, 9000) : "(not provided)",
        "",
        "CANDIDATE PROFILE (from app settings):",
        profileRoles.length ? `Target roles: ${profileRoles.join(", ")}` : "Target roles: (not provided)",
        profileAreas.length ? `Areas: ${profileAreas.join(", ")}` : "Areas: (not provided)",
        profile?.experienceYears !== undefined
          ? `Experience: ${profile.experienceYears} years`
          : "Experience: (not provided)",
        profile?.country ? `Country: ${profile.country}` : "",
        profile?.city ? `City: ${profile.city}` : "",
        profile?.remote !== undefined ? `Remote: ${profile.remote ? "Yes" : "No"}` : "",
        "",
        mode === "very_short"
          ? "IMPORTANT: Make the letter VERY SHORT and ULTRA CONCISE. Maximum 1–2 short paragraphs and no more than about 120–150 words in total. Focus only on the single most relevant strength and motivation for this position."
          : mode === "short"
          ? "IMPORTANT: Keep it SHORT and CONCISE. Focus on the most relevant experience. Maximum 3–4 short paragraphs total."
          : "IMPORTANT: Use the CV to pick 3–6 relevant skills/experiences to mention. If the CV is missing details, keep it generic.",
      ]
        .filter(Boolean)
        .join("\n");
    };

    // Helper function to call OpenAI API
    const callOpenAI = async (prompt: string, isCreative: boolean = false): Promise<string> => {
      const requestBody = {
        model,
        temperature: isCreative ? 0.8 : 0.4, // Higher temperature for creative version
        messages: [
          {
            role: "system",
            content: isCreative
              ? "You are a creative and intelligent writer who crafts distinctive, memorable cover letters that stand out through authenticity, empathy, and smart communication. You avoid templates and clichés, writing with personality and intelligence."
              : "You are an expert career coach who writes high-quality, tailored cover letters following a provided template precisely.",
          },
          { role: "user", content: prompt },
        ],
      };

      // Basic retry for transient rate-limits (429). Quota errors won't be fixed by retries.
      let resp: Response | null = null;
      let lastErrorText = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (resp.ok) break;

        const txt = await resp.text().catch(() => "");
        lastErrorText = txt;

        // Only retry 429 (rate limits). Sleep a bit and retry.
        if (resp.status === 429 && attempt < 2) {
          const retryAfterHeader = resp.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
          const waitMs = Number.isFinite(retryAfterSeconds)
            ? Math.max(500, retryAfterSeconds * 1000)
            : 800 * (attempt + 1);
          await sleep(waitMs);
          continue;
        }

        break;
      }

      if (!resp || !resp.ok) {
        const status = resp?.status ?? 500;
        const txt = lastErrorText || (await resp?.text().catch(() => "") ?? "");
        const parsed = tryParseJson(txt);
        const message =
          parsed?.error?.message ||
          `OpenAI request failed (${status})`;

        throw new Error(message);
      }

      const data: any = await resp.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text || typeof text !== "string") {
        throw new Error("OpenAI response missing text");
      }

      return text.trim();
    };

    // Normal generation - all versions
    // Long version uses custom template if provided
    const longPrompt = generatePrompt(baseTemplate, "long", customInstructions, !!customTemplate);
    const shortPrompt = generatePrompt(shortTemplate, "short", customInstructions, false);
    const veryShortPrompt = generatePrompt(veryShortTemplate, "very_short", customInstructions, false);
    // Creative version doesn't use a template - it creates something completely unique
    const creativePrompt = generatePrompt("", "creative", customInstructions, false);

    // Generate all versions in parallel
    try {
      const [longVersion, shortVersion, veryShortVersion, creativeVersion] = await Promise.all([
        callOpenAI(longPrompt, false),
        callOpenAI(shortPrompt, false),
        callOpenAI(veryShortPrompt, false),
        callOpenAI(creativePrompt, true), // Creative version uses higher temperature
      ]);

      return NextResponse.json({ 
        coverLetter: longVersion,
        coverLetterShort: shortVersion,
        coverLetterVeryShort: veryShortVersion,
        coverLetterCreative: creativeVersion
      });
    } catch (e: any) {
      // If one fails, try to generate at least a long version
      try {
        const longVersion = await callOpenAI(longPrompt);
        return NextResponse.json({ 
          coverLetter: longVersion,
          coverLetterShort: null,
          coverLetterVeryShort: null,
          coverLetterCreative: null,
          error: "Some versions failed to generate, but long version is available"
        });
      } catch (e2: any) {
        return NextResponse.json(
          { 
            error: e?.message || e2?.message || "Cover letter generation failed",
            status: 500
          },
          { status: 500 }
        );
      }
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Cover letter generation failed" },
      { status: 500 }
    );
  }
}

