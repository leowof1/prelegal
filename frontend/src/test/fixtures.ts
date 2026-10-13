import { defaultNdaValues } from "@/lib/document/build";
import type { NdaValues } from "@/lib/document/types";

/** A fully filled-in NDA used across tests. */
export const filledValues = (): NdaValues => ({
  ...defaultNdaValues("2026-10-04"),
  purpose: "Evaluating a joint product launch.",
  mndaTerm: { kind: "expires", years: 2 },
  confidentialityTerm: { kind: "perpetual", years: 1 },
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "Section 9 applies to both parties.",
  parties: [
    { name: "Ada Lovelace", title: "CEO", company: "Acme Inc", noticeAddress: "ada@acme.test" },
    { name: "Alan Turing", title: "CTO", company: "Globex LLC", noticeAddress: "alan@globex.test" },
  ],
});
