import { useSyncExternalStore } from "react";

/** The signed-in user, as the backend's session cookie identifies them. */
export type User = { id: number; name: string; email: string };

/** undefined until the backend has been asked who is signed in. */
let current: User | null | undefined;
let checking = false;
const listeners = new Set<() => void>();

function setUser(user: User | null) {
  current = user;
  listeners.forEach((listener) => listener());
}

/** Forgets the user, e.g. when the API rejects the session. */
export function markSignedOut() {
  setUser(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (current === undefined && !checking) {
    checking = true;
    // If the check fails (e.g. the backend is down), show the sign-in screen rather than loading forever.
    fetch("/api/auth/me")
      .then(async (response) => setUser(response.ok ? await response.json() : null))
      .catch(() => setUser(null))
      .finally(() => (checking = false));
  }
  return () => listeners.delete(listener);
}

/** The signed-in user, null when signed out, undefined while loading and during prerendering. */
export function useUser(): User | null | undefined {
  return useSyncExternalStore(subscribe, () => current, () => undefined);
}

async function authenticate(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Please check your details and try again.");
  }
  setUser(data);
}

/** Creates an account and signs it in; throws with a message to show on failure. */
export function signUp(name: string, email: string, password: string) {
  return authenticate("/api/auth/signup", { name, email, password });
}

/** Signs in; throws with a message to show on failure. */
export function signIn(email: string, password: string) {
  return authenticate("/api/auth/signin", { email, password });
}

export async function signOut() {
  await fetch("/api/auth/signout", { method: "POST" });
  setUser(null);
}
