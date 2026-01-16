import { NextRequest, NextResponse } from "next/server";
import { createRequire } from "module";
// Statically import pdfjs-dist so Next.js includes it in serverless bundle
// pdf-parse will be imported dynamically when needed

export const runtime = "nodejs";

// Create require function for CommonJS modules in ESM context
const require = createRequire(import.meta.url);

// Setup DOMMatrix polyfill for serverless environments (needed by pdf-parse/pdfjs-dist)
// This must be done at module level before any PDF parsing
(function setupDOMMatrixPolyfill() {
  const g: any = globalThis as any;
  if (g.DOMMatrix) return;

  class DOMMatrixPolyfill {
    a: number; b: number; c: number; d: number; e: number; f: number;
    is2D = true;

    constructor(init?: any) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      if (!init) return;

      if (Array.isArray(init) || ArrayBuffer.isView(init)) {
        const arr = Array.from(init as any);
        if (arr.length >= 6) {
          this.a = Number(arr[0]) || 1;
          this.b = Number(arr[1]) || 0;
          this.c = Number(arr[2]) || 0;
          this.d = Number(arr[3]) || 1;
          this.e = Number(arr[4]) || 0;
          this.f = Number(arr[5]) || 0;
        }
        return;
      }

      if (typeof init === "object") {
        this.a = Number(init.a ?? this.a);
        this.b = Number(init.b ?? this.b);
        this.c = Number(init.c ?? this.c);
        this.d = Number(init.d ?? this.d);
        this.e = Number(init.e ?? this.e);
        this.f = Number(init.f ?? this.f);
      }
    }

    private _mul(o: DOMMatrixPolyfill) {
      const a = this.a * o.a + this.c * o.b;
      const b = this.b * o.a + this.d * o.b;
      const c = this.a * o.c + this.c * o.d;
      const d = this.b * o.c + this.d * o.d;
      const e = this.a * o.e + this.c * o.f + this.e;
      const f = this.b * o.e + this.d * o.f + this.f;
      this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
    }

    multiply(other: any) {
      const o = other instanceof DOMMatrixPolyfill ? other : new DOMMatrixPolyfill(other);
      const out = new DOMMatrixPolyfill(this);
      out._mul(o);
      return out;
    }

    multiplySelf(other: any) {
      const o = other instanceof DOMMatrixPolyfill ? other : new DOMMatrixPolyfill(other);
      this._mul(o);
      return this;
    }

    preMultiplySelf(other: any) {
      const o = other instanceof DOMMatrixPolyfill ? other : new DOMMatrixPolyfill(other);
      const out = new DOMMatrixPolyfill(o);
      out._mul(this);
      this.a = out.a; this.b = out.b; this.c = out.c; this.d = out.d; this.e = out.e; this.f = out.f;
      return this;
    }

    translateSelf(tx = 0, ty = 0) {
      return this.multiplySelf({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty });
    }

    scaleSelf(sx = 1, sy?: number) {
      const _sy = typeof sy === "number" ? sy : sx;
      return this.multiplySelf({ a: sx, b: 0, c: 0, d: _sy, e: 0, f: 0 });
    }

    translate(tx = 0, ty = 0) {
      return new DOMMatrixPolyfill(this).translateSelf(tx, ty);
    }

    scale(sx = 1, sy?: number) {
      return new DOMMatrixPolyfill(this).scaleSelf(sx, sy);
    }

    toFloat64Array() {
      return new Float64Array([
        this.a, this.b, 0, 0,
        this.c, this.d, 0, 0,
        0, 0, 1, 0,
        this.e, this.f, 0, 1,
      ]);
    }
  }

  g.DOMMatrix = DOMMatrixPolyfill;
  g.DOMMatrixReadOnly = DOMMatrixPolyfill;
})();


export async function OPTIONS() {
  // Some clients/environments may trigger an OPTIONS preflight. If we don't handle it,
  // Next.js returns 405 which surfaces as "Failed to parse CV (HTTP 405)".
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      endpoint: "/api/parse-cv",
      methods: ["POST", "OPTIONS"],
      commit:
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.VERCEL_GIT_COMMIT_REF ||
        process.env.VERCEL_GIT_PROVIDER ||
        "unknown",
    },
    { status: 200 }
  );
}

