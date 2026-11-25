"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  detectGhanaNetwork,
  formatGhs,
  normalizeGhanaPhone,
} from "@/lib/format";
import type { DeliveryMethod, ListingStatus } from "@/types/database";

type ListingOrderSectionProps = {
  listingId: string;
  title: string;
  description: string | null;
  photos: string[];
  pricePesewas: number;
  fullPricePesewas: number | null;
  maxQtyPerOrder: number | null;
  pickupLocation: string | null;
  deliveryFeePesewas: number | null;
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
  photos,
  pricePesewas,
  fullPricePesewas,
  maxQtyPerOrder,
  pickupLocation,
  deliveryFeePesewas,
  deadline,
  status,
  initialRemainingMs,
}: ListingOrderSectionProps) {
  const [remainingMs, setRemainingMs] = useState(initialRemainingMs);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [useSeparateMomo, setUseSeparateMomo] = useState(false);
  const [momoPhone, setMomoPhone] = useState("");
  const [qty, setQty] = useState(1);
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("pickup");
  const [termsAccepted, setTermsAccepted] = useState(false);
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

  const maxQty = maxQtyPerOrder ?? 1000;
  const deliveryAvailable = deliveryFeePesewas !== null;
  const activeDeliveryFee =
    deliveryAvailable && deliveryMethod === "delivery"
      ? deliveryFeePesewas
      : 0;

  const dueNowPesewas = qty * pricePesewas + activeDeliveryFee;
  const balanceTotalPesewas = qty * unitBalancePesewas;

  const whatsappNetwork = detectGhanaNetwork(buyerPhone);
  const momoNetwork = detectGhanaNetwork(momoPhone);
  const hasLongDescription = (description?.length ?? 0) > 110;
  const activePhoto = photos[activePhotoIdx] ?? null;

  const dueLabel = hasSplitBalance ? "Deposit Due Now" : "Total to pay";
  const ctaText = submitting
    ? "Opening Paystack Mobile Money..."
    : hasSplitBalance
      ? `Reserve & Pay MoMo Deposit (${formatGhs(dueNowPesewas)})`
      : `Reserve & Pay ${formatGhs(dueNowPesewas)}`;

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

    const normalizedWhatsapp = normalizeGhanaPhone(buyerPhone);
    if (!normalizedWhatsapp) {
      setError(
        "Enter a valid Ghanaian WhatsApp/SMS phone number (e.g. 024 123 4567)."
      );
      return;
    }

    let normalizedMomo: string | undefined;
    if (useSeparateMomo) {
      const parsedMomo = normalizeGhanaPhone(momoPhone);
      if (!parsedMomo) {
        setError(
          "Enter a valid Ghanaian Mobile Money number (e.g. 024 123 4567)."
        );
        return;
      }
      normalizedMomo = parsedMomo;
    }

    if (!Number.isInteger(qty) || qty < 1 || qty > maxQty) {
      setError(`Quantity must be between 1 and ${maxQty}.`);
      return;
    }

    if (!termsAccepted) {
      setError(
        "Please tick the terms and refund policy checkbox before paying."
      );
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
          buyerPhone: normalizedWhatsapp,
          momoPhone: normalizedMomo,
          qty,
          deliveryMethod: deliveryAvailable ? deliveryMethod : "pickup",
          termsAccepted: true,
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

      {/* Product Card: Photo Gallery + Tap-to-Zoom + Read More + Price/Qty */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        {activePhoto && (
          <div className="mb-3.5 space-y-2">
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100 text-left"
              aria-label="Tap to zoom product photo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhoto}
                alt={title}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
              <span className="absolute right-2.5 bottom-2.5 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
                Tap to zoom
              </span>
            </button>

            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {photos.map((photoUrl, idx) => (
                  <button
                    key={photoUrl}
                    type="button"
                    onClick={() => setActivePhotoIdx(idx)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${
                      idx === activePhotoIdx
                        ? "border-[#0f6b47]"
                        : "border-transparent opacity-70"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl}
                      alt={`${title} photo ${idx + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <h2 className="text-base font-bold leading-snug text-slate-900">
            {title}
          </h2>

          {description && (
            <div className="mt-1.5">
              <p
                className={`whitespace-pre-line text-xs leading-relaxed text-slate-600 ${
                  !descExpanded && hasLongDescription ? "line-clamp-2" : ""
                }`}
              >
                {description}
              </p>
              {hasLongDescription && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((prev) => !prev)}
                  className="mt-1 text-xs font-semibold text-[#0f6b47] hover:underline"
                >
                  {descExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}

          {hasSplitBalance && (
            <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-slate-900">
                {formatGhs(unitFullPesewas)}
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                full price / unit
              </span>
            </div>
          )}
        </div>

        {/* Price / Deposit breakdown + Qty stepper */}
        <div className="mt-3.5 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
          <div className="min-w-0 text-xs">
            <p className="font-semibold text-amber-800">
              {hasSplitBalance ? "Deposit Due Now:" : "Price per unit:"}
            </p>
            <p className="mt-0.5 text-sm font-extrabold text-slate-900">
              {formatGhs(pricePesewas)}{" "}
              <span className="text-xs font-normal text-slate-500">/ unit</span>
            </p>
            {hasSplitBalance && (
              <p className="mt-0.5 text-[11px] text-slate-600">
                Balance: {formatGhs(unitBalancePesewas)} on pickup
              </p>
            )}
            {maxQtyPerOrder !== null && (
              <p className="mt-0.5 text-[11px] text-slate-500">
                Max {maxQtyPerOrder} per order
              </p>
            )}
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
                max={maxQty}
                step={1}
                disabled={submitting}
                value={qty}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  setQty(
                    Number.isNaN(val) ? 1 : Math.min(maxQty, Math.max(1, val))
                  );
                }}
                className="h-10 w-12 rounded-lg bg-white text-center text-base font-bold text-slate-900 ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0f6b47]"
              />
              <button
                type="button"
                disabled={submitting || qty >= maxQty}
                aria-label="Increase quantity"
                onClick={() => setQty((prev) => Math.min(maxQty, prev + 1))}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-base font-bold text-slate-800 ring-1 ring-slate-300 active:bg-slate-100 disabled:opacity-40"
              >
                +
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Closed State OR Buyer Form */}
      {isClosed ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <p className="text-base font-bold text-slate-900">
            This pre-order batch is closed
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {isExpired
              ? "The order deadline has passed. You can still follow updates on the tracking page."
              : "The organizer is no longer accepting new reservations. Follow progress on the tracking page."}
          </p>
        </div>
      ) : (
        <form
          id="buyer-order-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {/* Delivery / Pickup Selector (when delivery option is configured) */}
          {deliveryAvailable && (
            <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <h2 className="text-sm font-bold text-slate-900">
                Pickup or Delivery
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setDeliveryMethod("pickup")}
                  className={`rounded-xl border p-3 text-left transition ${
                    deliveryMethod === "pickup"
                      ? "border-[#0f6b47] bg-emerald-50/60 ring-1 ring-[#0f6b47]"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">Pickup</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#0f6b47]">
                    Free
                  </p>
                  {pickupLocation && (
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      {pickupLocation}
                    </p>
                  )}
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setDeliveryMethod("delivery")}
                  className={`rounded-xl border p-3 text-left transition ${
                    deliveryMethod === "delivery"
                      ? "border-[#0f6b47] bg-emerald-50/60 ring-1 ring-[#0f6b47]"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">Delivery</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-amber-800">
                    {deliveryFeePesewas === 0
                      ? "Free"
                      : `+${formatGhs(deliveryFeePesewas)}`}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Added to total
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Buyer Details Card */}
          <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Buyer Details
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                No account needed. You&apos;ll receive SMS updates on your
                WhatsApp number.
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
                WhatsApp / SMS Number
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
                {whatsappNetwork && (
                  <span
                    className={`ml-2 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${NETWORK_BADGE[whatsappNetwork]}`}
                  >
                    {whatsappNetwork}
                  </span>
                )}
              </div>
            </div>

            {/* Optional separate MoMo number */}
            <div>
              <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={useSeparateMomo}
                  disabled={submitting}
                  onChange={(e) => setUseSeparateMomo(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-[#0f6b47]"
                />
                Use a different Mobile Money number for payment
              </label>

              {useSeparateMomo && (
                <div className="mt-2.5">
                  <label
                    htmlFor="momoPhone"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Mobile Money Number
                  </label>
                  <div className="mt-1 flex items-center rounded-xl border border-slate-300 bg-white px-3 focus-within:border-[#0f6b47] focus-within:ring-2 focus-within:ring-[#0f6b47]/20">
                    <span className="mr-2 shrink-0 border-r border-slate-200 pr-2.5 text-sm font-semibold text-slate-700">
                      +233
                    </span>
                    <input
                      id="momoPhone"
                      type="tel"
                      inputMode="tel"
                      required={useSeparateMomo}
                      disabled={submitting}
                      value={momoPhone}
                      onChange={(e) => setMomoPhone(e.target.value)}
                      placeholder="055 987 6543"
                      className="block w-full bg-transparent py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
                    />
                    {momoNetwork && (
                      <span
                        className={`ml-2 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${NETWORK_BADGE[momoNetwork]}`}
                      >
                        {momoNetwork}
                      </span>
                    )}
                  </div>
                </div>
              )}
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

            {/* Required Terms & Refund Policy Checkbox */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-700">
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                disabled={submitting}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#0f6b47]"
              />
              <span>
                I agree to the pre-order terms and refund policy (refunded
                automatically if the minimum quantity is not reached).
              </span>
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>

          {/* Inline Live Total Summary (visible on desktop & in scroll flow) */}
          <div className="hidden space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:block">
            <div className="flex items-end justify-between gap-3">
              <div className="text-xs text-slate-600">
                <p>
                  Total Selected:{" "}
                  <span className="font-bold text-slate-900">
                    {qty} {qty === 1 ? "unit" : "units"}
                  </span>
                  {activeDeliveryFee > 0 && (
                    <span> · Delivery: {formatGhs(activeDeliveryFee)}</span>
                  )}
                </p>
                {hasSplitBalance && (
                  <p className="mt-0.5">
                    Balance on pickup:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatGhs(balanceTotalPesewas)}
                    </span>
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  {dueLabel}
                </p>
                <p className="text-xl font-extrabold text-slate-950">
                  {formatGhs(dueNowPesewas)}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#071527] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 active:bg-slate-950 disabled:opacity-60"
            >
              {ctaText}
            </button>
          </div>
        </form>
      )}

      {/* Sticky Mobile Pay Bar */}
      {!isClosed && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-xs sm:hidden">
          <div className="mx-auto max-w-md space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-slate-600">
                {qty} {qty === 1 ? "unit" : "units"}
                {activeDeliveryFee > 0
                  ? ` + ${formatGhs(activeDeliveryFee)} delivery`
                  : ""}
                {hasSplitBalance
                  ? ` · Bal: ${formatGhs(balanceTotalPesewas)}`
                  : ""}
              </span>
              <span className="font-extrabold text-slate-950">
                <span className="mr-1 text-[10px] font-bold uppercase text-amber-800">
                  {dueLabel}:
                </span>
                {formatGhs(dueNowPesewas)}
              </span>
            </div>

            <button
              type="submit"
              form="buyer-order-form"
              disabled={submitting}
              className="w-full rounded-xl bg-[#071527] px-4 py-3 text-sm font-bold text-white active:bg-slate-950 disabled:opacity-60"
            >
              {ctaText}
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Tap-to-Zoom Photo Lightbox */}
      {zoomOpen && activePhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed product photo"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 p-4"
          onClick={() => setZoomOpen(false)}
        >
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            className="absolute top-4 right-4 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/25"
          >
            Close ✕
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activePhoto}
            alt={title}
            className="max-h-[80vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {photos.length > 1 && (
            <div
              className="mt-4 flex items-center gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() =>
                  setActivePhotoIdx(
                    (prev) => (prev - 1 + photos.length) % photos.length
                  )
                }
                className="rounded-lg bg-white/15 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/25"
              >
                ← Prev
              </button>
              <span className="text-xs font-medium text-white/80">
                {activePhotoIdx + 1} / {photos.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setActivePhotoIdx((prev) => (prev + 1) % photos.length)
                }
                className="rounded-lg bg-white/15 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/25"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
