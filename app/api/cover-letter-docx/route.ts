import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function safeFileName(s: string) {
  const cleaned = (s || "cover-letter")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 80) || "cover-letter";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text : "";
    const baseName = typeof body?.fileName === "string" ? body.fileName : "cover-letter";

    if (!text.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const { Document, Packer, Paragraph, TextRun } = await import("docx");

    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const paragraphs = lines.map((line: string) => {
      // Preserve blank lines as spacing in Word
      if (!line.trim()) return new Paragraph({ children: [new TextRun("")] });
      return new Paragraph({ children: [new TextRun({ text: line })] });
    });

    const doc = new Document({
      sections: [{ properties: {}, children: paragraphs }],
    });

    const buffer = await Packer.toBuffer(doc);
    const fileName = `${safeFileName(baseName)}.docx`;
    const bytes = new Uint8Array(buffer);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to build .docx" }, { status: 500 });
  }
}

