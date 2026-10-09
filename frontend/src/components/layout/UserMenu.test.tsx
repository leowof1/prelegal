/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signIn } from "@/lib/session/user";
import { UserMenu } from "./UserMenu";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  localStorage.clear();
  push.mockReset();
});

describe("UserMenu", () => {
  it("shows the signed-in user and signs out back to the login screen", async () => {
    signIn({ name: "Ada Lovelace", email: "ada@acme.test" });
    const user = userEvent.setup();
    render(<UserMenu />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(localStorage.getItem("prelegal.user")).toBeNull();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("links to the login screen when nobody is signed in", () => {
    render(<UserMenu />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/");
  });
});
