/** The site footer: what Prelegal is and where its templates come from. */
export function AppFooter() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-stone-600 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <p>
          <span className="font-semibold text-brand-navy">Prelegal</span> drafts agreements with AI. It does not give
          legal advice.
        </p>
        <p>
          Templates by{" "}
          <a
            href="https://github.com/CommonPaper"
            className="underline underline-offset-2 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
          >
            Common Paper
          </a>
          , licensed under CC BY 4.0.
        </p>
      </div>
    </footer>
  );
}
