"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useUser } from "@/lib/session/user";

const LINKS = [
  { href: "/create/", label: "New document" },
  { href: "/documents/", label: "My documents" },
];

const focusClass = "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow";

/** The signed-in navigation: the main pages, who is signed in and a way to sign out. */
export function UserMenu() {
  const user = useUser();
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white">
      <nav aria-label="Main" className="flex gap-1">
        {LINKS.map(({ href, label }) => {
          const current = pathname.replace(/\/?$/, "/") === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 font-medium hover:bg-white/10 ${current ? "bg-white/15" : ""} ${focusClass}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {user && (
        <div className="flex items-center gap-4">
          <span className="hidden md:inline" title={user.email}>
            {user.name}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className={`rounded-md border border-white/40 px-3 py-1.5 font-medium hover:bg-white/10 ${focusClass}`}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
