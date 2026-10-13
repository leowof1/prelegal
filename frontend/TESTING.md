# Testing

## Automated

| Command             | What it covers                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `npm test`          | Vitest: parsing of every template and markdown edge cases; document building (cover page, placeholders, filenames, literal user markup); chat client; PDF content and layout read back with pdfjs (page breaks, clause order and nesting, attribution on every page, long and non-Latin input, cell overflow); chat/preview/download component tests in jsdom; server-rendered HTML |
| `npm run test:e2e`  | Playwright against a fresh static export served by the FastAPI backend (needs `uv`; `/api/chat` is stubbed), in Chromium, Firefox, WebKit and a mobile viewport: fake sign-in/sign-out; full flow incl. real PDF download, unsupported requests, switching documents, long/non-Latin input, keyboard use, axe WCAG 2.1 A/AA scan, responsive layout, no console errors |
| `npm run lint`      | ESLint                                                                                           |
| `npm run typecheck` | TypeScript                                                                                       |

First-time e2e setup: `npx playwright install chromium firefox webkit`.
CI (`.github/workflows/frontend.yml`) runs all of the above on every PR that touches `frontend/`, `templates/` or `documents.json`.

## Manual checklist

Run `scripts/start-mac.sh` (or the Linux/Windows script) from the repo root with `OPENROUTER_API_KEY` in `.env`, and
open http://localhost:8000. Covers what automation can't judge: the real AI's answers, how the document looks and
whether the PDF opens correctly in a real viewer.

| # | Step                                                                   | Expected                                                                                                 |
| - | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1 | Sign in with any name and email                                        | Chat left with a greeting; the list of available documents right                                         |
| 2 | Ask for an employment contract                                         | The AI says it can't draft it and suggests the closest supported document; the list stays               |
| 3 | Ask for a pilot agreement between two named companies                  | Preview shows the Pilot Agreement cover page with Provider/Customer columns; Effective Date is today     |
| 4 | Answer the AI's questions until it says the document is ready          | Amber highlights disappear as values arrive; Signature and Date rows stay blank                          |
| 5 | Ask to switch to an NDA instead                                        | Preview switches to the Mutual NDA; parties and governing law are kept                                   |
| 6 | Scroll the preview to the end                                          | Full standard terms with nested numbering (1., 1.1, (a)) and the CC BY 4.0 attribution                   |
| 7 | Click **Download PDF** and open the file                               | `<Document-Name>-<Company1>-<Company2>.pdf`; cover page, then the terms; attribution on each page        |
| 8 | Give a company name with non-Latin letters (e.g. "Łódź")               | Amber warning lists the unsupported characters; accented Latin (é, ü, ó) is not listed                   |
| 9 | Narrow the window to phone width                                       | Chat stacks above the preview; no horizontal scrolling                                                   |

## Known limitations

- The PDF uses the built-in Times fonts (Windows-1252). Characters outside that set — e.g. Polish "Ł",
  Cyrillic, CJK, emoji — render garbled; the app warns the user before download. Embedding a Unicode font
  would remove this limitation.