function compactText(s: string, max = 12000) {
  const cleaned = s.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max) + "…" : cleaned;
}

// pdf-parse handles pdfjs-dist internally

export async function POST(req: NextRequest) {
  let sizeBytes: number | undefined = undefined;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const name = (file.name || "").toLowerCase();
    const mime = (file.type || "").toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());
    sizeBytes = typeof (file as any).size === "number" ? (file as any).size : buf.length;

    let text = "";

    // TXT
    if (mime.startsWith("text/") || name.endsWith(".txt")) {
      text = buf.toString("utf8");
    }
    // PDF - Use flexible detection (don't rely strictly on mime type)
    else if (name.endsWith(".pdf") || mime.includes("pdf") || buf.slice(0, 4).toString() === "%PDF") {
      try {
        // Load pdf-parse via CommonJS require (stable for Vercel production)
        // Use Node's real require via createRequire to avoid Next.js bundling
        const mod = require("pdf-parse");
        
        // pdf-parse v2+ exports PDFParse class, not a function
        // Check for PDFParse class (capital P)
        const PDFParse = mod?.PDFParse;
        
        if (!PDFParse || typeof PDFParse !== "function") {
          throw new Error(
            `pdf-parse PDFParse class not found. typeof mod=${typeof mod}, keys=${Object.keys(mod || {}).join(",")}`
          );
        }
        
        // Instantiate PDFParse with buffer data
        const parser = new PDFParse({ data: buf });
        
        // Get text from the parser
        const result = await parser.getText();
        
        // Extract text from the result
        text = result?.text || "";
        
        // Clean up parser resources if available
        if (typeof parser.destroy === "function") {
          await parser.destroy();
        }
        
        if (!text || text.trim().length === 0) {
          return NextResponse.json(
            { error: "Could not extract text from PDF. The PDF might be image-based or empty." },
            { status: 400 }
          );
        }
      } catch (e: any) {
        const msg = String(e?.message || e || "Failed to parse PDF");
        const hintParts: string[] = [];
        
        if (/password|encrypted|encryption/i.test(msg)) {
          hintParts.push("This PDF appears to be password-protected. Please export an unprotected PDF or upload a DOCX.");
        } else if (/worker|pdfjs|cannot find/i.test(msg)) {
          hintParts.push("PDF parsing service is temporarily unavailable. Please try uploading a DOCX instead.");
        } else if (/corrupted|invalid|malformed/i.test(msg)) {
          hintParts.push("This PDF appears to be corrupted or invalid. Please try a different PDF file.");
        } else if (/is not a function/i.test(msg) || /cannot be invoked/i.test(msg) || /Class constructor/i.test(msg)) {
          hintParts.push("PDF parser configuration error. Please try uploading a DOCX instead.");
        } else {
          hintParts.push("Failed to parse PDF. Please try converting your CV to DOCX or plain text and upload that instead.");
        }
        
        return NextResponse.json(
          {
            error: "Failed to parse PDF CV",
            details: msg.slice(0, 900),
            hint: hintParts.join(" "),
          },
          { status: 500 }
        );
      }
    }
    // DOCX
    else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.endsWith(".docx")
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result?.value || "";
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload PDF, DOCX, or TXT." },
        { status: 400 }
      );
    }

    text = compactText(text);
    if (!text) {
      return NextResponse.json(
        { error: "Could not extract text from CV. Try a different file." },
        { status: 400 }
      );
    }

    return NextResponse.json({ cvText: text });
  } catch (e: any) {
    const msg = String(e?.message || e || "Failed to parse CV");
    return NextResponse.json(
      {
        error: "Failed to parse CV",
        details: msg.slice(0, 900),
        hint:
          sizeBytes && sizeBytes > 8 * 1024 * 1024
            ? "Your file is quite large. Try uploading a smaller PDF or a DOCX."
            : "Try uploading a DOCX or TXT instead of PDF.",
      },
      { status: 500 }
    );
  }
}

