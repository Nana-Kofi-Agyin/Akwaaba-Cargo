"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  detectGhanaNetwork,
  formatGhs,
  normalizeGhanaPhone,
} from "@/lib/format";
import type { ListingStatus } from "@/types/database";

type ListingOrderSectionProps = {
  listingId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  pricePesewas: number;
  fullPricePesewas: number | null;
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

  if (days > 0) return `${days}d ${hours}h ${minutes}m left`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s left`;
  return `${minutes}m ${seconds}s left`;
}

const NETWORK_BADGE: Record<"MTN" | "Telecel" | "AT", string> = {
  MTN: "bg-[#ffcc00] text-slate-950",
  Telecel: "bg-[#e60000] text-white",
  AT: "bg-[#0057b8] text-white",
};

export function ListingOrderSection({
  listingId,
  title,
  description,
  imageUrl,
  pricePesewas,
  fullPricePesewas,
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

  const hasSplitBalance =
    fullPricePesewas !== null && fullPricePesewas > pricePesewas;
  const unitFullPesewas = hasSplitBalance ? fullPricePesewas : pricePesewas;
  const unitBalancePesewas = hasSplitBalance
    ? fullPricePesewas - pricePesewas
    : 0;

  const depositTotalPesewas = qty * pricePesewas;
  const balanceTotalPesewas = qty * unitBalancePesewas;
  const fullTotalPesewas = qty * unitFullPesewas;
  const detectedNetwork = detectGhanaNetwork(buyerPhone);

  useEffect(() => {
    if (status !== "open") return;

    const update = () => {
      setRemainingMs(Math.max(0, deadlineMs - Date.now()));
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

      window.location.href = data.authorization_url;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Countdown Strip */}
      <div
        className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-xs ${
          isClosed
            ? "border border-red-200 bg-red-50 text-red-800"
            : "border border-amber-200/80 bg-amber-50/90 text-amber-950"
        }`}
      >
        <span className="font-semibold">
          {isClosed ? "Pre-order closed" : "Order deadline"}
        </span>
        <span className="font-bold tabular-nums">
          {status !== "open"
            ? status === "closed"
              ? "Closed by organizer"
              : `Batch status: ${status}`
            : formatCountdown(remainingMs)}
        </span>
      </div>

      {/* Product Card with Deposit-Now / Balance-Later Breakdown */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        <div className="flex gap-3.5">
          {imageUrl && (
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={title}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-snug text-slate-900">
              {title}
            </h2>

            {description && (
              <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                {description}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="text-lg font-extrabold text-slate-900">
                {formatGhs(unitFullPesewas)}
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                {hasSplitBalance ? "total / unit" : "per unit"}
              </span>
            </div>
          </div>
        </div>

        {/* Deposit-now / Balance-later inset box + qty stepper */}
        <div className="mt-3.5 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
          <div className="min-w-0 text-xs">
            <p className="font-semibold text-amber-800">Deposit Due Now:</p>
            <p className="mt-0.5 text-sm font-extrabold text-slate-900">
              {formatGhs(pricePesewas)}{" "}
              <span className="text-xs font-normal text-slate-500">/ unit</span>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-600">
              {hasSplitBalance
                ? `Balance: ${formatGhs(unitBalancePesewas)} on pickup`
                : "Balance on pickup: GH₵ 0.00 (full payment)"}
            </p>
          </div>

          {!isClosed && (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={submitting || qty <= 1}
                aria-label="Decrease quantity"
                onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-base font-bold text-slate-800 ring-1 ring-slate-300 active:bg-slate-100 disabled:opacity-40"
              >
                -
              </button>
              <input
                id="qty"
                type="number"
                inputMode="numeric"
                aria-label="Quantity"
                min={1}
                max={1000}
                step={1}
                disabled={submitting}
                value={qty}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  setQty(
                    Number.isNaN(val) ? 1 : Math.min(1000, Math.max(1, val))
                  );
                }}
                className="h-10 w-12 rounded-lg bg-white text-center text-base font-bold text-slate-900 ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0f6b47]"
              />
              <button
                type="button"
                disabled={submitting || qty >= 1000}
                aria-label="Increase quantity"
                onClick={() => setQty((prev) => Math.min(1000, prev + 1))}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-base font-bold text-slate-800 ring-1 ring-slate-300 active:bg-slate-100 disabled:opacity-40"
              >
                +
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Closed State OR Buyer Form + Live Total */}
      {isClosed ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <p className="text-base font-bold text-slate-900">
            This pre-order batch is closed
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {isExpired
              ? "The order deadline has passed. You can still follow delivery updates on the tracking page."
              : "The organizer is no longer accepting new reservations. Follow progress on the tracking page."}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Buyer Details Card */}
          <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Buyer Details
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                No account needed. Just your name and Ghanaian phone number for
                MoMo &amp; SMS updates.
              </p>
            </div>

            <div>
              <label
                htmlFor="buyerName"
                className="block text-xs font-semibold text-slate-700"
              >
                Full Name
              </label>
              <input
                id="buyerName"
                type="text"
                required
                autoComplete="name"
                disabled={submitting}
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="e.g. Abena Asantewaa"
                className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-[#0f6b47] focus:outline-none focus:ring-2 focus:ring-[#0f6b47]/20 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label
                htmlFor="buyerPhone"
                className="block text-xs font-semibold text-slate-700"
              >
                WhatsApp &amp; MoMo Number (For SMS Alerts)
              </label>
              <div className="mt-1.5 flex items-center rounded-xl border border-slate-300 bg-white px-3 focus-within:border-[#0f6b47] focus-within:ring-2 focus-within:ring-[#0f6b47]/20">
                <span className="mr-2 shrink-0 border-r border-slate-200 pr-2.5 text-sm font-semibold text-slate-700">
                  +233
                </span>
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
                  className="block w-full bg-transparent py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
                />
                {detectedNetwork && (
                  <span
                    className={`ml-2 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${NETWORK_BADGE[detectedNetwork]}`}
                  >
                    {detectedNetwork}
                  </span>
                )}
              </div>
            </div>

            {/* Truthful Trust Callout */}
            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3.5">
              <p className="text-xs font-bold text-[#0f6b47]">
                Paid securely via Paystack
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-700">
                Refunded automatically if the minimum quantity is not reached.
              </p>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>

          {/* Live Total & Pay CTA Card */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <div className="text-xs text-slate-600">
                <p>
                  Total Selected:{" "}
                  <span className="font-bold text-slate-900">
                    {qty} {qty === 1 ? "unit" : "units"}
                  </span>
                </p>
                {hasSplitBalance ? (
                  <p className="mt-0.5">
                    Total Value:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatGhs(fullTotalPesewas)}
                    </span>{" "}
                    · Balance on pickup:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatGhs(balanceTotalPesewas)}
                    </span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-slate-500">
                    Full payment · No balance on pickup
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Deposit Due Now
                </p>
                <p className="text-xl font-extrabold text-slate-950">
                  {formatGhs(depositTotalPesewas)}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#071527] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 active:bg-slate-950 disabled:opacity-60"
            >
              {submitting
                ? "Opening Paystack Mobile Money..."
                : `Reserve & Pay MoMo Deposit (${formatGhs(depositTotalPesewas)})`}
            </button>

            <p className="text-center text-[11px] text-slate-500">
              Paid securely via Paystack · Instant SMS updates via Arkesel
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
