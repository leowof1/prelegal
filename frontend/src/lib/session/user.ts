import { useSyncExternalStore } from "react";

/** The signed-in user. There is no real authentication yet: the login screen just records who you are. */
export type User = { name: string; email: string };

const STORAGE_KEY = "prelegal.user";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function signIn(user: User) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  notify();
}

export function signOut() {
  localStorage.removeItem(STORAGE_KEY);
  notify();
}

/** The stored user as a raw string; a string snapshot is stable between renders. */
function snapshot() {
  return localStorage.getItem(STORAGE_KEY);
}

/** The signed-in user, or null when signed out and during prerendering. */
export function useUser(): User | null {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  return raw ? (JSON.parse(raw) as User) : null;
}
