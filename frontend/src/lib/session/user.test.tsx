/** @vitest-environment jsdom */
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { signIn, signOut, useUser } from "./user";

function WhoAmI() {
  const user = useUser();
  return <p>{user ? `${user.name} <${user.email}>` : "signed out"}</p>;
}

afterEach(() => localStorage.clear());

describe("user session", () => {
  it("is signed out by default", () => {
    render(<WhoAmI />);
    expect(screen.getByText("signed out")).toBeInTheDocument();
  });

  it("updates subscribers on sign in and sign out", () => {
    render(<WhoAmI />);
    act(() => signIn({ name: "Ada Lovelace", email: "ada@acme.test" }));
    expect(screen.getByText("Ada Lovelace <ada@acme.test>")).toBeInTheDocument();
    act(() => signOut());
    expect(screen.getByText("signed out")).toBeInTheDocument();
  });

  it("persists the user across page loads", () => {
    signIn({ name: "Ada Lovelace", email: "ada@acme.test" });
    render(<WhoAmI />);
    expect(screen.getByText("Ada Lovelace <ada@acme.test>")).toBeInTheDocument();
  });

  it("renders signed out on the server so prerendered HTML has no user", () => {
    signIn({ name: "Ada Lovelace", email: "ada@acme.test" });
    expect(renderToString(<WhoAmI />)).toContain("signed out");
  });
});
