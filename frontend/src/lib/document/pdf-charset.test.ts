import { describe, expect, it } from "vitest";
import { filledValues } from "@/test/fixtures";
import { unsupportedPdfCharacters } from "./pdf-charset";

describe("unsupportedPdfCharacters", () => {
  it("accepts ASCII, Latin-1 and the Windows-1252 punctuation", () => {
    const values = filledValues();
    values.terms.purpose = "Müller GmbH – „Café“ naïve façade €100 ™\nSecond line";
    expect(unsupportedPdfCharacters(values)).toEqual([]);
  });

  it("lists each unsupported character once, in order, across all fields", () => {
    const values = filledValues();
    values.terms.purpose = "Łódź Łódź";
    values.parties[1].company = "Привет 株式会社 😀";

    expect(unsupportedPdfCharacters(values)).toEqual(["Ł", "ź", "П", "р", "и", "в", "е", "т", "株", "式", "会", "社", "😀"]);
  });
});
