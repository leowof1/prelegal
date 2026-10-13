import type { NdaValues } from "./types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** NdaValues as JSON: JSON.stringify sends NaN (an empty years field) as null, and the AI may reply with null. */
export interface WireValues extends Omit<NdaValues, "mndaTerm" | "confidentialityTerm"> {
  mndaTerm: { kind: NdaValues["mndaTerm"]["kind"]; years: number | null };
  confidentialityTerm: { kind: NdaValues["confidentialityTerm"]["kind"]; years: number | null };
}

/** Null years keep the previous value, so switching back from an open-ended term restores it. */
export function fromWire(wire: WireValues, previous: NdaValues): NdaValues {
  return {
    ...wire,
    mndaTerm: { ...wire.mndaTerm, years: wire.mndaTerm.years ?? previous.mndaTerm.years },
    confidentialityTerm: {
      ...wire.confidentialityTerm,
      years: wire.confidentialityTerm.years ?? previous.confidentialityTerm.years,
    },
  };
}

/** Sends the conversation and current values; returns the AI's reply and the updated values. */
export async function sendChat(
  messages: ChatMessage[],
  values: NdaValues,
): Promise<{ reply: string; values: NdaValues }> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, values }),
  });
  if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);
  const data: { reply: string; values: WireValues } = await response.json();
  return { reply: data.reply, values: fromWire(data.values, values) };
}
