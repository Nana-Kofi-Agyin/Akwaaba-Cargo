import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { formatGhs } from "@/lib/format";
import { BrandLogo } from "@/components/brand-logo";
import type { PaymentStatus } from "@/types/database";

export const dynamic = "force-dynamic";

const REFERENCE_REGEX = /^ac_\d+_[a-f0-9]{12}$/;

function maskPhone(phone: string): string {
  if (phone.length < 7) return "***";
  return `${phone.slice(0, 4)} *** ${phone.slice(-3)}`;
}

type SuccessPageProps = {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
};

export default async function OrderSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const params = await searchParams;
  const reference = (params.reference || params.trxref || "").trim();

  if (!reference || !REFERENCE_REGEX.test(reference)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 text-center">
        <p className="text-sm font-semibold text-teal-700">Akwaaba Cargo</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Missing payment reference
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          We couldn&apos;t find a payment reference in this link. Check your
          Mobile Money confirmation SMS or return to the batch link.
        </p>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, buyer_name, buyer_phone, qty, amount_pesewas, payment_status, paystack_reference, listings(title, slug)"
    )
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (!order) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 text-center">
        <p className="text-sm font-semibold text-teal-700">Akwaaba Cargo</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Order not found
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          We couldn&apos;t find an order matching reference{" "}
          <span className="font-mono">{reference}</span>.
        </p>
      </main>
    );
  }

  let status: PaymentStatus = order.payment_status;

  // Verify live transaction status with Paystack if order is still pending
  if (status === "pending") {
    const verification = await verifyPaystackTransaction(reference);
    if (verification) {
      if (
        verification.status === "success" &&
        verification.currency === "GHS" &&
        verification.amount === order.amount_pesewas
      ) {
        await admin
          .from("orders")
          .update({ payment_status: "paid" })
          .eq("id", order.id)
          .eq("payment_status", "pending");
        status = "paid";
      } else if (
        verification.status === "failed" ||
        verification.status === "abandoned"
      ) {
        await admin
          .from("orders")
          .update({ payment_status: "failed" })
          .eq("id", order.id)
          .eq("payment_status", "pending");
        status = "failed";
      }
    }
  }

  const listingRel = order.listings as
    | { title: string; slug: string }
    | { title: string; slug: string }[]
    | null;
  const listing = Array.isArray(listingRel) ? listingRel[0] : listingRel;

  const isPaid = status === "paid";
  const isFailed = status === "failed";

  return (
    <div className="min-h-screen bg-[#faf8f5] px-4 py-10">
      <main className="mx-auto max-w-md space-y-5">
        <div className="text-center">
          <BrandLogo />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="text-center">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                isPaid
                  ? "bg-teal-50 text-teal-800"
                  : isFailed
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-800"
              }`}
            >
              {isPaid
                ? "Payment confirmed"
                : isFailed
                  ? "Payment not completed"
                  : "Payment pending"}
            </span>

            <h1 className="mt-3 text-2xl font-bold text-gray-900">
              {isPaid
                ? "Your slot is reserved!"
                : isFailed
                  ? "Payment failed"
                  : "Confirming your payment"}
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              {isPaid
                ? `We'll send SMS updates to ${maskPhone(order.buyer_phone)} as your batch moves from China to Ghana.`
                : isFailed
                  ? "Your Mobile Money payment did not go through. You can try again from the batch page."
                  : "Your Mobile Money payment is still being confirmed. Refresh this page in a moment."}
            </p>
          </div>

          <dl className="mt-5 space-y-2.5 border-t border-gray-100 pt-4 text-sm">
            {listing && (
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Item</dt>
                <dd className="text-right font-semibold text-gray-900">
                  {listing.title}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900">{order.buyer_name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium text-gray-900">
                {maskPhone(order.buyer_phone)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Quantity</dt>
              <dd className="font-medium text-gray-900">{order.qty}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-gray-100 pt-2.5">
              <dt className="font-semibold text-gray-900">
                {isPaid ? "Amount paid" : "Amount"}
              </dt>
              <dd className="text-base font-bold text-teal-700">
                {formatGhs(order.amount_pesewas)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 pt-1 text-xs">
              <dt className="text-gray-400">Reference</dt>
              <dd className="font-mono text-gray-600">
                {order.paystack_reference}
              </dd>
            </div>
          </dl>

          {listing && (
            <div className="mt-5 space-y-2.5">
              {isPaid && (
                <Link
                  href={`/l/${listing.slug}/track`}
                  className="block w-full rounded-xl bg-[#071527] px-4 py-3 text-center text-sm font-bold text-white hover:bg-slate-800"
                >
                  Track batch progress
                </Link>
              )}
              <Link
                href={`/l/${listing.slug}`}
                className={`block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold ${
                  isFailed
                    ? "bg-[#0f6b47] text-white hover:bg-[#0a5236]"
                    : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                {isFailed ? "Try payment again" : "Back to batch page"}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
