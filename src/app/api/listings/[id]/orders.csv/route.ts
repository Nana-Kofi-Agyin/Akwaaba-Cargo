import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeCsvCell(value: string | number): string {
  let str = String(value);
  // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR)
  // Also prevents Excel from converting +233 phone numbers to scientific notation.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid listing ID" }, { status: 400 });
  }

  const { supabase, importer } = await getAuthContext();

  if (!supabase || !importer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("id, slug")
    .eq("id", id)
    .eq("importer_id", importer.id)
    .maybeSingle();

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "buyer_name, buyer_phone, qty, amount_pesewas, payment_status, paystack_reference, created_at"
    )
    .eq("listing_id", listing.id)
    .order("created_at", { ascending: false });

  const header = [
    "Buyer Name",
    "Phone",
    "Quantity",
    "Amount (GHS)",
    "Payment Status",
    "Paystack Reference",
    "Created At",
  ];

  const rows = (orders ?? []).map((o) => [
    o.buyer_name,
    o.buyer_phone,
    o.qty,
    (o.amount_pesewas / 100).toFixed(2),
    o.payment_status,
    o.paystack_reference,
    o.created_at,
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");

  const safeFilename = listing.slug.replace(/[^a-z0-9-]/gi, "") || "orders";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename}-orders.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
