"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { signIn, signUp, useUser } from "@/lib/session/user";
import { inputClass, labelClass, submitButtonClass, textLinkClass } from "@/components/ui/styles";

type Mode = "signin" | "signup";

const COPY = {
  signin: {
    title: "Sign in",
    intro: "Welcome back. Sign in to pick up your drafts.",
    submit: "Sign in",
    pending: "Signing in…",
    switchPrompt: "New to Prelegal?",
    switchLabel: "Create an account",
  },
  signup: {
    title: "Create your account",
    intro: "Draft your first agreement in minutes.",
    submit: "Create account",
    pending: "Creating account…",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in instead",
  },
};

/** Sign-in and sign-up in one form; a signed-in user is sent on into the platform. */
export function AuthForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const user = useUser();
  const router = useRouter();
  const copy = COPY[mode];

  useEffect(() => {
    if (user) router.replace(mode === "signup" ? "/create/" : "/documents/");
  }, [user, mode, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim();
    const password = String(data.get("password"));
    setPending(true);
    setError(null);
    try {
      if (mode === "signup") await signUp(String(data.get("name")).trim(), email, password);
      else await signIn(email, password);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  function switchMode() {
    setMode(mode === "signin" ? "signup" : "signin");
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-brand-navy">{copy.title}</h1>
        <p className="text-sm text-stone-600">{copy.intro}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        {mode === "signup" && (
          <div className="space-y-1">
            <label htmlFor="name" className={labelClass}>
              Full name
            </label>
            <input id="name" name="name" autoComplete="name" required className={inputClass} />
          </div>
        )}
        <div className="space-y-1">
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={mode === "signup" ? 8 : undefined}
            aria-describedby={mode === "signup" ? "password-hint" : undefined}
            required
            className={inputClass}
          />
          {mode === "signup" && (
            <p id="password-hint" className="text-xs text-stone-600">
              At least 8 characters.
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className={`w-full ${submitButtonClass} disabled:opacity-60`}>
          {pending ? copy.pending : copy.submit}
        </button>
      </form>
      <p className="text-center text-sm text-stone-600">
        {copy.switchPrompt}{" "}
        <button type="button" onClick={switchMode} className={textLinkClass}>
          {copy.switchLabel}
        </button>
      </p>
    </div>
  );
}
