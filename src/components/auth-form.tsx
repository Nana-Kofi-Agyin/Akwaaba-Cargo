"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (data.session) {
          router.push("/onboarding");
          router.refresh();
          return;
        }

        setNotice(
          "Account created! Check your email to confirm your address, then sign in."
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }

        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <Link href="/">
          <BrandLogo />
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-stone-900">
          {isSignup ? "Create importer account" : "Importer sign in"}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {isSignup
            ? "Start running China-to-Ghana pre-order batches."
            : "Sign in to manage your pre-order batches and orders."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignup ? "At least 6 characters" : "Your password"}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        {notice && (
          <p className="rounded-lg bg-teal-50 px-3.5 py-2.5 text-sm text-teal-800">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-teal-700 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
        >
          {loading
            ? isSignup
              ? "Creating account..."
              : "Signing in..."
            : isSignup
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-teal-700 hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            New importer?{" "}
            <Link
              href="/signup"
              className="font-semibold text-teal-700 hover:underline"
            >
              Create an account
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
