"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { type ChatMessage, sendChat } from "@/lib/document/chat";
import type { DocumentValues } from "@/lib/document/types";
import { inputClass, submitButtonClass } from "@/components/ui/styles";

export const GREETING =
  "Hi! I'll help you draft a legal agreement, such as an NDA, a cloud service agreement or a pilot agreement. What would you like to create, and who are the parties?";

/** Freeform AI chat that picks the document and fills in its values as the conversation goes. */
export function DocumentChat({
  values,
  onChange,
}: {
  values: DocumentValues;
  onChange: (values: DocumentValues) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current!;
    log.scrollTop = log.scrollHeight;
  }, [messages, pending]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setPending(true);
    setError(null);
    try {
      const result = await sendChat(history, values);
      setMessages([...history, { role: "assistant", content: result.reply }]);
      onChange(result.values);
    } catch (err) {
      console.error(err);
      // Put the message back in the box so retrying does not repeat it in the conversation.
      setMessages(messages);
      setInput(text);
      setError("The assistant could not respond. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-navy">Chat with the AI assistant</h2>
      <div
        ref={logRef}
        role="log"
        aria-label="Conversation"
        tabIndex={0}
        className="flex max-h-[28rem] min-h-64 flex-col gap-3 overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
      >
        {messages.map((message, i) => (
          <p
            key={i}
            className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
              message.role === "user" ? "self-end bg-brand-blue/15 text-stone-900" : "self-start bg-stone-100 text-stone-900"
            }`}
          >
            <span className="sr-only">{message.role === "user" ? "You: " : "Assistant: "}</span>
            {message.content}
          </p>
        ))}
        {pending && <p className="self-start text-sm text-stone-600">Thinking…</p>}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <form onSubmit={send} className="flex gap-2">
        <input
          type="text"
          aria-label="Message"
          placeholder="Type your answer…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={pending || !input.trim()} className={`${submitButtonClass} disabled:opacity-60`}>
          Send
        </button>
      </form>
    </div>
  );
}
