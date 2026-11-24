"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatGhs, normalizeGhanaPhone } from "@/lib/format";
import type { ListingStatus } from "@/types/database";

type ListingOrderSectionProps = {
  listingId: string;
  pricePesewas: number;
  deadline: string;
  status: ListingStatus;
  initialRemainingMs: number;
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Deadline passed";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m left`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s left`;
  }
  return `${minutes}m ${seconds}s left`;
}

export function ListingOrderSection({
  listingId,
  pricePesewas,
  deadline,
  status,
  initialRemainingMs,
}: ListingOrderSectionProps) {
  const [remainingMs, setRemainingMs] = useState(initialRemainingMs);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const deadlineMs = new Date(deadline).getTime();
  const isExpired = remainingMs <= 0;
  const isClosed = status !== "open" || isExpired;

  useEffect(() => {
    if (status !== "open") return;

    const update = () => {
      const next = Math.max(0, deadlineMs - Date.now());
      setRemainingMs(next);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadlineMs, status]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (isClosed) {
      setError("This pre-order batch is closed.");
      return;
    }

    const trimmedName = buyerName.trim();
    if (trimmedName.length < 2) {
      setError("Please enter your full name.");
      return;
    }

    const normalizedPhone = normalizeGhanaPhone(buyerPhone);
    if (!normalizedPhone) {
      setError(
        "Enter a valid Ghanaian phone number (e.g. 024 123 4567 or +233 24 123 4567)."
      );
      return;
    }

    if (!Number.isInteger(qty) || qty < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          buyerName: trimmedName,
          buyerPhone: normalizedPhone,
          qty,
        }),
      });

      const data = (await res.json()) as {
        authorization_url?: string;
        error?: string;
      };

      if (!res.ok || !data.authorization_url) {
        setError(
          data.error || "Could not start Mobile Money payment. Please try again."
        );
        setSubmitting(false);
        return;
      }

      // Redirect buyer to Paystack Mobile Money checkout
      window.location.href = data.authorization_url;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  const totalPesewas = qty * pricePesewas;

  return (
    <div className="space-y-4">
      {/* Deadline bar */}
      <div
        className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
          isClosed
            ? "border border-red-200 bg-red-50 text-red-800"
            : "border border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        <span className="font-medium">
          {isClosed ? "Pre-order closed" : "Closes in"}
        </span>
        <span className="font-bold tabular-nums">
          {status !== "open"
            ? status === "closed"
              ? "Closed by importer"
              : `Status: ${status}`
            : formatCountdown(remainingMs)}
        </span>
      </div>

      {/* Closed state */}
      {isClosed ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
          <p className="text-base font-bold text-gray-900">
            This pre-order batch is closed
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {isExpired
              ? "The order deadline for this batch has passed. Contact the importer in your WhatsApp group for the next batch."
              : "The importer is no longer accepting new reservations for this batch."}
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-5"
        >
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Reserve your slot
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              No account needed. Pay deposit with Mobile Money and get SMS
              updates.
            </p>
          </div>

          <div>
            <label
              htmlFor="buyerName"
              className="block text-sm font-medium text-gray-700"
            >
              Your name
            </label>
            <input
              id="buyerName"
              type="text"
              required
              autoComplete="name"
              disabled={submitting}
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="e.g. Kwame Mensah"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 disabled:bg-gray-50"
            />
          </div>

          <div>
            <label
              htmlFor="buyerPhone"
              className="block text-sm font-medium text-gray-700"
            >
              Phone number (Ghana)
            </label>
            <input
              id="buyerPhone"
              type="tel"
              inputMode="tel"
              required
              autoComplete="tel"
              disabled={submitting}
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder="024 123 4567"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 disabled:bg-gray-50"
            />
            <p className="mt-1 text-xs text-gray-500">
              Used for Mobile Money &amp; SMS batch updates.
            </p>
          </div>

          <div>
            <label
              htmlFor="qty"
              className="block text-sm font-medium text-gray-700"
            >
              Quantity
            </label>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                aria-label="Decrease quantity"
                onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-gray-50 text-lg font-bold text-gray-800 active:bg-gray-200 disabled:opacity-50"
              >
                -
              </button>
              <input
                id="qty"
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                step={1}
                required
                disabled={submitting}
                value={qty}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  setQty(Number.isNaN(val) ? 1 : Math.min(1000, Math.max(1, val)));
                }}
                className="h-12 w-full rounded-lg border border-gray-300 px-3 text-center text-base font-semibold text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 disabled:bg-gray-50"
              />
              <button
                type="button"
                disabled={submitting}
                aria-label="Increase quantity"
                onClick={() => setQty((prev) => Math.min(1000, prev + 1))}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-gray-50 text-lg font-bold text-gray-800 active:bg-gray-200 disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
            <span className="text-gray-600">Total to pay</span>
            <span className="text-lg font-bold text-gray-900">
              {formatGhs(totalPesewas)}
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-teal-700 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-teal-800 active:bg-teal-900 disabled:opacity-60"
          >
            {submitting
              ? "Opening Mobile Money..."
              : `Pay ${formatGhs(totalPesewas)} with MoMo`}
          </button>
        </form>
      )}
    </div>
  );
}
