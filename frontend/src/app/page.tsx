import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { LoginForm } from "@/components/login/LoginForm";

export const metadata: Metadata = {
  title: "Sign in | Prelegal",
};

export default function LoginPage() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 items-start justify-center px-4 py-16">
        <div className="w-full max-w-sm space-y-6 rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-brand-navy">Sign in</h1>
            <p className="text-sm text-stone-600">Draft common legal agreements from trusted templates.</p>
          </div>
          <LoginForm />
        </div>
      </main>
    </>
  );
}
