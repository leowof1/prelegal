/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useUser } from "@/lib/session/user";
import { RequireUser } from "./RequireUser";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/session/user", () => ({ useUser: vi.fn() }));

const renderGuarded = () => render(<RequireUser>secret</RequireUser>);

describe("RequireUser", () => {
  it("shows the content to a signed-in user", () => {
    vi.mocked(useUser).mockReturnValue({ id: 1, name: "Ada", email: "ada@acme.test" });
    renderGuarded();
    expect(screen.getByText("secret")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows a loading state while the session is checked", () => {
    vi.mocked(useUser).mockReturnValue(undefined);
    renderGuarded();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to the sign-in screen", () => {
    vi.mocked(useUser).mockReturnValue(null);
    renderGuarded();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/");
  });
});
