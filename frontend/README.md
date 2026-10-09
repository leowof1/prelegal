# Prelegal frontend

Next.js app for drafting legal agreements. `/` is a placeholder sign-in screen (any name and email, no real
authentication yet). `/nda/` is the **Mutual NDA Creator**: the user fills in the key terms, sees the Common Paper
Mutual NDA update live, and downloads it as a PDF.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

| Script          | Purpose                    |
| --------------- | -------------------------- |
| `npm run dev`   | Start the dev server       |
| `npm run build` | Static export to `out/`    |
| `npm test`      | Unit tests (Vitest)        |
| `npm run lint`  | ESLint                     |

## How it works

- The app is a static export (`output: "export"`), served in production by the FastAPI backend in `../backend`.
  The signed-in user is kept in `localStorage` (`src/lib/session/user.ts`).

- `src/lib/nda/template.ts` reads `../templates/Mutual-NDA-coverpage.md` and `../templates/Mutual-NDA.md` at build
  time (the page is statically rendered), so the repo's `templates/` directory stays the single source of truth.
  The app must be built from inside the repository.
- `src/lib/nda/build.ts` combines the template text with the form values into a renderer-agnostic `Block[]`
  document model. Missing values become highlighted placeholders.
- The live preview (`NdaPreview.tsx`) and the PDF (`nda-pdf.tsx`, using `@react-pdf/renderer`) both render that
  model. The PDF renderer is loaded lazily when the user clicks **Download PDF**.

The agreement text is Common Paper's Mutual NDA (Version 1.0), used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); attribution is kept in the preview and the PDF.
