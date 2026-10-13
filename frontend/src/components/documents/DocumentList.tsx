"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listDocuments, type SavedDocumentSummary } from "@/lib/document/saved";
import { LoadingState } from "@/components/ui/LoadingState";
import { cardClass, focusRing, submitButtonClass } from "@/components/ui/styles";

const formatUpdated = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

/** The signed-in user's documents, newest first, each linking back into the creator. */
export function DocumentList() {
  const [documents, setDocuments] = useState<SavedDocumentSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    listDocuments().then(setDocuments, () => setFailed(true));
  }, []);

  if (failed) {
    return (
      <p role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-800">
        Your documents could not be loaded. Please refresh the page to try again.
      </p>
    );
  }
  if (documents === null) return <LoadingState label="Loading your documents…" />;
  if (documents.length === 0) {
    return (
      <div className={`px-6 py-14 text-center ${cardClass}`}>
        <h2 className="text-lg font-semibold text-brand-navy">No documents yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
          Chat with the AI assistant to draft your first agreement. Every document you work on is saved here
          automatically.
        </p>
        <Link href="/create/" className={`mt-6 ${submitButtonClass}`}>
          Start a document
        </Link>
      </div>
    );
  }
  return (
    <ul aria-label="Your documents" className={`divide-y divide-stone-200 ${cardClass}`}>
      {documents.map((doc) => (
        <li key={doc.id}>
          <Link
            href={`/create/?doc=${doc.id}`}
            className={`flex flex-col gap-1 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between ${focusRing}`}
          >
            <span>
              <span className="block font-semibold text-brand-navy">{doc.name}</span>
              <span className="block text-sm text-stone-600">
                {doc.companies.length > 0 ? doc.companies.join(" and ") : "Parties not named yet"}
              </span>
            </span>
            <span className="text-sm text-stone-600">Updated {formatUpdated(doc.updatedAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
