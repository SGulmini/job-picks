import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let text = "";

    if (fileName.endsWith(".txt")) {
      // Plain text file
      text = buffer.toString("utf-8");
    } else if (fileName.endsWith(".docx")) {
      // DOCX file - use mammoth
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch (e: any) {
        console.error("Error parsing DOCX:", e);
        return NextResponse.json(
          { error: "Failed to parse DOCX file. Please try a .txt file instead." },
          { status: 400 }
        );
      }
    } else if (fileName.endsWith(".doc")) {
      // Old DOC format - not supported without additional libraries
      return NextResponse.json(
        { error: "Old .doc format is not supported. Please save as .docx or .txt and try again." },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: "Unsupported file format. Please use .txt or .docx files." },
        { status: 400 }
      );
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "File appears to be empty or could not be read." },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      content: text.trim(),
      fileName: file.name.replace(/\.[^/.]+$/, "") // Remove extension for template name
    });
  } catch (e: any) {
    console.error("Error in parse-template:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to parse template file" },
      { status: 500 }
    );
  }
}
