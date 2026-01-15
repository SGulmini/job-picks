import { COVER_LETTER_TEMPLATE_EN, COVER_LETTER_TEMPLATE_FR } from "@/lib/coverLetterTemplate";

export function getCoverLetterTemplateForLanguage(code: string) {
  const c = String(code || "").toLowerCase();
  if (c === "fr") return COVER_LETTER_TEMPLATE_FR;
  if (c === "en") return COVER_LETTER_TEMPLATE_EN;
  // Default to English template for unsupported languages; the model can translate the structure.
  return COVER_LETTER_TEMPLATE_EN;
}

