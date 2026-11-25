import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicListingBySlug } from "@/lib/listings";
import { formatGhs } from "@/lib/format";
import { LISTING_STATUS_LABELS } from "@/lib/arkesel";
import { BrandLogo } from "@/components/brand-logo";
import { ListingTrustStrip } from "@/components/listing-trust-strip";
import { ListingOrderSection } from "./listing-order-section";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getPublicListingBySlug(slug);

  if (!listing) {
    return {
      title: "Listing not found | Akwaaba Cargo",
    };
  }

  const price = formatGhs(listing.price_pesewas);
  const title = `${listing.title} — ${price}`;
  const description =
    listing.description?.slice(0, 155) ||
    `Pre-order ${listing.title} (${price} via Mobile Money). Paid securely via Paystack.`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const url = appUrl ? `${appUrl}/l/${listing.slug}` : undefined;

  return {
    title: `${listing.title} | Akwaaba Cargo`,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Akwaaba Cargo",
      ...(url ? { url } : {}),
      ...(listing.image_url
        ? {
            images: [
              {
                url: listing.image_url,
                width: 1200,
                height: 630,
                alt: listing.title,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: listing.image_url ? "summary_large_image" : "summary",
      title,
      description,
      ...(listing.image_url ? { images: [listing.image_url] } : {}),
    },
  };
}

export default async function PublicListingPage({ params }: PageProps) {
  const { slug } = await params;
  const listing = await getPublicListingBySlug(slug);

  if (!listing) {
    notFound();
  }

  const initialRemainingMs = Math.max(
    0,
    new Date(listing.deadline).getTime() - Date.now()
  );

  const progressPct = Math.min(
    100,
    Math.round((listing.reserved_qty / listing.min_qty) * 100)
  );
  const minReached = listing.reserved_qty >= listing.min_qty;
  const remainingQty = Math.max(0, listing.min_qty - listing.reserved_qty);

  const hasLogisticsInfo = Boolean(
    listing.shipping_method ||
      listing.estimated_arrival ||
      listing.pickup_location ||
      listing.delivery_fee_pesewas !== null
  );

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-32 sm:pb-12">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <BrandLogo size="sm" />
          <Link
            href={`/l/${listing.slug}/track`}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-200"
          >
            Track progress →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        {/* Top Trust Strip (no duplicate Order/Track toggle) */}
        <ListingTrustStrip importerName={listing.importer_name} />

        {/* Batch Hero, Progress Bar & Logistics Details */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              {listing.shipping_method === "air"
                ? "Air Freight · China → Ghana"
                : listing.shipping_method === "sea"
                  ? "Sea Freight · China → Ghana"
                  : "China → Ghana Pre-Order Batch"}
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#0f6b47]">
              {LISTING_STATUS_LABELS[listing.status]}
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-slate-900">
            {listing.title}
          </h1>

          <p className="mt-1.5 text-xs text-slate-600">
            Order deadline:{" "}
            <span className="font-semibold text-slate-800">
              {new Date(listing.deadline).toLocaleDateString("en-GH", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </p>

          {/* Progress toward minimum quantity */}
          <div className="mt-3.5 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-900">
                {progressPct}% of minimum reached
              </span>
              <span
                className={
                  minReached
                    ? "font-bold text-[#0f6b47]"
                    : "font-semibold text-amber-800"
                }
              >
                {minReached
                  ? "Minimum reached!"
                  : `${remainingQty} more ${remainingQty === 1 ? "unit" : "units"} needed`}
              </span>
            </div>

            <div
              className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress toward minimum quantity"
            >
              <div
                className={`h-full rounded-full transition-all ${
                  minReached ? "bg-[#0f6b47]" : "bg-amber-500"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
              <span>
                {listing.reserved_qty} / {listing.min_qty} min units reserved
              </span>
              <span>
                {listing.reserved_people}{" "}
                {listing.reserved_people === 1 ? "buyer" : "buyers"} paid
              </span>
            </div>
          </div>

          {/* Shipping, Arrival, Pickup & Delivery Details under progress bar */}
          {hasLogisticsInfo && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {listing.shipping_method && (
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Shipping
                  </dt>
                  <dd className="mt-0.5 font-bold text-slate-900">
                    {listing.shipping_method === "air"
                      ? "Air freight"
                      : "Sea freight"}
                  </dd>
                </div>
              )}

              {listing.estimated_arrival && (
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Est. arrival
                  </dt>
                  <dd className="mt-0.5 font-bold text-slate-900">
                    {listing.estimated_arrival}
                  </dd>
                </div>
              )}

              {listing.pickup_location && (
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Pickup location
                  </dt>
                  <dd className="mt-0.5 font-bold text-slate-900">
                    {listing.pickup_location}
                  </dd>
                </div>
              )}

              {listing.delivery_fee_pesewas !== null && (
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Delivery option
                  </dt>
                  <dd className="mt-0.5 font-bold text-slate-900">
                    {listing.delivery_fee_pesewas === 0
                      ? "Free delivery"
                      : `Available (+${formatGhs(listing.delivery_fee_pesewas)})`}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </section>

        {/* Product Card (Gallery, Read more, Deposit/Full), Buyer Form & Live Total */}
        <ListingOrderSection
          listingId={listing.id}
          title={listing.title}
          description={listing.description}
          photos={listing.photos}
          pricePesewas={listing.price_pesewas}
          fullPricePesewas={listing.full_price_pesewas}
          maxQtyPerOrder={listing.max_qty_per_order}
          pickupLocation={listing.pickup_location}
          deliveryFeePesewas={listing.delivery_fee_pesewas}
          deadline={listing.deadline}
          status={listing.status}
          initialRemainingMs={initialRemainingMs}
        />

        {/* WhatsApp Contact Card */}
        {listing.importer_whatsapp_url && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <p className="text-xs text-slate-600">
              Have a question about this batch?
            </p>
            <a
              href={listing.importer_whatsapp_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 block w-full rounded-xl bg-[#25D366] px-4 py-2.5 text-center text-xs font-bold text-white transition hover:bg-[#1fb858]"
            >
              Chat with {listing.importer_name || "Organizer"} on WhatsApp
            </a>
          </section>
        )}
      </main>
    </div>
  );
}
