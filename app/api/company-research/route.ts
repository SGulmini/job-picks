import { NextRequest, NextResponse } from "next/server";

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
    const language = ((body as any).language as string) || "en";

    if (!companyName || companyName.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required field: companyName" },
        { status: 400 }
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const langInstruction =
      language === "en"
        ? "Write entirely in English."
        : `Write entirely in the language with code "${language}". If unsure, write in English.`;

    const prompt = [
      `Provide a comprehensive deep-dive research report about the company "${companyName.trim()}".`,
      "",
      `${langInstruction}`,
      "",
      "Structure the report with the following sections. Use clear headings with markdown formatting (##). Be thorough and specific — include concrete details, numbers, and facts where possible.",
      "",
      "## 🏢 Company Overview",
      "- Full official name, founding year, founders",
      "- Headquarters location and global office presence",
      "- Industry and sector classification",
      "- Company type (public/private, ticker symbol if public)",
      "- Mission statement or core purpose",
      "",
      "## 📊 Key Figures & Financials",
      "- Revenue (latest available), revenue growth trend",
      "- Number of employees (approximate current count)",
      "- Valuation or market cap if available",
      "- Major funding rounds (for startups) or key financial milestones",
      "- Profitability status",
      "",
      "## 🎯 Products & Services",
      "- Main products/services/platforms",
      "- Target customers and market segments",
      "- Key differentiators vs competitors",
      "- Recent product launches or major updates",
      "",
      "## 🏗️ Business Model",
      "- Revenue model (SaaS, marketplace, advertising, etc.)",
      "- Pricing strategy (if known)",
      "- Key partnerships and distribution channels",
      "",
      "## 🌍 Market Position & Competition",
      "- Market share or ranking in their industry",
      "- Main competitors and how they compare",
      "- Competitive advantages (moat)",
      "- Industry trends affecting the company",
      "",
      "## 🧑‍💼 Leadership & Culture",
      "- CEO and key executives",
      "- Company culture and values",
      "- Notable workplace awards or recognitions",
      "- Employee reviews summary (Glassdoor sentiment if known)",
      "- Work-life balance reputation",
      "",
      "## 📈 Growth & Strategy",
      "- Recent acquisitions or mergers",
      "- Expansion plans (geographic, product, etc.)",
      "- Strategic priorities and roadmap (if public)",
      "- R&D focus areas",
      "",
      "## 🔥 Recent News & Developments",
      "- Major recent announcements (last 12 months)",
      "- Controversies or challenges (if any)",
      "- Notable achievements or awards",
      "",
      "## 💼 What It's Like to Work There",
      "- Typical tech stack (for tech companies)",
      "- Interview process and difficulty",
      "- Salary ranges and benefits (general overview)",
      "- Career growth opportunities",
      "- Remote work policy",
      "",
      "## ⚡ Quick Summary",
      "- 3-5 bullet points summarizing the most important things a job candidate should know about this company",
      "",
      "IMPORTANT RULES:",
      "- Be factual and objective. Clearly indicate when information is estimated or uncertain.",
      "- If you don't have reliable information about a specific point, say so briefly rather than making things up.",
      "- Focus on information that would be most useful for someone considering working at or doing business with this company.",
      "- Use specific numbers and dates wherever possible.",
      "- Keep the tone professional but readable.",
    ].join("\n");

    const requestBody = {
      model,
      temperature: 0.3,
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content:
            "You are an expert business analyst and career researcher. You provide thorough, well-structured company research reports with accurate, up-to-date information. Format your response in clean markdown.",
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
      const txt =
        lastErrorText || ((await resp?.text().catch(() => "")) ?? "");
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

    return NextResponse.json({ report: text.trim() });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Company research failed" },
      { status: 500 }
    );
  }
}
