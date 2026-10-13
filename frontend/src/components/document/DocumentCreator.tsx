"use client";

import { useState, useSyncExternalStore } from "react";
import { buildDocument, defaultDocumentValues, pdfFilename, todayIso } from "@/lib/document/build";
import { unsupportedPdfCharacters } from "@/lib/document/pdf-charset";
import type { ChatMessage } from "@/lib/document/chat";
import { type SavedDocument, saveDocument } from "@/lib/document/saved";
import type { DocumentType, DocumentValues } from "@/lib/document/types";
import { DocumentChat } from "./DocumentChat";
import { DocumentPreview } from "./DocumentPreview";
import { DraftDisclaimer } from "./DraftDisclaimer";
import { cardClass, submitButtonClass } from "@/components/ui/styles";

type SaveState = "unsaved" | "saving" | "saved" | "failed";

const SAVE_LABELS: Record<SaveState, string> = {
  unsaved: "",
  saving: "Saving…",
  saved: "Saved to My documents",
  failed: "Could not save your latest changes",
};

const noopSubscribe = () => () => {};

/**
 * Today's date on the client, "" during prerendering. Avoids baking the build
 * date into the static HTML and the hydration mismatch that would cause.
 */
function useToday(): string {
  return useSyncExternalStore(noopSubscribe, todayIso, () => "");
}

/**
 * The AI chat next to a live preview of the chosen document. Once a document is chosen,
 * it is saved after every reply: as a new document, or as `initialId` when reopening one.
 */
export function DocumentCreator({
  documentTypes,
  initialId = null,
  initial,
  onSaved,
}: {
  documentTypes: DocumentType[];
  initialId?: number | null;
  initial?: SavedDocument;
  onSaved?: (id: number, document: SavedDocument) => void;
}) {
  const today = useToday();
  const [edited, setEdited] = useState<DocumentValues | null>(initial?.values ?? null);
  const [savedId, setSavedId] = useState(initialId);
  const [saveState, setSaveState] = useState<SaveState>(initialId === null ? "unsaved" : "saved");
  const values = edited ?? defaultDocumentValues(today);

  const documentType = documentTypes.find((t) => t.spec.id === values.documentId);
  const blocks = documentType ? buildDocument(documentType, values) : [];
  const unsupported = unsupportedPdfCharacters(values);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReply(messages: ChatMessage[], next: DocumentValues) {
    setEdited(next);
    if (!next.documentId) return;
    setSaveState("saving");
    try {
      const id = await saveDocument(savedId, { values: next, messages });
      setSavedId(id);
      setSaveState("saved");
      onSaved?.(id, { values: next, messages });
    } catch (err) {
      console.error(err);
      setSaveState("failed");
    }
  }

  async function downloadPdf(spec: DocumentType["spec"]) {
    setDownloading(true);
    setError(null);
    try {
      // Loaded on demand: the PDF renderer is large and only needed here.
      const { renderDocumentPdf } = await import("./document-pdf");
      const url = URL.createObjectURL(await renderDocumentPdf(spec.name, blocks));
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfFilename(spec, values);
      link.click();
      // Revoke after the click has been handled; revoking synchronously can cancel the download.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      console.error(err);
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section aria-label="Document chat">
        <DocumentChat values={values} initialMessages={initial?.messages} onReply={handleReply} />
      </section>

      {documentType ? (
        <section className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <DraftDisclaimer />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-600">
              <span className="rounded bg-amber-100 px-1 text-amber-800">Highlighted</span> fields still need a value.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <p aria-live="polite" className={`text-sm ${saveState === "failed" ? "text-red-700" : "text-stone-600"}`}>
                {SAVE_LABELS[saveState]}
              </p>
              <button
                type="button"
                onClick={() => downloadPdf(documentType.spec)}
                disabled={downloading}
                className={`${submitButtonClass} disabled:cursor-wait disabled:opacity-60`}
              >
                {downloading ? "Preparing PDF…" : "Download PDF"}
              </button>
            </div>
          </div>
          {unsupported.length > 0 && (
            <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              The PDF can&apos;t display these characters and will show them garbled:{" "}
              <span className="font-semibold">{unsupported.slice(0, 10).join(" ")}</span>
              {unsupported.length > 10 && " …"}. Use Latin characters for names and addresses.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div
            role="region"
            aria-label="Agreement preview"
            tabIndex={0}
            className={`max-h-[calc(100vh-8rem)] overflow-y-auto p-8 ${cardClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue sm:p-12`}
          >
            <DocumentPreview blocks={blocks} />
          </div>
        </section>
      ) : (
        <section aria-label="Available documents" className={`p-8 ${cardClass}`}>
          <h2 className="text-lg font-semibold text-brand-navy">Tell the assistant what you need</h2>
          <p className="mt-2 text-stone-600">
            Once you and the assistant pick a document, its preview appears here. You can draft:
          </p>
          <ul className="mt-4 space-y-3">
            {documentTypes.map(({ spec }) => (
              <li key={spec.id}>
                <span className="font-semibold text-stone-900">{spec.name}</span>
                <span className="block text-sm text-stone-600">{spec.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
