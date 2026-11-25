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
    `Pre-order ${listing.title} (${price} deposit via Mobile Money). Paid securely via Paystack.`;
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

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-12">
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
        {/* Top Trust Strip */}
        <ListingTrustStrip
          importerName={listing.importer_name}
          slug={listing.slug}
          activeView="order"
        />

        {/* Batch Hero & Progress Card */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              China → Ghana Pre-Order Batch
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#0f6b47]">
              {LISTING_STATUS_LABELS[listing.status]}
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-slate-900">
            {listing.title}
          </h1>

          <p className="mt-1.5 text-xs text-slate-600">
            Deadline:{" "}
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
        </section>

        {/* Product Card (Deposit/Balance), Buyer Form & Live Total */}
        <ListingOrderSection
          listingId={listing.id}
          title={listing.title}
          description={listing.description}
          imageUrl={listing.image_url}
          pricePesewas={listing.price_pesewas}
          fullPricePesewas={listing.full_price_pesewas}
          deadline={listing.deadline}
          status={listing.status}
          initialRemainingMs={initialRemainingMs}
        />

        {/* Tracking & WhatsApp Contact Footer Card */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Already reserved?
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                View batch timeline updates and uploaded proof photos.
              </p>
            </div>
            <Link
              href={`/l/${listing.slug}/track`}
              className="shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
            >
              View timeline
            </Link>
          </div>

          {listing.importer_whatsapp_url && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <a
                href={listing.importer_whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-xl bg-[#25D366] px-4 py-2.5 text-center text-xs font-bold text-white transition hover:bg-[#1fb858]"
              >
                Chat with {listing.importer_name || "Organizer"} on WhatsApp
              </a>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
