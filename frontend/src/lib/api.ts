import { markSignedOut } from "@/lib/session/user";

/**
 * Calls the JSON API. Throws on an error response; a 401 also signs the user out,
 * e.g. after a server restart has reset the database.
 */
export async function apiFetch<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401) markSignedOut();
  if (!response.ok) throw new Error(`${method} ${path} failed: ${response.status}`);
  return response.status === 204 ? (undefined as T) : response.json();
}
