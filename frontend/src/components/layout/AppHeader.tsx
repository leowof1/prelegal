import Link from "next/link";
import type { ReactNode } from "react";

/** The navy brand bar shown at the top of every page. */
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b-4 border-brand-yellow bg-brand-navy">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="rounded text-xl font-bold tracking-tight text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
        >
          Prelegal<span className="text-brand-yellow">.</span>
        </Link>
        {children}
      </div>
    </header>
  );
}
