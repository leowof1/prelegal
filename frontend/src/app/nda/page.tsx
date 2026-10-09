import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { UserMenu } from "@/components/layout/UserMenu";
import { NdaCreator } from "@/components/nda/NdaCreator";
import { loadNdaTemplate } from "@/lib/nda/template";

export const metadata: Metadata = {
  title: "Mutual NDA Creator | Prelegal",
  description: "Create a Mutual Non-Disclosure Agreement from the Common Paper standard terms.",
};

export default function NdaPage() {
  // Runs at build time: the page is statically rendered from the repo's templates.
  const template = loadNdaTemplate();

  return (
    <>
      <AppHeader>
        <UserMenu />
      </AppHeader>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-brand-navy">Mutual NDA Creator</h1>
          <p className="max-w-2xl text-stone-600">
            Fill in the key terms and see the Common Paper Mutual Non-Disclosure Agreement update as you type. When
            you&apos;re done, download it as a PDF ready to sign.
          </p>
        </div>
        <NdaCreator template={template} />
      </main>
    </>
  );
}
