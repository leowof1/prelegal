import { defaultDocumentValues } from "@/lib/document/build";
import { loadDocumentTypes } from "@/lib/document/template";
import type { DocumentType, DocumentValues } from "@/lib/document/types";

export const documentTypes = loadDocumentTypes();

export const documentType = (id: string): DocumentType => documentTypes.find((t) => t.spec.id === id)!;

/** A fully filled-in Mutual NDA used across tests. */
export const filledValues = (): DocumentValues => ({
  ...defaultDocumentValues("2026-10-04"),
  documentId: "mutual-nda",
  terms: {
    purpose: "Evaluating a joint product launch.",
    mndaTerm: "Expires 2 years from Effective Date.",
    confidentialityTerm: "In perpetuity.",
    governingLaw: "Delaware",
    jurisdiction: "courts located in New Castle, DE",
    modifications: "Section 9 applies to both parties.",
  },
  parties: [
    { name: "Ada Lovelace", title: "CEO", company: "Acme Inc", noticeAddress: "ada@acme.test" },
    { name: "Alan Turing", title: "CTO", company: "Globex LLC", noticeAddress: "alan@globex.test" },
  ],
});
