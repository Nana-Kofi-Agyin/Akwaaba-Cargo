"use client";

import { BrandLogo } from "@/components/brand-logo";

export default function PublicListingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <BrandLogo />
      <h1 className="mt-4 text-xl font-bold text-stone-900">
        Could not load this pre-order batch
      </h1>
      <p className="mt-1.5 text-sm text-stone-600">
        Your mobile connection may be slow or interrupted. Tap below to reload.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 w-full max-w-xs rounded-xl bg-[#0f6b47] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0a5236]"
      >
        Reload batch
      </button>
    </main>
  );
}
