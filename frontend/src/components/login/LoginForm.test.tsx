/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  localStorage.clear();
  push.mockReset();
});

describe("LoginForm", () => {
  it("records the user and enters the platform", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Name"), "  Ada Lovelace ");
    await user.type(screen.getByLabelText("Email"), "ada@acme.test");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(JSON.parse(localStorage.getItem("prelegal.user")!)).toEqual({
      name: "Ada Lovelace",
      email: "ada@acme.test",
    });
    expect(push).toHaveBeenCalledWith("/nda/");
  });

  it("requires a name and a valid email", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByLabelText("Name")).toBeInvalid();
    expect(screen.getByLabelText("Email")).toBeInvalid();
    expect(push).not.toHaveBeenCalled();
    expect(localStorage.getItem("prelegal.user")).toBeNull();
  });
});
