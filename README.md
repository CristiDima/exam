# EPSO Practice

A static quiz app for EPSO exam practice. There's no backend and no database:

- **Questions** are JSON files in [`public/data/`](public/data/).
- **Progress** (run history and learning-mode stats) is saved in the browser's `localStorage`.
  Use **Export progress / Import progress** on the Results Dashboard to back it up or move it to another device.

## Modes

- **Random**: N random questions, optionally limited to a range (e.g. questions 100–200), in random or file order.
- **Learning**: questions you've never answered come first, then the ones you miss most often.

## Adding or changing question sets

1. Put the JSON file in `public/data/` (see the [format](#question-format) below).
2. Add it to [`public/data/banks.json`](public/data/banks.json):
   ```json
   { "id": "my-set", "title": "My Set", "file": "my-set.json" }
   ```

Malformed questions are skipped (see the browser console). Stats are keyed by a hash of the
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

## Run locally

Any static file server works, for example:

```bash
python3 -m http.server 8000 --directory public
```

Then open http://localhost:8000. (Opening `index.html` directly from disk won't work, because browsers block `fetch` on `file://`.)

## Deploy on Vercel

Import this repository at [vercel.com/new](https://vercel.com/new) and click **Deploy**. No settings are needed:
[`vercel.json`](vercel.json) tells Vercel there's no build step and to serve the `public/` folder.

Or with the CLI: `npm i -g vercel`, then `vercel` (preview) or `vercel --prod`.

## Moving history from the old Docker app

```bash
python3 scripts/export_flask_history.py "../Practice test app/db/quiz.db" > epso-progress-from-docker.json
```

Then open the app → **Results Dashboard** → **Import progress** and pick that file.
