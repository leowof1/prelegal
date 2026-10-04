import { NdaCreator } from "@/components/nda/NdaCreator";
import { loadNdaTemplate } from "@/lib/nda/template";

export default function Home() {
  // Runs at build time: the page is statically rendered from the repo's templates.
  const template = loadNdaTemplate();

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Prelegal</p>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Mutual NDA Creator</h1>
        <p className="max-w-2xl text-stone-600">
          Fill in the key terms and see the Common Paper Mutual Non-Disclosure Agreement update as you type. When
          you&apos;re done, download it as a PDF ready to sign.
        </p>
      </header>
      <NdaCreator template={template} />
    </main>
  );
}
