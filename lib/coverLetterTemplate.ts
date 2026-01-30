export const COVER_LETTER_TEMPLATE_FR = `
{{CANDIDATE_FULL_NAME}}
{{CANDIDATE_ADDRESS_LINE1}}
{{CANDIDATE_ZIP}} {{CANDIDATE_CITY}}
{{CANDIDATE_PHONE}}

{{COMPANY_NAME}}
Ressources Humaines
{{COMPANY_ADDRESS_LINE1}}
{{COMPANY_ZIP}} {{COMPANY_CITY}}

{{CITY}}, le {{DATE}}

{{ROLE_TITLE}}

Madame, Monsieur,

{{OPENING_PARAGRAPH}}

{{EXPERIENCE_PARAGRAPH}}

{{ACHIEVEMENTS_PARAGRAPH}}

{{CLOSING_PARAGRAPH}}

{{FORMAL_CLOSING}}

{{CANDIDATE_FULL_NAME}}

Annexes : CV, diplômes, certificats de travail
`.trim();

export const COVER_LETTER_TEMPLATE_EN = `
{{CANDIDATE_FULL_NAME}}
{{CANDIDATE_ADDRESS_LINE1}}
{{CANDIDATE_ZIP}} {{CANDIDATE_CITY}}
{{CANDIDATE_PHONE}}

{{COMPANY_NAME}}
Human Resources
{{COMPANY_ADDRESS_LINE1}}
{{COMPANY_ZIP}} {{COMPANY_CITY}}

{{CITY}}, {{DATE}}

{{ROLE_TITLE}}

Dear Hiring Manager,

{{OPENING_PARAGRAPH}}

{{EXPERIENCE_PARAGRAPH}}

{{ACHIEVEMENTS_PARAGRAPH}}

{{CLOSING_PARAGRAPH}}

{{FORMAL_CLOSING}}

{{CANDIDATE_FULL_NAME}}

Attachments: CV/Resume, diplomas, work certificates
`.trim();

// Short version template - concise and direct
export const COVER_LETTER_TEMPLATE_EN_SHORT = `
Dear Hiring Manager,

I am writing to apply for the {{ROLE_TITLE}} position at {{COMPANY_NAME}}. {{SHORT_INTRODUCTION}}

{{SHORT_EXPERIENCE_PARAGRAPH}}

{{SHORT_INTEREST_PARAGRAPH}}

Thank you for your consideration.

Sincerely,
{{CANDIDATE_FULL_NAME}}
`.trim();

export const COVER_LETTER_TEMPLATE_FR_SHORT = `
Madame, Monsieur,

Je vous écris pour postuler au poste de {{ROLE_TITLE}} chez {{COMPANY_NAME}}. {{SHORT_INTRODUCTION}}

{{SHORT_EXPERIENCE_PARAGRAPH}}

{{SHORT_INTEREST_PARAGRAPH}}

Je vous remercie de votre attention.

Cordialement,
{{CANDIDATE_FULL_NAME}}
`.trim();

// Very short version templates - ultra concise (1–2 very short paragraphs)
export const COVER_LETTER_TEMPLATE_EN_VERY_SHORT = `
Dear Hiring Manager,

{{VERY_SHORT_BODY}}

Sincerely,
{{CANDIDATE_FULL_NAME}}
`.trim();

export const COVER_LETTER_TEMPLATE_FR_VERY_SHORT = `
Madame, Monsieur,

{{VERY_SHORT_BODY}}

Cordialement,
{{CANDIDATE_FULL_NAME}}
`.trim();

// Creative version templates - original, distinctive, memorable
export const COVER_LETTER_TEMPLATE_EN_CREATIVE = `
{{CREATIVE_OPENING}}

{{CREATIVE_BODY}}

{{CREATIVE_CLOSING}}

{{CANDIDATE_FULL_NAME}}
`.trim();

export const COVER_LETTER_TEMPLATE_FR_CREATIVE = `
{{CREATIVE_OPENING}}

{{CREATIVE_BODY}}

{{CREATIVE_CLOSING}}

{{CANDIDATE_FULL_NAME}}
`.trim();