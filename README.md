# EPSO Practice

A quiz app for EPSO exam practice, built with React, Vite, TypeScript and Tailwind. It has no backend and no database:

- **Questions** are JSON files in [`public/data/`](public/data/).
- **Progress** (quiz history, per-question stats, bookmarks, the quiz in progress) is saved in the browser's `localStorage`.
  Use **Settings → Export / Import progress** to back it up or move it to another device.

## Features

- **Modes:** Classic (random questions, optional range and file order), Learning (unseen first, then the ones you miss most),
  Exam simulation (time limit, no answers until you submit), My mistakes, Bookmarks.
- **Questions page:** every question with its answer and explanation. Accent-insensitive search with highlighting,
  filters by set and status (new / to review / known / bookmarked), flashcard mode, and "Practice these" to quiz yourself on the results.
- **Quiz:** one-tap answers (or the classic select-then-check flow, in Settings), keys `1`–`4` / `A`–`D` and `Enter`,
  resume after a refresh, bookmarks, and review of wrong answers at the end.
- **Statistics:** progress per set, score trend, most missed questions, full history.
- **Light and dark themes**, works on phones, installable, and works offline after the first visit.

## Adding or changing question sets

1. Put the JSON file in `public/data/` (see the [format](#question-format) below).
2. Add it to [`public/data/banks.json`](public/data/banks.json):
   ```json
   { "id": "my-set", "title": "My Set", "file": "my-set.json" }
   ```

Malformed questions are skipped (see the browser console). Stats are keyed by a SHA-256 hash of the
question text, so reordering or adding questions keeps your progress.

### Question format

```json
[
  {
    "question": "The question text",
    "choices": { "A": "...", "B": "...", "C": "...", "D": "..." },
    "answer": "B",
    "explanation": "Why B is correct"
  }
]
```

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (question files, selection, progress, search)
npm run build    # type-check and build into dist/
```

## Deploy on Vercel

Import the repository at [vercel.com/new](https://vercel.com/new) and deploy; every push to `main` redeploys.
[`vercel.json`](vercel.json) sets the Vite build, the `dist` output, and the fallback that serves `index.html`
for app routes such as `/questions`.

## Moving history from the old Docker app

```bash
python3 scripts/export_flask_history.py "../Practice test app/db/quiz.db" > epso-progress-from-docker.json
```

Then open the app → **Settings** → **Import progress** and pick that file.
