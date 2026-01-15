import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ExtractedJob = {
  url: string;
  title: string;
  company: string;
  location: string;
  description: string;
};

function cleanText(s: string) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function stripHtml(html: string) {
  return cleanText(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function clamp(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max).trim();
}

function pickFirstNonEmpty(...vals: Array<string | undefined | null>) {
  for (const v of vals) {
    const c = cleanText(v || "");
    if (c) return c;
  }
  return "";
}

function safeJsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function findJobPostingInJsonLd(json: any): any | null {
  if (!json) return null;
  if (Array.isArray(json)) {
    for (const item of json) {
      const found = findJobPostingInJsonLd(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof json !== "object") return null;

  // Some sites wrap in @graph
  if (Array.isArray((json as any)["@graph"])) {
    for (const node of (json as any)["@graph"]) {
      const found = findJobPostingInJsonLd(node);
      if (found) return found;
    }
  }

  const t = (json as any)["@type"];
  const types = Array.isArray(t) ? t : t ? [t] : [];
  const isJobPosting = types.some((x: any) => String(x).toLowerCase() === "jobposting");
  if (isJobPosting) return json;
  return null;
}

function extractLocationFromJobPosting(jp: any): string {
  const jl = jp?.jobLocation;
  const first = Array.isArray(jl) ? jl[0] : jl;
  const addr = first?.address;
  const locality = addr?.addressLocality;
  const region = addr?.addressRegion;
  const country = addr?.addressCountry;
  const parts = [locality, region, country].map((x) => cleanText(x)).filter(Boolean);
  return parts.join(", ");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = String(body?.url || "").trim();
    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Invalid url (must start with http:// or https://)" }, { status: 400 });
    }

    // Fetch the page HTML (best effort; some sites may block bot traffic)
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch the link (HTTP ${res.status}). The website may block automated access.` },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return NextResponse.json(
        { error: "The provided link did not return an HTML page we can parse." },
        { status: 400 }
      );
    }

    const html = await res.text();

    // Dynamic imports keep the main server bundle leaner and avoid ESM/CJS edge cases.
    const { JSDOM } = await import("jsdom");
    const { Readability } = await import("@mozilla/readability");

    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // 1) Try JSON-LD JobPosting (often best structured signal)
    let jsonLdJob: any | null = null;
    const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    for (const s of scripts) {
      const raw = s.textContent || "";
      const parsed = safeJsonParse(raw);
      const found = findJobPostingInJsonLd(parsed);
      if (found) {
        jsonLdJob = found;
        break;
      }
    }

    const jsonLdTitle = cleanText(jsonLdJob?.title);
    const jsonLdCompany = cleanText(
      jsonLdJob?.hiringOrganization?.name ||
        jsonLdJob?.hiringOrganization?.legalName ||
        jsonLdJob?.employmentUnit?.name
    );
    const jsonLdLocation = extractLocationFromJobPosting(jsonLdJob);
    const jsonLdDescription = cleanText(stripHtml(jsonLdJob?.description || ""));

    // 2) Readability article extraction as fallback/augment
    let readableTitle = "";
    let readableText = "";
    try {
      const article = new Readability(doc).parse();
      if (article) {
        readableTitle = cleanText(article.title || "");
        readableText = cleanText(stripHtml(article.content || "")) || cleanText(article.textContent || "");
      }
    } catch {
      // ignore
    }

    // 3) Meta fallbacks
    const ogTitle = cleanText(doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || "");
    const metaTitle = cleanText(doc.querySelector('meta[name="title"]')?.getAttribute("content") || "");
    const titleTag = cleanText(doc.querySelector("title")?.textContent || "");
    const metaDescription = cleanText(doc.querySelector('meta[name="description"]')?.getAttribute("content") || "");
    const ogSiteName = cleanText(doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content") || "");

    const title = pickFirstNonEmpty(jsonLdTitle, readableTitle, ogTitle, metaTitle, titleTag);
    const company = pickFirstNonEmpty(jsonLdCompany, ogSiteName);
    const location = pickFirstNonEmpty(jsonLdLocation);

    // Prefer structured/Readability description; otherwise fall back to meta description
    const description = pickFirstNonEmpty(jsonLdDescription, readableText, metaDescription);
    const cleanedDescription = clamp(description, 12000);

    if (!cleanedDescription || cleanedDescription.length < 200) {
      return NextResponse.json(
        {
          error:
            "We couldn't extract a usable job description from this link (the website may block scraping or load content dynamically). Try a different link.",
        },
        { status: 422 }
      );
    }

    const out: ExtractedJob = {
      url,
      title: title || "Job opportunity",
      company: company || "Company",
      location: location || "",
      description: cleanedDescription,
    };

    return NextResponse.json({ job: out });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to extract job details from link" },
      { status: 500 }
    );
  }
}

