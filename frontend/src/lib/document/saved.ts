import { apiFetch } from "@/lib/api";
import { type ChatMessage, fromWire, toWire, type WireValues } from "./chat";
import type { DocumentValues } from "./types";

/** A document the user has worked on: its values and the chat that produced them. */
export interface SavedDocument {
  values: DocumentValues;
  messages: ChatMessage[];
}

/** An entry in the user's list of documents. */
export interface SavedDocumentSummary {
  id: number;
  documentId: string;
  name: string;
  companies: string[];
  updatedAt: string;
}

export function listDocuments() {
  return apiFetch<SavedDocumentSummary[]>("/api/documents");
}

export async function getDocument(id: number): Promise<SavedDocument> {
  const saved = await apiFetch<{ values: WireValues; messages: ChatMessage[] }>(`/api/documents/${id}`);
  return { values: fromWire(saved.values), messages: saved.messages };
}

/** Saves a new document (id null) or updates an existing one; returns its id. */
export async function saveDocument(id: number | null, { values, messages }: SavedDocument): Promise<number> {
  const body = { values: toWire(values), messages };
  if (id === null) return (await apiFetch<{ id: number }>("/api/documents", "POST", body)).id;
  await apiFetch(`/api/documents/${id}`, "PUT", body);
  return id;
}
