import { NextRequest, NextResponse } from "next/server";

function compactText(s: string, max = 6000) {
  const cleaned = s.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max) + "…" : cleaned;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

    const companyName = (body as any).companyName as string | undefined;
    const sector = (body as any).sector as string | undefined;
    const country = (body as any).country as string | undefined;
    const city = (body as any).city as string | undefined;
    const headquarters = (body as any).headquarters as string | undefined;
    const website = (body as any).website as string | undefined;
    const profile = (body as any).profile as any;
    const candidate = (body as any).candidate as any;
    const preferredLanguage = ((body as any).preferredLanguage as string) || "en";
    const customInstructions = (body as any).customInstructions as string | undefined;
    const previousLetter = (body as any).previousLetter as string | undefined;
    const refreshParagraph = (body as any).refreshParagraph as
      | { index: number; currentText: string; fullLetter: string }
      | undefined;

    if (!companyName || companyName.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required field: companyName" },
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

    const langInstruction =
      preferredLanguage === "en"
        ? "Write the letter entirely in English."
        : `Write the letter in the language most appropriate for the country "${country || ""}". If unsure, write in English.`;

    // ── PARAGRAPH REFRESH MODE ──
    // If refreshParagraph is provided, only regenerate that one paragraph.
    if (refreshParagraph && typeof refreshParagraph.index === "number" && refreshParagraph.fullLetter) {
      const paragraphs = refreshParagraph.fullLetter.split(/\n\s*\n/);
      const idx = refreshParagraph.index;
      const currentParagraph = paragraphs[idx] || refreshParagraph.currentText;

      const paraPrompt = [
        "Rewrite ONLY the following paragraph from a spontaneous application letter.",
        "",
        `Language: ${langInstruction}`,
        "",
        "RULES:",
        "- Keep the same role in the letter (if it's the opening, keep it as an opening, etc.).",
        "- Keep roughly the same length (within 25%).",
        "- IMPORTANT: Do NOT just swap adjectives or synonyms. You MUST change the STRUCTURE of the paragraph:",
        "  * Rearrange sentence order. Lead with a different idea.",
        "  * Change how sentences begin (if the original starts with 'I...', try starting with a context, a result, or a when-clause).",
        "  * Merge two short sentences into one, or split a long one into two.",
        "  * Try a different rhetorical approach: if the original lists things, try a narrative flow; if it tells a story, try a concise direct statement.",
        "  * Vary sentence length: mix short punchy sentences with longer ones.",
        "- The core message and key facts must stay the same, but the way they are presented should feel noticeably different.",
        "- No em-dashes, no double hyphens, no semicolons.",
        "- No cliches, no AI-sounding phrases. Write like a real person.",
        "- Do NOT use: 'I am writing to', 'I am passionate about', 'proven track record', 'leverage', 'synergy', 'dynamic', 'thrilled', 'excited about the possibility'.",
        "- Use active voice. Specific verbs. Simple words.",
        "",
        "CONTEXT (the full letter, for reference):",
        refreshParagraph.fullLetter,
        "",
        `PARAGRAPH TO REWRITE (paragraph #${idx + 1}):`,
        currentParagraph,
        "",
        "Return ONLY the rewritten paragraph. Nothing else. No quotes, no labels, no explanation.",
      ].join("\n");

      const paraRequestBody = {
        model,
        temperature: 0.9,
        max_tokens: 500,
        frequency_penalty: 0.4,
        presence_penalty: 0.2,
        messages: [
          {
            role: "system",
            content: "You rewrite one paragraph at a time. You match the voice and tone of the surrounding letter. You write like a human, never like an AI.",
          },
          { role: "user", content: paraPrompt },
        ],
      };

      const paraResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paraRequestBody),
      });

      if (!paraResp.ok) {
        const txt = await paraResp.text().catch(() => "");
        let parsed: any = null;
        try { parsed = JSON.parse(txt); } catch {}
        return NextResponse.json(
          { error: parsed?.error?.message || `OpenAI request failed (${paraResp.status})` },
          { status: paraResp.status }
        );
      }

      const paraData: any = await paraResp.json();
      const newParagraph = paraData?.choices?.[0]?.message?.content?.trim();
      if (!newParagraph) {
        return NextResponse.json({ error: "Empty paragraph received" }, { status: 500 });
      }

      return NextResponse.json({ paragraph: newParagraph });
    }

    const prompt = [
      "Write a spontaneous application letter. This is a candidatura spontanea: no open role exists. The candidate is proactively contacting this company.",
      "",
      `LANGUAGE: ${langInstruction}`,
      "",
      // ── STYLE ──
      "STYLE REQUIREMENTS (anti-AI, human-like):",
      "Write like a sharp, experienced professional: concrete, specific, calm confidence.",
      "Avoid generic enthusiasm and corporate cliches (e.g., 'I'm thrilled', 'dynamic team', 'fast-paced environment', 'passionate', 'synergy', 'innovative solutions', 'cutting-edge', 'proven track record', 'leverage my skills').",
      "Avoid flattery. Do not 'sell the company'. Focus on fit and value.",
      "Vary sentence length naturally. Use simple words when possible.",
      "Prefer active voice and specific verbs (built, led, designed, shipped, improved, reduced, grew, launched, restructured).",
      "No over-explaining, no motivational speech, no exaggerated claims.",
      "No em-dashes, no double hyphens (--), no semicolons. Use commas and periods. Restructure if needed.",
      "No bullet points unless the user explicitly asks for them.",
      "Keep it office-ready: no slang, no emojis.",
      "",
      "BLACKLISTED (using ANY of these = rejection):",
      "'I am writing to', 'I am reaching out', 'I was excited to', 'I am passionate about',",
      "'I am confident that', 'I believe I would be a great fit', 'Thank you for your consideration',",
      "'I would welcome the opportunity', 'I am eager to', 'your esteemed company',",
      "'dynamic environment', 'thriving', 'spearheaded', 'robust', 'strategically',",
      "'delighted', 'thrilled', 'humbled', 'deeply', 'truly', 'incredibly', 'significantly',",
      "'align with my values', 'resonate with me', 'aligns perfectly', 'excited about the possibility'.",
      "",
      // ── CONTENT STRUCTURE ──
      "CONTENT REQUIREMENTS:",
      "",
      "1) OPENING (2-3 sentences):",
      "   Direct reason for writing. Tight positioning: who you are + what you bring.",
      "   One company-specific hook that proves you know what they do (a product, a market move, a sector challenge).",
      "   Do NOT assume an open role. Propose relevant areas where you could contribute and ask for a conversation.",
      "",
      "2) EVIDENCE (1-2 paragraphs):",
      "   Pick 2-3 achievements MOST relevant to what this company likely needs.",
      "   Each achievement must follow: context (what was the situation) -> action (what you did) -> measurable outcome or clear business impact.",
      "   Tie achievements to the company's sector and probable challenges.",
      "   Never claim experience with a tool, platform, or employer unless it appears in the CV below.",
      "",
      "3) 'HOW I WORK' (short, 2-3 sentences):",
      "   Show your approach: how you think about problems, how you work with stakeholders, how you make decisions.",
      "   No buzzwords. Concrete examples or principles.",
      "",
      "4) CLOSING (1-2 sentences):",
      "   Simple call to action + availability. Professional sign-off.",
      "   No ceremony, no begging, no over-thanking. Just: here's what I suggest as a next step.",
      "",
      "TAILORING LOGIC:",
      "Mirror the company's likely priorities based on their sector and geography.",
      "If the company operates in a privacy-first or measurement-limited context, show you understand those constraints.",
      "Use tools and methods from the CV that match the company's probable stack. Never invent tools or employers.",
      "",
      // ── COMPANY ──
      "COMPANY:",
      `Name: ${companyName.trim()}`,
      sector ? `Sector: ${sector}` : "",
      headquarters ? `HQ: ${headquarters}` : "",
      country ? `Country: ${country}` : "",
      city ? `City: ${city}` : "",
      website ? `Website: ${website}` : "",
      "",
      "Infer what this company cares about from sector, geography, and size. What problems are they solving? What kind of person thrives there? Use this to tailor the letter, but don't over-speculate.",
      "",
      // ── CANDIDATE ──
      "CANDIDATE:",
      candidateName ? `Name: ${candidateName}` : "",
      candidate?.phone ? `Phone: ${candidate.phone}` : "",
      candidate?.addressLine1 ? `Address: ${candidate.addressLine1}` : "",
      candidate?.zip && candidate?.city ? `${candidate.zip} ${candidate.city}` : (candidate?.city || ""),
      candidate?.country ? `Country: ${candidate.country}` : "",
      "",
      profileRoles.length ? `Target roles: ${profileRoles.join(", ")}` : "",
      profileAreas.length ? `Background: ${profileAreas.join(", ")}` : "",
      profile?.experienceYears !== undefined ? `Experience: ~${profile.experienceYears} years` : "",
      "",
      "CV (ONLY source of facts. Do NOT invent anything not present here):",
      candidate?.cvText ? compactText(candidate.cvText, 9000) : "(no CV provided. Keep the letter general but company-specific.)",
      "",
      // ── FORMAT ──
      "FORMAT:",
      "Contact header (only what's provided), date, subject line, salutation ('Dear Recruiting Team' or equivalent), body, sign-off, name.",
      "Max ~350 words for the body (excluding header/signature).",
      "",
      // ── QUALITY CHECK ──
      "QUALITY CHECK (do this before finalizing):",
      "Remove any sentence that could apply to any company. If it's generic, cut it.",
      "Ensure at least two company-specific or sector-specific references.",
      "Ensure tone is confident but not arrogant.",
      "Ensure no repeated phrases and no 'AI cadence' (that rhythm where every sentence has the same structure).",
      "Read it out loud in your head. If it sounds like a template, rewrite.",
      "",
      // Enhance mode
      ...(customInstructions && previousLetter ? [
        "ENHANCEMENT REQUEST:",
        "The user already received a version of this letter and wants it improved.",
        "",
        `User's feedback: ${customInstructions}`,
        "",
        "Previous letter to revise:",
        previousLetter,
        "",
        "Rewrite incorporating the feedback. Keep what works, fix what was asked. Follow all rules above.",
        "",
      ] : customInstructions ? [
        "ADDITIONAL USER INSTRUCTIONS:",
        customInstructions,
        "Incorporate this while following all rules above.",
        "",
      ] : []),
      "Return ONLY the letter. Nothing else.",
    ]
      .filter(Boolean)
      .join("\n");

    const requestBody = {
      model,
      temperature: 0.8,
      max_tokens: 2000,
      frequency_penalty: 0.35,
      presence_penalty: 0.15,
      messages: [
        {
          role: "system",
          content: [
            "You are the candidate writing this letter yourself.",
            "You write like a senior professional who communicates clearly: direct, specific, no fluff.",
            "You use simple words. You prefer short sentences but mix in longer ones when the thought requires it.",
            "You never sound like a language model. No generic enthusiasm. No corporate poetry.",
            "Every sentence must earn its place. If it could appear in any cover letter for any company, delete it.",
            "You show confidence through specificity, not through adjectives.",
          ].join(" "),
        },
        { role: "user", content: prompt },
      ],
    };

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

      if (resp.status === 429 && attempt < 2) {
        const retryAfterHeader = resp.headers.get("retry-after");
        const retryAfterSeconds = retryAfterHeader
          ? parseInt(retryAfterHeader, 10)
          : NaN;
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
      let parsed: any = null;
      try {
        parsed = JSON.parse(txt);
      } catch {}
      const message =
        parsed?.error?.message || `OpenAI request failed (${status})`;
      return NextResponse.json({ error: message }, { status });
    }

    const data: any = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "OpenAI response missing text" },
        { status: 500 }
      );
    }

    return NextResponse.json({ letter: text.trim() });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Spontaneous letter generation failed" },
      { status: 500 }
    );
  }
}
