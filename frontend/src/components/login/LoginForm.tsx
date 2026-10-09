"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { signIn } from "@/lib/session/user";
import { inputClass, submitButtonClass } from "@/components/ui/styles";

/** A placeholder sign-in form: any name and email are accepted, no account is checked. */
export function LoginForm() {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    signIn({ name: String(data.get("name")).trim(), email: String(data.get("email")).trim() });
    router.push("/nda/");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1">
        <label htmlFor="name" className="block text-sm font-medium text-stone-800">
          Name
        </label>
        <input id="name" name="name" autoComplete="name" required className={inputClass} />
      </div>
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-stone-800">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </div>
      <button
        type="submit"
        className={`w-full ${submitButtonClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2`}
      >
        Sign in
      </button>
    </form>
  );
}
