import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { formatGhs } from "@/lib/format";
import { ShareListingActions } from "@/components/share-listing-actions";
import type { ListingStatus, PaymentStatus } from "@/types/database";

type OrderSummary = {
  id: string;
  qty: number;
  amount_pesewas: number;
  payment_status: PaymentStatus;
};

const STATUS_BADGE: Record<ListingStatus, string> = {
  open: "bg-teal-50 text-teal-800",
  closed: "bg-gray-100 text-gray-700",
  ordered: "bg-blue-50 text-blue-800",
  shipped: "bg-indigo-50 text-indigo-800",
  arrived: "bg-amber-50 text-amber-800",
  ready: "bg-emerald-50 text-emerald-800",
};

export default async function DashboardPage() {
  const { supabase, importer } = await getAuthContext();
  if (!supabase || !importer) {
    redirect("/login");
  }

  const { data: listings } = await supabase
    .from("listings")
    .select(
      "id, slug, title, image_url, price_pesewas, min_qty, deadline, status, created_at, orders(id, qty, amount_pesewas, payment_status)"
    )
    .eq("importer_id", importer.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Your batches</h1>
          <p className="text-xs text-gray-500">
            Track orders, payments, and share links in WhatsApp.
          </p>
        </div>
        <Link
          href="/dashboard/listings/new"
          className="shrink-0 rounded-lg bg-teal-700 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          + New listing
        </Link>
      </div>

      {!listings || listings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
          <p className="text-sm font-medium text-gray-900">No listings yet</p>
          <p className="mt-1 text-xs text-gray-500">
            Create your first China pre-order batch to get a WhatsApp share
            link.
          </p>
          <Link
            href="/dashboard/listings/new"
            className="mt-4 inline-block rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Create first listing
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {listings.map((listing) => {
            const orders = (listing.orders ?? []) as OrderSummary[];
            const totalOrders = orders.length;
            const paidOrders = orders.filter(
              (o) => o.payment_status === "paid"
            );
            const totalPaidPesewas = paidOrders.reduce(
              (sum, o) => sum + o.amount_pesewas,
              0
            );
            const pendingCount = orders.filter(
              (o) => o.payment_status === "pending"
            ).length;

            return (
              <li
                key={listing.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs"
              >
                <Link
                  href={`/dashboard/listings/${listing.id}`}
                  className="block group"
                >
                  <div className="flex gap-3">
                    {listing.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={listing.image_url}
                        alt={listing.title}
                        className="h-16 w-16 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="truncate text-base font-semibold text-gray-900 group-hover:text-teal-700">
                          {listing.title}
                        </h2>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[listing.status]}`}
                        >
                          {listing.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm font-semibold text-gray-900">
                        {formatGhs(listing.price_pesewas)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Deadline:{" "}
                        {new Date(listing.deadline).toLocaleDateString("en-GH", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs">
                    <div>
                      <span className="text-gray-500">Total orders</span>
                      <p className="font-semibold text-gray-900">
                        {totalOrders}{" "}
                        <span className="font-normal text-gray-500">
                          ({paidOrders.length} paid
                          {pendingCount > 0 ? `, ${pendingCount} pending` : ""})
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Total paid</span>
                      <p className="font-semibold text-teal-700">
                        {formatGhs(totalPaidPesewas)}
                      </p>
                    </div>
                  </div>
                </Link>

                <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                  <Link
                    href={`/dashboard/listings/${listing.id}`}
                    className="rounded-lg border border-teal-700 bg-teal-50/50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                  >
                    View orders
                  </Link>
                  <div className="flex-1">
                    <ShareListingActions
                      slug={listing.slug}
                      title={listing.title}
                      pricePesewas={listing.price_pesewas}
                      deadline={listing.deadline}
                      compact
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
