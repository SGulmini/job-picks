"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronLeft,
  Copy,
  Download,
  Loader2,
  Search,
  Sparkles,
  Briefcase,
} from "lucide-react";

const CACHE_KEY = "jobPicks_companyResearch_v1";

type CachedResearch = Record<
  string,
  {
    report: string;
    createdAt: string;
  }
>;

function readCache(): CachedResearch {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: CachedResearch) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

function CompanyResearchInner() {
  const [companyName, setCompanyName] = useState("");
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches from cache on mount
  useEffect(() => {
    const cache = readCache();
    const names = Object.keys(cache).sort(
      (a, b) =>
        new Date(cache[b].createdAt).getTime() -
        new Date(cache[a].createdAt).getTime()
    );
    setRecentSearches(names.slice(0, 10));
  }, []);

  const onSearch = useCallback(
    async (name?: string) => {
      const searchName = (name || companyName).trim();
      if (!searchName) return;

      // Check cache first
      const cache = readCache();
      const cacheKey = searchName.toLowerCase();
      if (cache[cacheKey]) {
        setReport(cache[cacheKey].report);
        setCompanyName(searchName);
        // Move to top of recent searches
        setRecentSearches((prev) => {
          const filtered = prev.filter((n) => n.toLowerCase() !== cacheKey);
          return [searchName, ...filtered].slice(0, 10);
        });
        return;
      }

      setLoading(true);
      setError("");
      setReport("");

      try {
        const res = await fetch("/api/company-research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName: searchName }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Research failed");
        }

        if (data.report) {
          setReport(data.report);

          // Save to cache
          const updatedCache = readCache();
          updatedCache[cacheKey] = {
            report: data.report,
            createdAt: new Date().toISOString(),
          };
          writeCache(updatedCache);

          // Update recent searches
          setRecentSearches((prev) => {
            const filtered = prev.filter((n) => n.toLowerCase() !== cacheKey);
            return [searchName, ...filtered].slice(0, 10);
          });
        }
      } catch (e: any) {
        setError(e?.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [companyName]
  );

  const onCopy = useCallback(async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [report]);

  const onDownload = useCallback(() => {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Company Research - ${companyName.trim() || "Report"}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [report, companyName]);

  const onClearCache = useCallback((name: string) => {
    const cache = readCache();
    const cacheKey = name.toLowerCase();
    delete cache[cacheKey];
    writeCache(cache);
    setRecentSearches((prev) => prev.filter((n) => n.toLowerCase() !== cacheKey));
  }, []);

  // Simple markdown to HTML renderer
  const renderMarkdown = useCallback((text: string) => {
    const lines = text.split("\n");
    const html: string[] = [];
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("## ")) {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
        html.push(
          `<h2 class="text-lg font-bold mt-6 mb-3" style="color: var(--foreground)">${trimmed.slice(3)}</h2>`
        );
      } else if (trimmed.startsWith("### ")) {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
        html.push(
          `<h3 class="text-base font-semibold mt-4 mb-2" style="color: var(--foreground)">${trimmed.slice(4)}</h3>`
        );
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        if (!inList) {
          html.push('<ul class="space-y-1.5 mb-3">');
          inList = true;
        }
        const content = trimmed.slice(2).replace(
          /\*\*(.*?)\*\*/g,
          '<strong style="color: var(--foreground)">$1</strong>'
        );
        html.push(
          `<li class="flex gap-2 text-sm leading-relaxed" style="color: var(--muted-foreground)"><span style="color: var(--primary)">•</span><span>${content}</span></li>`
        );
      } else if (trimmed === "") {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
        html.push("<br />");
      } else {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
        const content = trimmed.replace(
          /\*\*(.*?)\*\*/g,
          '<strong style="color: var(--foreground)">$1</strong>'
        );
        html.push(
          `<p class="text-sm leading-relaxed mb-2" style="color: var(--muted-foreground)">${content}</p>`
        );
      }
    }

    if (inList) html.push("</ul>");

    return html.join("\n");
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b px-4 py-4"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/home"
              className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: "var(--muted-foreground)" }}
            >
              <ChevronLeft className="h-4 w-4" />
              Back to picks
            </Link>
            <div
              className="h-6 w-px"
              style={{ background: "var(--border)" }}
            />
            <h1
              className="flex items-center gap-2 text-lg font-bold"
              style={{ color: "var(--foreground)" }}
            >
              <Building2
                className="h-5 w-5"
                style={{ color: "var(--primary)" }}
              />
              Company Research
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Search Section */}
        <div
          className="rounded-2xl border p-6 mb-6"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
              <Search className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2
                className="text-base font-bold"
                style={{ color: "var(--foreground)" }}
              >
                Deep Company Research
              </h2>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Enter a company name to get a comprehensive AI-powered analysis
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Building2
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: "var(--muted-foreground)" }}
              />
              <input
                type="text"
                placeholder="e.g. Google, Stripe, SpaceX..."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) onSearch();
                }}
                className="w-full rounded-xl border pl-10 pr-4 py-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-purple-500/30"
                style={{
                  background: "var(--secondary)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
            <button
              onClick={() => onSearch()}
              disabled={loading || !companyName.trim()}
              className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 gradient-primary"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? "Researching..." : "Research"}
            </button>
          </div>
        </div>

        {/* Recent Searches */}
        {recentSearches.length > 0 && !report && !loading && (
          <div
            className="rounded-2xl border p-6 mb-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--foreground)" }}
            >
              Recent searches
            </h3>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer hover:opacity-80 group"
                  style={{
                    background: "var(--secondary)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span
                    onClick={() => {
                      setCompanyName(name);
                      onSearch(name);
                    }}
                  >
                    {name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearCache(name);
                    }}
                    className="ml-1 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                    style={{ color: "var(--muted-foreground)" }}
                    title="Remove from cache"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div
            className="rounded-2xl border p-12 text-center"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary animate-pulse">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <p
                  className="text-base font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  Researching {companyName.trim()}...
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  This may take 10–20 seconds for a thorough analysis
                </p>
              </div>
              <Loader2
                className="h-6 w-6 animate-spin"
                style={{ color: "var(--primary)" }}
              />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 mb-6">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Report */}
        {report && !loading && (
          <div
            className="rounded-2xl border"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            {/* Report Header */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <h2
                  className="text-base font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  {companyName.trim()}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onCopy}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    border: "1px solid var(--border)",
                    background: copied ? "rgba(34, 197, 94, 0.15)" : "transparent",
                    color: copied ? "#22c55e" : "var(--foreground)",
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={onDownload}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 gradient-primary"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download .md
                </button>
                <button
                  onClick={() => {
                    // Force re-research (clear cache for this company)
                    const cache = readCache();
                    delete cache[companyName.trim().toLowerCase()];
                    writeCache(cache);
                    onSearch();
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Report Body */}
            <div
              className="px-6 py-6 prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
            />
          </div>
        )}

        {/* Empty State */}
        {!report && !loading && !error && recentSearches.length === 0 && (
          <div
            className="rounded-2xl border p-12 text-center"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex flex-col items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: "var(--secondary)" }}
              >
                <Building2
                  className="h-8 w-8"
                  style={{ color: "var(--muted-foreground)" }}
                />
              </div>
              <div>
                <p
                  className="text-base font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  Ready to research
                </p>
                <p
                  className="text-sm mt-1 max-w-md"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Enter any company name above to get a comprehensive report
                  including financials, culture, leadership, market position, and
                  what it&apos;s like to work there.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CompanyResearchPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex h-screen items-center justify-center"
          style={{ background: "var(--background)" }}
        >
          <Loader2
            className="h-8 w-8 animate-spin"
            style={{ color: "var(--primary)" }}
          />
        </div>
      }
    >
      <CompanyResearchInner />
    </Suspense>
  );
}
