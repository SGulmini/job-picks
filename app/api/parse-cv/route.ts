import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function compactText(s: string, max = 12000) {
  const cleaned = s.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max) + "…" : cleaned;
}

// Minimal DOMMatrix polyfill for server environments (e.g. Vercel) where pdfjs-dist
// may require DOMMatrix even for text extraction.
function ensureDOMMatrixPolyfill() {
  const g: any = globalThis as any;
  if (g.DOMMatrix) return;

  class DOMMatrixPolyfill {
    a: number; b: number; c: number; d: number; e: number; f: number;
    is2D = true;

    constructor(init?: any) {
      // identity
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      if (!init) return;

      // Array form: [a,b,c,d,e,f] or 16-length matrix
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

      // Object form: {a,b,c,d,e,f}
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
      // 2D matrix as 16-length array, column-major-ish is not required for our usage
      return new Float64Array([
        this.a, this.b, 0, 0,
        this.c, this.d, 0, 0,
        0, 0, 1, 0,
        this.e, this.f, 0, 1,
      ]);
    }
  }

  g.DOMMatrix = DOMMatrixPolyfill;
  if (!g.DOMMatrixReadOnly) g.DOMMatrixReadOnly = DOMMatrixPolyfill;
}

async function ensurePdfJsWorkerSrc() {
  // Make pdf.js resolve its worker from node_modules (Vercel/server) instead of `.next/server/chunks/pdf.worker.mjs`.
  // Safe to call multiple times.
  try {
    const { createRequire } = await import("module");
    const { pathToFileURL } = await import("url");
    const require = createRequire(import.meta.url);

    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    }
  } catch {
    // Best effort: if this fails, pdfjs will use its default worker resolution (may fail in some hosts).
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const name = (file.name || "").toLowerCase();
    const mime = (file.type || "").toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    let text = "";

    // TXT
    if (mime.startsWith("text/") || name.endsWith(".txt")) {
      text = buf.toString("utf8");
    }
    // PDF
    else if (mime === "application/pdf" || name.endsWith(".pdf")) {
      ensureDOMMatrixPolyfill();
      await ensurePdfJsWorkerSrc();
      // pdf-parse v2 exports a PDFParse class (v1 exported a function).
      const mod: any = await import("pdf-parse");
      const PDFParse: any = mod?.PDFParse ?? mod?.default?.PDFParse ?? mod?.default;

      // v2 path
      if (typeof PDFParse === "function") {
        // Disabling workers is safe on the server; we also set workerSrc above to avoid
        // pdfjs trying to import a missing `.next/server/chunks/pdf.worker.mjs` in some hosts.
        const parser = new PDFParse({ data: buf, disableWorker: true });
        const result = await parser.getText();
        await parser.destroy?.();
        text = result?.text || "";
      } else {
        // v1 fallback (in case dependency changes)
        const pdfParseFn: any = mod?.default ?? mod;
        if (typeof pdfParseFn !== "function") {
          throw new Error(
            "PDF parsing library could not be loaded. Please reinstall dependencies (npm install) and restart the dev server."
          );
        }
        const parsed = await pdfParseFn(buf);
        text = parsed?.text || "";
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
    return NextResponse.json(
      { error: e?.message || "Failed to parse CV" },
      { status: 500 }
    );
  }
}

