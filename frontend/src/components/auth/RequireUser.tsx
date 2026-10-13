"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useUser } from "@/lib/session/user";
import { LoadingState } from "@/components/ui/LoadingState";

/** Shows its children only to a signed-in user; sends everyone else to the sign-in screen. */
export function RequireUser({ children }: { children: ReactNode }) {
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user === null) router.replace("/");
  }, [user, router]);

  return user ? children : <LoadingState label="Loading…" />;
}
