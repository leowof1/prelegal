# Prelegal frontend

Next.js app for drafting legal agreements. `/` is the sign-in and sign-up screen. `/create/` is the **Document
Creator**: an AI chat works out which of the supported Common Paper agreements the user needs, fills in its key terms,
shows the document update live, and offers it as a PDF. `/documents/` lists the user's saved documents; each
reopens at `/create/?doc=ID` with its conversation.

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
  The backend sets an httpOnly session cookie; `useUser()` (`src/lib/session/user.ts`) asks `/api/auth/me` who is
  signed in, and `RequireUser` sends signed-out visitors to `/`. The dev server has no `/api`, so test sign-in and
  saving against the backend (`npm run build`, then run it from `../backend`).
- Once the chat has chosen a document, `DocumentCreator` saves it (values and conversation) to `/api/documents` after
  every reply; `DocumentWorkspace` opens `?doc=ID` and switches a new document's URL to it on the first save.

- `src/lib/document/template.ts` reads `../documents.json` and each document's template in `../templates/` at build
  time (the page is statically rendered), so the repo stays the single source of truth. The app must be built from
  inside the repository.
- `src/lib/document/build.ts` combines a document's spec, its parsed standard terms and the chat's values into a
  renderer-agnostic `Block[]` document model: a generated cover page, then the terms. Missing values become
  highlighted placeholders.
- The live preview (`DocumentPreview.tsx`) and the PDF (`document-pdf.tsx`, using `@react-pdf/renderer`) both render
  that model. The PDF renderer is loaded lazily when the user clicks **Download PDF**.

The agreement texts are Common Paper standard terms, used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); attribution is kept in the preview and the PDF.
