"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getDocument, type SavedDocument } from "@/lib/document/saved";
import type { DocumentType } from "@/lib/document/types";
import { LoadingState } from "@/components/ui/LoadingState";
import { cardClass, textLinkClass } from "@/components/ui/styles";
import { DocumentCreator } from "./DocumentCreator";

/** A saved document, or null if it could not be opened. */
type Opened = { id: number; document: SavedDocument | null };

/**
 * The ?doc= id last rendered, the id of the new document started here (once saved), and the key of
 * the creator for new documents, which changes whenever the user comes back to a plain /create/.
 */
type View = { id: number | null; createdId: number | null; newKey: number };

/**
 * The document creator for /create/: a new document, or the saved one named by ?doc=ID.
 * A new document's URL switches to ?doc=ID once it is first saved, so reloading reopens it.
 */
export function DocumentWorkspace({ documentTypes }: { documentTypes: DocumentType[] }) {
  const param = useSearchParams().get("doc");
  const id = param !== null && /^\d+$/.test(param) ? Number(param) : null;
  const [opened, setOpened] = useState<Opened | null>(null);
  const [view, setView] = useState<View>({ id, createdId: null, newKey: 0 });
  const mounted = useRef(false);

  if (id !== view.id) {
    setView(id === null ? { id, createdId: null, newKey: view.newKey + 1 } : { ...view, id });
  }
  // A new document keeps its creator when it moves to ?doc=ID, so focus and typed text are not lost.
  const isNew = id === null || id === view.createdId;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isNew || opened?.id === id) return;
    getDocument(id).then(
      (document) => setOpened({ id, document }),
      () => setOpened({ id, document: null }),
    );
  }, [id, isNew, opened]);

  /**
   * Keeps the latest saved version for reopening without a reload. A new document moves to ?doc=ID through
   * the History API, which Next.js syncs with useSearchParams without fetching anything from the server.
   * A save can finish after the user has left the creator; it must not bring them back.
   */
  function handleSaved(savedId: number, document: SavedDocument) {
    if (!mounted.current) return;
    setOpened({ id: savedId, document });
    if (savedId === id) return;
    setView((current) => ({ ...current, createdId: savedId }));
    window.history.replaceState(null, "", `?doc=${savedId}`);
  }

  if (param !== null && id === null) return <CouldNotOpen />;
  if (isNew) return <DocumentCreator key={`new-${view.newKey}`} documentTypes={documentTypes} onSaved={handleSaved} />;
  if (opened?.id !== id) return <LoadingState label="Opening your document…" />;
  if (!opened.document) return <CouldNotOpen />;
  return (
    <DocumentCreator
      key={id}
      documentTypes={documentTypes}
      initialId={id}
      initial={opened.document}
      onSaved={handleSaved}
    />
  );
}

function CouldNotOpen() {
  return (
    <div className={`mx-auto max-w-lg p-8 text-center ${cardClass}`}>
      <h2 className="text-lg font-semibold text-brand-navy">This document could not be opened</h2>
      <p className="mt-2 text-sm text-stone-600">It may have been removed, or it belongs to another account.</p>
      <p className="mt-4 text-sm">
        <Link href="/documents/" className={textLinkClass}>
          Back to My documents
        </Link>
      </p>
    </div>
  );
}
