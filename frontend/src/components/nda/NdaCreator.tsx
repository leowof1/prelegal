"use client";

import { useState, useSyncExternalStore } from "react";
import { buildNdaDocument, defaultNdaValues, pdfFilename, todayIso } from "@/lib/nda/build";
import { unsupportedPdfCharacters } from "@/lib/nda/pdf-charset";
import type { NdaTemplate, NdaValues } from "@/lib/nda/types";
import { NdaChat } from "./NdaChat";
import { NdaPreview } from "./NdaPreview";
import { submitButtonClass } from "@/components/ui/styles";

const noopSubscribe = () => () => {};

/**
 * Today's date on the client, "" during prerendering. Avoids baking the build
 * date into the static HTML and the hydration mismatch that would cause.
 */
function useToday(): string {
  return useSyncExternalStore(noopSubscribe, todayIso, () => "");
}

export function NdaCreator({ template }: { template: NdaTemplate }) {
  const today = useToday();
  const [edited, setEdited] = useState<NdaValues | null>(null);
  const values = edited ?? defaultNdaValues(today);

  const blocks = buildNdaDocument(template, values);
  const unsupported = unsupportedPdfCharacters(values);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadPdf() {
    setDownloading(true);
    setError(null);
    try {
      // Loaded on demand: the PDF renderer is large and only needed here.
      const { renderNdaPdf } = await import("./nda-pdf");
      const url = URL.createObjectURL(await renderNdaPdf(blocks));
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfFilename(values);
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
      <section aria-label="NDA chat">
        <NdaChat values={values} onChange={setEdited} />
      </section>

      <section className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-600">
            <span className="rounded bg-amber-100 px-1 text-amber-800">Highlighted</span> fields still need a value.
          </p>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={downloading}
            className={`${submitButtonClass} disabled:cursor-wait disabled:opacity-60`}
          >
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
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
          className="max-h-[calc(100vh-8rem)] overflow-y-auto rounded-lg border border-stone-200 bg-white p-8 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue sm:p-12"
        >
          <NdaPreview blocks={blocks} />
        </div>
      </section>
    </div>
  );
}
