import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { AppHeader } from "@/components/layout/AppHeader";

export const metadata: Metadata = {
  title: "Sign in | Prelegal",
};

const FEATURES = [
  "Describe what you need and the AI assistant picks the right agreement.",
  "Watch the document fill in as you chat, then download a ready-to-review PDF.",
  "Eleven trusted Common Paper templates, from NDAs to cloud service agreements.",
];

export default function SignInPage() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm md:grid-cols-2">
          <section aria-label="About Prelegal" className="hidden bg-brand-navy p-10 text-white md:block">
            <h2 className="text-2xl font-bold tracking-tight">
              Draft legal agreements in minutes<span className="text-brand-yellow">.</span>
            </h2>
            <ul className="mt-8 space-y-5 text-sm text-white/90">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex gap-3">
                  <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="size-5 shrink-0 text-brand-yellow">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </section>
          <div className="p-8 sm:p-10">
            <AuthForm />
          </div>
        </div>
      </main>
    </>
  );
}
