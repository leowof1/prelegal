import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireUser } from "@/components/auth/RequireUser";
import { DocumentWorkspace } from "@/components/document/DocumentWorkspace";
import { AppHeader } from "@/components/layout/AppHeader";
import { UserMenu } from "@/components/layout/UserMenu";
import { LoadingState } from "@/components/ui/LoadingState";
import { loadDocumentTypes } from "@/lib/document/template";

export const metadata: Metadata = {
  title: "Document Creator | Prelegal",
  description: "Draft Common Paper legal agreements, from NDAs to cloud service agreements, with an AI assistant.",
};

export default function CreatePage() {
  // Runs at build time: the page is statically rendered from the repo's templates.
  const documentTypes = loadDocumentTypes();

  return (
    <>
      <AppHeader>
        <UserMenu />
      </AppHeader>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-brand-navy">Document Creator</h1>
          <p className="max-w-2xl text-stone-600">
            Tell the AI assistant what agreement you need and watch the Common Paper document fill in as you chat. Your
            work is saved to My documents as you go, and you can download it as a PDF.
          </p>
        </div>
        <RequireUser>
          {/* ?doc= is only known in the browser: the workspace renders there, below this boundary. */}
          <Suspense fallback={<LoadingState label="Loading…" />}>
            <DocumentWorkspace documentTypes={documentTypes} />
          </Suspense>
        </RequireUser>
      </main>
    </>
  );
}
