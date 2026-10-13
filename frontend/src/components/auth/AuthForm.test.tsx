/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signIn, signUp, useUser } from "@/lib/session/user";
import { AuthForm } from "./AuthForm";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/session/user", () => ({ useUser: vi.fn(), signIn: vi.fn(), signUp: vi.fn() }));

const ADA = { id: 1, name: "Ada Lovelace", email: "ada@acme.test" };

beforeEach(() => {
  vi.mocked(useUser).mockReturnValue(null);
});

function setup() {
  const user = userEvent.setup();
  const view = render(<AuthForm />);
  return { user, ...view };
}

describe("AuthForm", () => {
  it("signs in with email and password", async () => {
    const { user } = setup();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), " ada@acme.test ");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signIn).toHaveBeenCalledWith("ada@acme.test", "correct horse");
  });

  it("switches to sign-up and creates an account", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Full name"), " Ada Lovelace ");
    await user.type(screen.getByLabelText("Email"), "ada@acme.test");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(signUp).toHaveBeenCalledWith("Ada Lovelace", "ada@acme.test", "correct horse");
  });

  it("asks for a password of at least 8 characters for a new account", async () => {
    const { user } = setup();
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("minlength");
    await user.click(screen.getByRole("button", { name: "Create an account" }));

    expect(screen.getByLabelText("Password")).toHaveAttribute("minlength", "8");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("At least 8 characters.");
  });

  it("shows why signing in failed and lets the user retry", async () => {
    vi.mocked(signIn).mockRejectedValueOnce(new Error("Incorrect email or password"));
    const { user } = setup();
    await user.type(screen.getByLabelText("Email"), "ada@acme.test");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends a returning user to their documents and a new user to the creator", async () => {
    vi.mocked(useUser).mockReturnValue(ADA);
    const { unmount } = setup();
    expect(replace).toHaveBeenLastCalledWith("/documents/");
    unmount();

    vi.mocked(useUser).mockReturnValue(null);
    const { user, rerender } = setup();
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    vi.mocked(useUser).mockReturnValue(ADA);
    rerender(<AuthForm />);
    expect(replace).toHaveBeenLastCalledWith("/create/");
  });
});
