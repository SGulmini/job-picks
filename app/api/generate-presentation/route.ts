import { NextRequest, NextResponse } from "next/server";

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

    const { cvText, firstName, lastName, city, country } = body;

    if (!cvText || typeof cvText !== "string" || cvText.trim().length < 50) {
      return NextResponse.json(
        { error: "CV text is required and must be substantial" },
        { status: 400 }
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const candidateName = firstName && lastName 
      ? `${firstName} ${lastName}`.trim() 
      : "";

    // Compact CV text to avoid token limits
    const compactCv = cvText.length > 8000 
      ? cvText.slice(0, 8000) + "..." 
      : cvText;

    const prompt = `Write a SHORT, generic professional presentation letter based on the CV below.

REQUIREMENTS:
- The letter should be 3-4 short paragraphs MAX (around 150-200 words total)
- It should be a general "about me" introduction, NOT targeted at any specific job
- Write in the SAME LANGUAGE as the CV (if CV is in French, write in French; if in English, write in English, etc.)
- Structure:
  1. Opening: Brief introduction with name and current professional status
  2. Core expertise: Key skills and areas of expertise (2-3 sentences)
  3. Highlights: Most notable achievements or experiences (2-3 sentences)
  4. Closing: What the candidate brings to the table / professional value proposition
- Tone: Professional but personable, confident but not arrogant
- Do NOT use clichés like "I am a highly motivated professional" or "I am passionate about..."
- Do NOT include placeholders, dates to fill in, or addresses
- Make it ready to use as-is

${candidateName ? `CANDIDATE NAME: ${candidateName}` : ""}
${city ? `CITY: ${city}` : ""}
${country ? `COUNTRY: ${country}` : ""}

CV TEXT:
${compactCv}

Write the presentation letter now:`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content: "You are an expert career coach who writes concise, impactful professional presentations. You extract the essence of a CV and present it in a compelling, authentic way.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("OpenAI API error:", response.status, errorText);
      return NextResponse.json(
        { error: `OpenAI API error (${response.status})` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const presentationLetter = data?.choices?.[0]?.message?.content?.trim();

    if (!presentationLetter) {
      return NextResponse.json(
        { error: "No presentation letter generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({ presentationLetter });
  } catch (e: any) {
    console.error("Error generating presentation letter:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to generate presentation letter" },
      { status: 500 }
    );
  }
}
