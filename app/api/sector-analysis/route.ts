import { NextRequest, NextResponse } from "next/server";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type SectorCompany = {
  name: string;
  headquarters?: string;
  offices: string[];
  website?: string;
  careersUrl?: string;
};

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

    const sector = (body as any).sector as string | undefined;
    const country = (body as any).country as string | undefined;
    const city = (body as any).city as string | undefined;

    if (!sector || sector.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required field: sector" },
        { status: 400 }
      );
    }
    if (!country || country.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required field: country" },
        { status: 400 }
      );
    }

    const locationDesc = city
      ? `${city}, ${country}`
      : country;

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const prompt = [
      `Generate a list of companies in the sector "${sector.trim()}" that have offices or headquarters in ${locationDesc}.`,
      "",
      "The goal is to help job seekers find companies for spontaneous job applications (candidature spontanee).",
      "",
      "For each company provide:",
      "- name: official company name",
      "- headquarters: main HQ location (city, country)",
      "- offices: array of office locations in the specified area (include city and country for each)",
      "- website: company website URL if known",
      "- careersUrl: careers/jobs page URL if known",
      "",
      "Return a valid JSON object with a single key 'companies' containing an array of objects. Include 15-25 relevant companies. Focus on real, established companies with actual presence in the area.",
      "If the city is specified, prioritize companies with offices in that city. Otherwise include companies with offices anywhere in the country.",
      "",
      "Example format:",
      '{"companies":[{"name":"Company A","headquarters":"Milan, Italy","offices":["Rome, Italy","Milan, Italy"],"website":"https://companya.com","careersUrl":"https://companya.com/careers"}]}',
    ].join("\n");

    const requestBody = {
      model,
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert business researcher. Return only valid JSON. No markdown, no code blocks, no extra text.",
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

    let parsed: { companies?: SectorCompany[] };
    try {
      parsed = JSON.parse(text) as { companies?: SectorCompany[] };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from AI" },
        { status: 500 }
      );
    }

    const companies = Array.isArray(parsed.companies)
      ? parsed.companies
      : Array.isArray(parsed)
        ? parsed
        : [];

    const normalized = companies.map((c: any) => ({
      name: String(c?.name ?? "").trim() || "Unknown",
      headquarters: c?.headquarters ? String(c.headquarters).trim() : undefined,
      offices: Array.isArray(c?.offices)
        ? c.offices.filter((o: any) => o).map((o: any) => String(o).trim())
        : [],
      website: c?.website ? String(c.website).trim() : undefined,
      careersUrl: c?.careersUrl ? String(c.careersUrl).trim() : undefined,
    })).filter((c) => c.name && c.name !== "Unknown");

    return NextResponse.json({ companies: normalized });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Sector analysis failed" },
      { status: 500 }
    );
  }
}
