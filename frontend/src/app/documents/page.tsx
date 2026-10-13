import type { Metadata } from "next";
import Link from "next/link";
import { RequireUser } from "@/components/auth/RequireUser";
import { DocumentList } from "@/components/documents/DocumentList";
import { AppHeader } from "@/components/layout/AppHeader";
import { UserMenu } from "@/components/layout/UserMenu";
import { submitButtonClass } from "@/components/ui/styles";

export const metadata: Metadata = {
  title: "My documents | Prelegal",
};

export default function DocumentsPage() {
  return (
    <>
      <AppHeader>
        <UserMenu />
      </AppHeader>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-brand-navy">My documents</h1>
            <p className="text-stone-600">Pick up any agreement where you left off.</p>
          </div>
          <Link href="/create/" className={submitButtonClass}>
            New document
          </Link>
        </div>
        <RequireUser>
          <DocumentList />
        </RequireUser>
      </main>
    </>
  );
}
