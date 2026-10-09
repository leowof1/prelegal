"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useUser } from "@/lib/session/user";

const buttonClass =
  "rounded-md border border-white/40 px-3 py-1.5 font-medium hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow";

/** Shows who is signed in with a way to sign out, or a way to sign in. */
export function UserMenu() {
  const user = useUser();
  const router = useRouter();

  if (!user) {
    return (
      <Link href="/" className={`text-sm text-white ${buttonClass}`}>
        Sign in
      </Link>
    );
  }

  function handleSignOut() {
    signOut();
    router.push("/");
  }

  return (
    <div className="flex items-center gap-4 text-sm text-white">
      <span className="hidden sm:inline">{user.name}</span>
      <button type="button" onClick={handleSignOut} className={buttonClass}>
        Sign out
      </button>
    </div>
  );
}
