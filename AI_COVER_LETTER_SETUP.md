# AI Cover Letter Setup

Job Picks can generate a tailored cover letter for each job using an AI model.

## 1) Add environment variables

In your `.env.local` (project root), add:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

- `OPENAI_API_KEY` is required.
- `OPENAI_MODEL` is optional (defaults to `gpt-4o-mini`).

Restart `npm run dev` after editing `.env.local`.

## 2) How it works

- On `/home` and `/saved`, each job has a **Generate cover letter** button.
- The app sends the job details + your saved profile to `POST /api/cover-letter`.
- The generated letter is cached locally per job id in `localStorage` so you can revisit it later.

## 3) Notes

- The system is designed to avoid inventing facts. If your profile lacks details, the letter will stay generic.

