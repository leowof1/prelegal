import { apiFetch } from "@/lib/api";
import type { DocumentValues } from "./types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** DocumentValues as the API sends them: terms are a list, so the AI's reply fits a strict JSON schema. */
export interface WireValues extends Omit<DocumentValues, "terms"> {
  terms: { key: string; value: string }[];
}

export function toWire(values: DocumentValues): WireValues {
  return { ...values, terms: Object.entries(values.terms).map(([key, value]) => ({ key, value })) };
}

/**
 * Terms the reply leaves out keep their previous value, and values for terms the
 * new document shares with the previous one (e.g. governing law) carry over.
 */
export function fromWire(wire: WireValues, previous?: DocumentValues): DocumentValues {
  const terms = Object.fromEntries(wire.terms.map(({ key, value }) => [key, value]));
  return { ...wire, terms: { ...previous?.terms, ...terms } };
}

/** Sends the conversation and current values; returns the AI's reply and the updated values. */
export async function sendChat(
  messages: ChatMessage[],
  values: DocumentValues,
): Promise<{ reply: string; values: DocumentValues }> {
  const data = await apiFetch<{ reply: string; values: WireValues }>("/api/chat", "POST", {
    messages,
    values: toWire(values),
  });
  return { reply: data.reply, values: fromWire(data.values, values) };
}
