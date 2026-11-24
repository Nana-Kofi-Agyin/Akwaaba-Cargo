import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { formatGhs } from "@/lib/format";
import { LISTING_STATUS_LABELS } from "@/lib/arkesel";
import { ShareListingActions } from "@/components/share-listing-actions";
import { CloseListingButton } from "./close-listing-button";
import { StatusControl } from "./status-control";
import { OrdersTable } from "./orders-table";

type ListingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailPage({
  params,
}: ListingDetailPageProps) {
  const { id } = await params;
  const { supabase, importer } = await getAuthContext();
  if (!supabase || !importer) {
    redirect("/login");
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .eq("importer_id", importer.id)
    .maybeSingle();

  if (!listing) {
    notFound();
  }

  const [{ data: ordersData }, { data: updatesData }, { data: smsLogsData }] =
    await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, buyer_name, buyer_phone, qty, amount_pesewas, payment_status, created_at"
        )
        .eq("listing_id", listing.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("status_updates")
        .select("id, status, note, created_at")
        .eq("listing_id", listing.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("sms_logs")
        .select("status_update_id, delivery_status")
        .eq("listing_id", listing.id),
    ]);

  const orders = ordersData ?? [];
  const statusUpdates = updatesData ?? [];
  const smsLogs = smsLogsData ?? [];

  const paidOrders = orders.filter((o) => o.payment_status === "paid");
  const pendingOrders = orders.filter((o) => o.payment_status === "pending");
  const uniquePaidBuyers = new Set(paidOrders.map((o) => o.buyer_phone)).size;

  const totalPaidPesewas = paidOrders.reduce(
    (sum, o) => sum + o.amount_pesewas,
    0
  );
  const totalPendingPesewas = pendingOrders.reduce(
    (sum, o) => sum + o.amount_pesewas,
    0
  );
  const paidQty = paidOrders.reduce((sum, o) => sum + o.qty, 0);
  const totalQty = orders.reduce((sum, o) => sum + o.qty, 0);

  // Aggregate SMS delivery counts per status_update
  const smsCountsByUpdate = new Map<string, { sent: number; failed: number }>();
  for (const log of smsLogs) {
    const entry = smsCountsByUpdate.get(log.status_update_id) ?? {
      sent: 0,
      failed: 0,
    };
    if (log.delivery_status === "sent") {
      entry.sent += 1;
    } else {
      entry.failed += 1;
    }
    smsCountsByUpdate.set(log.status_update_id, entry);
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard"
          className="text-xs font-medium text-gray-500 hover:text-gray-900"
        >
          ← Back to batches
        </Link>

        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{listing.title}</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {formatGhs(listing.price_pesewas)} · Min qty {listing.min_qty} ·
              Deadline{" "}
              {new Date(listing.deadline).toLocaleDateString("en-GH", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold capitalize text-teal-800">
            {listing.status}
          </span>
        </div>
      </div>

      {/* Share & Early Close controls */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <ShareListingActions
          slug={listing.slug}
          title={listing.title}
          pricePesewas={listing.price_pesewas}
          deadline={listing.deadline}
          compact
        />

        {listing.status === "open" && (
          <div className="border-t border-gray-100 pt-3">
            <CloseListingButton listingId={listing.id} />
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] font-medium text-gray-500">Orders</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {orders.length}
          </p>
          <p className="text-[11px] text-gray-500">
            {paidOrders.length} paid · {pendingOrders.length} pending
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] font-medium text-gray-500">Paid qty</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {paidQty}
            <span className="text-xs font-normal text-gray-500">
              /{listing.min_qty}
            </span>
          </p>
          <p className="text-[11px] text-gray-500">{totalQty} total qty</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] font-medium text-gray-500">Total paid</p>
          <p className="mt-1 text-base font-bold text-teal-700">
            {formatGhs(totalPaidPesewas)}
          </p>
          <p className="text-[11px] text-gray-500">
            {formatGhs(totalPendingPesewas)} pending
          </p>
        </div>
      </div>

      {/* Status Control + Arkesel SMS */}
      <StatusControl
        listingId={listing.id}
        currentStatus={listing.status}
        paidBuyerCount={uniquePaidBuyers}
      />

      {/* Status Updates & SMS Delivery History */}
      {statusUpdates.length > 0 && (
        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-900">Status history</h2>
          <ul className="divide-y divide-gray-100">
            {statusUpdates.map((update) => {
              const sms = smsCountsByUpdate.get(update.id);
              return (
                <li key={update.id} className="py-2.5 first:pt-1 last:pb-0">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-gray-900">
                      {LISTING_STATUS_LABELS[update.status]}
                    </span>
                    <span className="text-gray-400">
                      {new Date(update.created_at).toLocaleDateString("en-GH", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {update.note && (
                    <p className="mt-0.5 text-xs text-gray-600">{update.note}</p>
                  )}
                  {sms && (
                    <p className="mt-1 text-[11px] text-gray-500">
                      SMS delivery: {sms.sent} sent
                      {sms.failed > 0 ? `, ${sms.failed} failed` : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Orders header + CSV export */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-gray-900">Orders</h2>
          <a
            href={`/api/listings/${listing.id}/orders.csv`}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          >
            Export CSV
          </a>
        </div>

        <OrdersTable orders={orders} />
      </div>
    </div>
  );
}
