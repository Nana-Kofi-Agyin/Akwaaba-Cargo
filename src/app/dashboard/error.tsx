"use client";

import Link from "next/link";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-white p-6 text-center">
      <h2 className="text-base font-bold text-stone-900">
        Could not load your dashboard
      </h2>
      <p className="mt-1 text-xs text-stone-600">
        Check your internet connection and try again.
      </p>
      <div className="mt-4 flex justify-center gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-[#0f6b47] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0a5236]"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          Back to batches
        </Link>
      </div>
    </div>
  );
}
