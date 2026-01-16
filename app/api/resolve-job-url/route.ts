import { NextRequest, NextResponse } from "next/server";

/**
 * API route to resolve Adzuna redirect URLs to the final destination
 * This allows us to bypass Adzuna's tracking redirect and go directly to the job posting
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirectUrl = searchParams.get("url");

  if (!redirectUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    // Follow the redirect chain to get the final URL
    // Use HEAD request to avoid downloading the full page
    const response = await fetch(redirectUrl, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobPicks/1.0)",
      },
    });

    // Get the final URL after all redirects
    const finalUrl = response.url || redirectUrl;

    // If the final URL still contains adzuna.com, it means Adzuna doesn't redirect
    // In that case, we can't bypass it, so return the original redirect_url
    if (finalUrl.includes("adzuna.com") || finalUrl.includes("adzuna.co.uk")) {
      return NextResponse.json({ 
        url: redirectUrl, 
        isAdzunaRedirect: true,
        message: "Adzuna redirect cannot be bypassed" 
      });
    }

    return NextResponse.json({ 
      url: finalUrl,
      isAdzunaRedirect: false 
    });
  } catch (error: any) {
    console.error("[ResolveJobURL] Error resolving redirect:", error);
    // If resolving fails, return the original URL
    return NextResponse.json({ 
      url: redirectUrl,
      error: error.message 
    });
  }
}
