import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function compactText(s: string, max = 12000) {
  const cleaned = s.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max) + "…" : cleaned;
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
      // pdf-parse v2 exports a PDFParse class (v1 exported a function).
      const mod: any = await import("pdf-parse");
      const PDFParse: any = mod?.PDFParse ?? mod?.default?.PDFParse ?? mod?.default;

      // v2 path
      if (typeof PDFParse === "function") {
        // In some environments (e.g. Vercel), importing pdfjs-dist modules can crash with
        // "DOMMatrix is not defined" because those modules expect browser globals.
        // We don't need to preload any worker when disableWorker=true, so keep this dev-only.
        if (process.env.NODE_ENV !== "production") {
          // PDF.js in Node uses a "fake worker" and dynamically imports `GlobalWorkerOptions.workerSrc`.
          // In Next.js (Turbopack dev), the default "./pdf.worker.mjs" becomes a missing `.next/.../pdf.worker.mjs`.
          // Preload the worker module and set an explicit `workerSrc` to a real file:// URL in node_modules.
          try {
            const { createRequire } = await import("module");
            const { pathToFileURL } = await import("url");
            const require = createRequire(import.meta.url);

            const workerMod: any = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
            (globalThis as any).pdfjsWorker = workerMod;

            const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
            const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
            if (pdfjs?.GlobalWorkerOptions) {
              pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
            }
          } catch {
            // If this fails, pdfjs will fall back to its default workerSrc and may error in some dev setups.
          }
        }

        // In Next.js (Turbopack dev), pdfjs' "fake worker" import can break due to module resolution.
        // Disabling workers is safe on the server and avoids loading `pdf.worker.mjs` entirely.
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

