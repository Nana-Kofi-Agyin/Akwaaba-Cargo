import { getInitials } from "@/lib/format";

type ListingTrustStripProps = {
  importerName: string | null;
};

export function ListingTrustStrip({ importerName }: ListingTrustStripProps) {
  const organizer = importerName || "Akwaaba Cargo Importer";
  const initials = getInitials(organizer);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-3.5">
      {/* Trust pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-[#0f6b47] ring-1 ring-emerald-200/70">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5 shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm3.03 5.03a.75.75 0 0 0-1.06-1.06L7.25 8.19 6.03 6.97a.75.75 0 0 0-1.06 1.06l1.75 1.75a.75.75 0 0 0 1.06 0l3.25-3.25Z"
              clipRule="evenodd"
            />
          </svg>
          Paid securely via Paystack
        </span>

        <span className="inline-flex items-center rounded-full bg-amber-100/80 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
          WhatsApp Pre-Order
        </span>
      </div>

      {/* Organizer row */}
      <div className="mt-3 flex items-center gap-2.5 border-t border-slate-200/70 pt-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#071527] text-xs font-bold text-white">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-500">
            Batch Organizer
          </p>
          <p className="truncate text-xs font-bold text-slate-900">
            {organizer}
          </p>
        </div>
      </div>
    </section>
  );
}
