"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <BrandLogo />
      <h1 className="mt-4 text-xl font-bold text-stone-900">
        Something went wrong
      </h1>
      <p className="mt-1.5 text-sm text-stone-600">
        Your connection may have dropped or the server hit a hiccup. Please try
        again.
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-xl bg-[#0f6b47] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0a5236]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-50"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
