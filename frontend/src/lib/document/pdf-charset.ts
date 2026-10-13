import type { NdaValues } from "./types";

/**
 * Characters outside Latin-1 that the PDF's built-in Times fonts can still draw
 * (the Windows-1252 additions to WinAnsiEncoding).
 */
const WIN_ANSI_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

function isPdfSafe(char: string): boolean {
  const code = char.codePointAt(0)!;
  return (
    char === "\n" ||
    char === "\r" ||
    char === "\t" ||
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    WIN_ANSI_EXTRAS.has(char)
  );
}

/**
 * The distinct characters in the user's input that the PDF cannot render
 * (they would come out garbled), in order of first appearance.
 */
export function unsupportedPdfCharacters(values: NdaValues): string[] {
  const text = [
    values.purpose,
    values.governingLaw,
    values.jurisdiction,
    values.modifications,
    ...values.parties.flatMap((party) => Object.values(party)),
  ].join("");
  return [...new Set([...text].filter((char) => !isPdfSafe(char)))];
}
