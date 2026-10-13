/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { signOut, useUser } from "@/lib/session/user";
import { UserMenu } from "./UserMenu";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/documents/" }));
vi.mock("@/lib/session/user", () => ({ useUser: vi.fn(), signOut: vi.fn(async () => {}) }));

describe("UserMenu", () => {
  it("links to the main pages and marks the current one", () => {
    render(<UserMenu />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toContainElement(screen.getByRole("link", { name: "New document" }));
    expect(screen.getByRole("link", { name: "New document" })).toHaveAttribute("href", expect.stringMatching(/^\/create\/?$/));
    expect(screen.getByRole("link", { name: "My documents" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "New document" })).not.toHaveAttribute("aria-current");
  });

  it("shows the signed-in user and signs out back to the sign-in screen", async () => {
    vi.mocked(useUser).mockReturnValue({ id: 1, name: "Ada Lovelace", email: "ada@acme.test" });
    render(<UserMenu />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));

    expect(signOut).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shows no sign-out button while the user is loading", () => {
    vi.mocked(useUser).mockReturnValue(undefined);
    render(<UserMenu />);
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });
});
