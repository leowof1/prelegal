# Testing

## Automated

| Command             | What it covers                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `npm test`          | Vitest: template parsing and markdown edge cases; document building (dates, term years, placeholders, filenames, literal user markup); PDF content and layout read back with pdfjs (page breaks, clause order, attribution on every page, long and non-Latin input, cell overflow); form/preview/download component tests in jsdom; server-rendered HTML |
| `npm run test:e2e`  | Playwright against a fresh production build in Chromium, Firefox, WebKit and a mobile viewport: full flow incl. real PDF download, term switching and validation, long/non-Latin input, keyboard use, axe WCAG 2.1 A/AA scan, responsive layout, no console errors |
| `npm run lint`      | ESLint                                                                                           |
| `npm run typecheck` | TypeScript                                                                                       |

First-time e2e setup: `npx playwright install chromium firefox webkit`.
CI (`.github/workflows/frontend.yml`) runs all of the above on every PR that touches `frontend/` or `templates/`.

## Manual checklist

Run `npm run build && npm start` and open http://localhost:3000. Covers what automation can't judge: how the
document looks and whether the PDF opens correctly in a real viewer.

| #  | Step                                                                                         | Expected                                                                                              |
| -- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1  | Load the page                                                                                | Form left, preview right; Effective Date is today; amber highlights on Governing Law and Jurisdiction  |
| 2  | Fill Governing Law and Jurisdiction                                                          | Highlights disappear; values appear under "Governing Law & Jurisdiction"                              |
| 3  | Change MNDA Term years to 3, then select "Continues until terminated"                        | Text reads "Expires 3 years…", then the until-terminated wording; years box greys out                 |
| 4  | Select "In perpetuity" for Term of Confidentiality                                           | Preview reads "In perpetuity."                                                                        |
| 5  | Type two lines into MNDA Modifications                                                       | Preview shows both lines on separate lines                                                            |
| 6  | Fill both parties                                                                            | Signature table fills in; Signature and Date rows stay blank                                          |
| 7  | Scroll the preview to the end                                                                | All 11 Standard Terms and the CC BY 4.0 attribution are present                                       |
| 8  | Click **Download PDF**                                                                       | Button shows "Preparing PDF…"; file named `Mutual-NDA-<Company1>-<Company2>.pdf` downloads            |
| 9  | Open the PDF in a viewer                                                                     | Cover page with signature table on page 1; Standard Terms from page 2; attribution footer on each page; links clickable |
| 10 | Narrow the window to phone width                                                             | Form stacks above the preview; no horizontal scrolling                                                |
| 11 | Set MNDA Term years to 4, switch to "Continues until terminated" and back                    | Years box still shows 4; preview reads "Expires 4 years…"                                             |
| 12 | Type 0 into a years box                                                                      | Red border and "Enter a whole number of years from 1 to 100."; preview shows [Number of years]        |
| 13 | Type a company name with non-Latin letters (e.g. "Łódź")                                     | Amber warning lists the unsupported characters; accented Latin (é, ü, ó) is not listed                |
| 14 | Enter a very long Purpose and a long notice address, then download                           | Purpose starts on page 1 and continues; the address wraps inside its table cell                       |

## Known limitations

- The PDF uses the built-in Times fonts (Windows-1252). Characters outside that set — e.g. Polish "Ł",
  Cyrillic, CJK, emoji — render garbled; the app warns the user before download. Embedding a Unicode font
  would remove this limitation.
