import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicListingBySlug } from "@/lib/listings";
import { formatGhs } from "@/lib/format";
import { LISTING_STATUS_LABELS } from "@/lib/arkesel";
import { BrandLogo } from "@/components/brand-logo";
import { ListingOrderSection } from "./listing-order-section";
import type { ListingStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const PROGRESS_STEPS: { status: ListingStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "ordered", label: "Ordered" },
  { status: "shipped", label: "Shipped" },
  { status: "arrived", label: "Arrived" },
  { status: "ready", label: "Ready" },
];

const STATUS_ORDER: Record<ListingStatus, number> = {
  open: 0,
  closed: 0,
  ordered: 1,
  shipped: 2,
  arrived: 3,
  ready: 4,
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
    `Pre-order ${listing.title} for ${price} and pay deposit via Mobile Money.`;
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
  const currentStepIndex = STATUS_ORDER[listing.status];

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-10">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <BrandLogo size="sm" />
          {listing.importer_name && (
            <span className="truncate text-xs text-stone-500">
              by {listing.importer_name}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        {/* Product card */}
        <article className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {listing.image_url && (
            <div className="aspect-[4/3] w-full bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listing.image_url}
                alt={listing.title}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="p-4">
            <h1 className="text-xl font-bold leading-snug text-gray-900">
              {listing.title}
            </h1>
            <p className="mt-1 text-2xl font-extrabold text-teal-700">
              {formatGhs(listing.price_pesewas)}
            </p>

            {listing.description && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                {listing.description}
              </p>
            )}

            {/* Reservation & minimum quantity progress */}
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700">
                  {listing.reserved_people}{" "}
                  {listing.reserved_people === 1 ? "person" : "people"} reserved
                </span>
                <span
                  className={
                    minReached
                      ? "font-semibold text-teal-700"
                      : "font-medium text-gray-600"
                  }
                >
                  {listing.reserved_qty} / {listing.min_qty} min qty
                  {minReached ? " · Target reached" : ""}
                </span>
              </div>

              <div
                className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress toward minimum quantity"
              >
                <div
                  className="h-full rounded-full bg-teal-600 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </article>

        {/* Public Batch Status Timeline */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900">Batch progress</h2>
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
              {LISTING_STATUS_LABELS[listing.status]}
            </span>
          </div>

          <ol className="mt-3 grid grid-cols-5 gap-1 text-center">
            {PROGRESS_STEPS.map((step, idx) => {
              const reached = idx <= currentStepIndex;
              return (
                <li key={step.status} className="space-y-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      reached ? "bg-teal-600" : "bg-gray-200"
                    }`}
                  />
                  <span
                    className={`block text-[10px] font-medium ${
                      reached ? "text-teal-800" : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {listing.status_updates.length > 0 && (
            <ul className="mt-4 space-y-3 border-t border-gray-100 pt-3">
              {listing.status_updates.map((update) => (
                <li key={update.id} className="flex gap-2.5 text-xs">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-900">
                        {LISTING_STATUS_LABELS[update.status]}
                      </span>
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {new Date(update.created_at).toLocaleDateString(
                          "en-GH",
                          {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                    </div>
                    {update.note && (
                      <p className="mt-0.5 text-gray-600">{update.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Live countdown + Order form / Closed state */}
        <ListingOrderSection
          listingId={listing.id}
          pricePesewas={listing.price_pesewas}
          deadline={listing.deadline}
          status={listing.status}
          initialRemainingMs={initialRemainingMs}
        />
      </main>
    </div>
  );
}
