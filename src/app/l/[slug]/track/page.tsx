import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicListingBySlug, type PublicStatusUpdate } from "@/lib/listings";
import { formatGhs } from "@/lib/format";
import { LISTING_STATUS_LABELS } from "@/lib/arkesel";
import { BrandLogo } from "@/components/brand-logo";
import { ListingTrustStrip } from "@/components/listing-trust-strip";
import type { ListingStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type TrackPageProps = {
  params: Promise<{ slug: string }>;
};

const TIMELINE_STAGES: { status: ListingStatus; title: string; subtitle: string }[] = [
  {
    status: "open",
    title: "Pre-order batch opened",
    subtitle: "Accepting Mobile Money reservations",
  },
  {
    status: "closed",
    title: "Pre-orders closed",
    subtitle: "Final quantities locked in",
  },
  {
    status: "ordered",
    title: "Ordered from China",
    subtitle: "Batch order placed with supplier",
  },
  {
    status: "shipped",
    title: "Shipped to Ghana",
    subtitle: "Cargo dispatched on its way to Ghana",
  },
  {
    status: "arrived",
    title: "Arrived in Ghana",
    subtitle: "Batch received and being sorted",
  },
  {
    status: "ready",
    title: "Ready for pickup",
    subtitle: "Available for collection or delivery",
  },
];

const STAGE_INDEX: Record<ListingStatus, number> = {
  open: 0,
  closed: 1,
  ordered: 2,
  shipped: 3,
  arrived: 4,
  ready: 5,
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function generateMetadata({
  params,
}: TrackPageProps): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getPublicListingBySlug(slug);

  if (!listing) {
    return { title: "Batch tracking not found | Akwaaba Cargo" };
  }

  return {
    title: `Track: ${listing.title} | Akwaaba Cargo`,
    description: `Current status: ${LISTING_STATUS_LABELS[listing.status]}. Follow updates and proof photos for ${listing.title}.`,
  };
}

export default async function PublicTrackingPage({ params }: TrackPageProps) {
  const { slug } = await params;
  const listing = await getPublicListingBySlug(slug);

  if (!listing) {
    notFound();
  }

  const currentStageIndex = STAGE_INDEX[listing.status];
  const progressPct = Math.min(
    100,
    Math.round((listing.reserved_qty / listing.min_qty) * 100)
  );
  const minReached = listing.reserved_qty >= listing.min_qty;

  // Group real status_updates by status (chronological order inside each stage)
  const updatesByStage = new Map<ListingStatus, PublicStatusUpdate[]>();
  for (const update of [...listing.status_updates].reverse()) {
    const existing = updatesByStage.get(update.status) ?? [];
    existing.push(update);
    updatesByStage.set(update.status, existing);
  }

  const hasSplitBalance =
    listing.full_price_pesewas !== null &&
    listing.full_price_pesewas > listing.price_pesewas;
  const balancePesewas = hasSplitBalance
    ? listing.full_price_pesewas! - listing.price_pesewas
    : 0;

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-12">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <BrandLogo size="sm" />
          <Link
            href={`/l/${listing.slug}`}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-200"
          >
            ← Order page
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        {/* Top Trust Strip */}
        <ListingTrustStrip importerName={listing.importer_name} />

        {/* Batch Status Summary Card */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex gap-3">
            {listing.image_url && (
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={listing.image_url}
                  alt={listing.title}
                  loading="eager"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-[#0f6b47]">
                {LISTING_STATUS_LABELS[listing.status]}
              </span>
              <h1 className="mt-1 text-lg font-extrabold leading-snug text-slate-900">
                {listing.title}
              </h1>
              <p className="mt-0.5 text-xs text-slate-600">
                {hasSplitBalance ? (
                  <>
                    Deposit:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatGhs(listing.price_pesewas)}
                    </span>{" "}
                    · Balance on pickup:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatGhs(balancePesewas)}
                    </span>
                  </>
                ) : (
                  <>
                    Price:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatGhs(listing.price_pesewas)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Progress toward minimum quantity */}
          <div className="mt-3.5 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900">
                {listing.reserved_qty} / {listing.min_qty} min units reserved
              </span>
              <span
                className={
                  minReached
                    ? "font-bold text-[#0f6b47]"
                    : "font-semibold text-amber-800"
                }
              >
                {progressPct}%{minReached ? " · Target met" : ""}
              </span>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-full rounded-full ${
                  minReached ? "bg-[#0f6b47]" : "bg-amber-500"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {listing.reserved_people}{" "}
              {listing.reserved_people === 1 ? "buyer" : "buyers"} paid ·
              Refunded automatically if the minimum quantity is not reached.
            </p>
          </div>
        </section>

        {/* Vertical Status Timeline with Dates & Proof Uploads */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <h2 className="text-base font-bold text-slate-900">
            Batch Status Timeline
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Live updates posted by {listing.importer_name || "the organizer"}.
          </p>

          <ol className="mt-4 space-y-0">
            {TIMELINE_STAGES.map((stage, idx) => {
              const isReached = idx <= currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const isLast = idx === TIMELINE_STAGES.length - 1;
              const stageUpdates = updatesByStage.get(stage.status) ?? [];

              // Determine real date to display for this milestone
              const stageDate =
                stage.status === "open"
                  ? listing.created_at
                  : stageUpdates.length > 0
                    ? stageUpdates[stageUpdates.length - 1].created_at
                    : null;

              return (
                <li key={stage.status} className="relative flex gap-3.5 pb-5 last:pb-0">
                  {/* Vertical connecting line */}
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${
                        idx < currentStageIndex
                          ? "bg-[#0f6b47]"
                          : "bg-slate-200"
                      }`}
                    />
                  )}

                  {/* Step dot */}
                  <span
                    className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      isCurrent
                        ? "bg-[#0f6b47] text-white ring-4 ring-emerald-100"
                        : isReached
                          ? "bg-[#0f6b47] text-white"
                          : "border-2 border-slate-200 bg-white text-slate-400"
                    }`}
                  >
                    {isReached ? "✓" : idx + 1}
                  </span>

                  {/* Stage content */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <h3
                        className={`text-sm font-bold ${
                          isReached ? "text-slate-900" : "text-slate-400"
                        }`}
                      >
                        {stage.title}
                      </h3>
                      {stageDate && (
                        <time className="text-[11px] font-medium text-slate-500">
                          {formatDateTime(stageDate)}
                        </time>
                      )}
                    </div>

                    <p
                      className={`mt-0.5 text-xs ${
                        isReached ? "text-slate-600" : "text-slate-400"
                      }`}
                    >
                      {stage.subtitle}
                    </p>

                    {/* Real notes & proof photo uploads for this stage */}
                    {stageUpdates.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {stageUpdates.map((update) =>
                          update.note || update.proof_image_url ? (
                            <div
                              key={update.id}
                              className="rounded-xl border border-slate-200/80 bg-slate-50 p-3"
                            >
                              {update.note && (
                                <p className="text-xs leading-relaxed text-slate-800">
                                  {update.note}
                                </p>
                              )}

                              {update.proof_image_url && (
                                <a
                                  href={update.proof_image_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 block overflow-hidden rounded-lg border border-slate-200 bg-white"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={update.proof_image_url}
                                    alt={`Proof photo for ${stage.title}`}
                                    loading="lazy"
                                    decoding="async"
                                    className="max-h-48 w-full object-cover"
                                  />
                                  <span className="block px-2.5 py-1.5 text-[11px] font-semibold text-[#0f6b47]">
                                    Tap to view proof photo ↗
                                  </span>
                                </a>
                              )}
                            </div>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* WhatsApp Contact & Order CTA Card */}
        <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Questions about this batch?
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Message {listing.importer_name || "the organizer"} directly on
              WhatsApp for pickup or delivery details.
            </p>
          </div>

          {listing.importer_whatsapp_url && (
            <a
              href={listing.importer_whatsapp_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-xl bg-[#25D366] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-[#1fb858]"
            >
              Chat with {listing.importer_name || "Organizer"} on WhatsApp
            </a>
          )}

          {listing.status === "open" &&
            new Date(listing.deadline).getTime() > Date.now() && (
              <Link
                href={`/l/${listing.slug}`}
                className="block w-full rounded-xl bg-[#071527] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800"
              >
                {hasSplitBalance
                  ? `Reserve a slot (${formatGhs(listing.price_pesewas)} deposit)`
                  : `Reserve & Pay ${formatGhs(listing.price_pesewas)}`}
              </Link>
            )}

          <p className="text-center text-[11px] text-slate-500">
            Paid securely via Paystack · Refunded automatically if the minimum
            quantity is not reached.
          </p>
        </section>
      </main>
    </div>
  );
}
