/** @vitest-environment jsdom */
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ADA = { id: 1, name: "Ada Lovelace", email: "ada@acme.test" };

/** A fresh copy of the module, so each test starts before the session check. */
async function loadSession() {
  vi.resetModules();
  const session = await import("./user");
  function WhoAmI() {
    const user = session.useUser();
    return <p>{user === undefined ? "loading" : user ? `${user.name} <${user.email}>` : "signed out"}</p>;
  }
  return { ...session, WhoAmI };
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  stubFetch(() => Response.json(null));
});

describe("user session", () => {
  it("asks the backend who is signed in, once", async () => {
    const fetchMock = stubFetch(() => Response.json(ADA));
    const { WhoAmI } = await loadSession();
    render(
      <>
        <WhoAmI />
        <WhoAmI />
      </>,
    );

    expect(screen.getAllByText("loading")).toHaveLength(2);
    expect(await screen.findAllByText("Ada Lovelace <ada@acme.test>")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me");
  });

  it("is signed out when the backend has no session", async () => {
    const { WhoAmI } = await loadSession();
    render(<WhoAmI />);
    expect(await screen.findByText("signed out")).toBeInTheDocument();
  });

  it("treats a failed session check as signed out", async () => {
    stubFetch(() => new Response("<h1>Bad gateway</h1>", { status: 502 }));
    const { WhoAmI } = await loadSession();
    render(<WhoAmI />);
    expect(await screen.findByText("signed out")).toBeInTheDocument();
  });

  it("signs in, updating subscribers, and signs out", async () => {
    const { WhoAmI, signIn, signOut } = await loadSession();
    render(<WhoAmI />);
    await screen.findByText("signed out");

    const fetchMock = stubFetch(() => Response.json(ADA));
    await act(() => signIn("ada@acme.test", "correct horse"));
    expect(screen.getByText("Ada Lovelace <ada@acme.test>")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/signin");
    expect(JSON.parse(init!.body as string)).toEqual({ email: "ada@acme.test", password: "correct horse" });

    stubFetch(() => new Response(null, { status: 204 }));
    await act(() => signOut());
    expect(screen.getByText("signed out")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/auth/signout", { method: "POST" });
  });

  it("signs up with name, email and password", async () => {
    const { signUp } = await loadSession();
    const fetchMock = stubFetch(() => Response.json(ADA, { status: 201 }));
    await signUp("Ada Lovelace", "ada@acme.test", "correct horse");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/signup");
    expect(JSON.parse(init!.body as string)).toEqual({ name: "Ada Lovelace", email: "ada@acme.test", password: "correct horse" });
  });

  it("throws the backend's message when authentication fails", async () => {
    const { signIn, signUp } = await loadSession();
    stubFetch(() => Response.json({ detail: "Incorrect email or password" }, { status: 401 }));
    await expect(signIn("ada@acme.test", "nope")).rejects.toThrow("Incorrect email or password");

    stubFetch(() => Response.json({ detail: [{ msg: "too short" }] }, { status: 422 }));
    await expect(signUp("Ada", "ada@acme.test", "x")).rejects.toThrow("Please check your details");
  });

  it("can be marked signed out, e.g. when the API rejects the session", async () => {
    stubFetch(() => Response.json(ADA));
    const { WhoAmI, markSignedOut } = await loadSession();
    render(<WhoAmI />);
    await screen.findByText("Ada Lovelace <ada@acme.test>");
    act(() => markSignedOut());
    expect(screen.getByText("signed out")).toBeInTheDocument();
  });

  it("renders as loading on the server so prerendered HTML has no user", async () => {
    const { WhoAmI } = await loadSession();
    expect(renderToString(<WhoAmI />)).toContain("loading");
  });
});
