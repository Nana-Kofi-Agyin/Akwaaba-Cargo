import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeGhanaPhone } from "@/lib/format";
import {
  generatePaystackReference,
  initializePaystackTransaction,
  phoneToPaystackEmail,
} from "@/lib/paystack";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

const checkoutRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 5 * 60 * 1000, // 10 checkout attempts per 5 minutes per IP
});

type CheckoutRequestBody = {
  listingId?: unknown;
  buyerName?: unknown;
  buyerPhone?: unknown;
  qty?: unknown;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = checkoutRateLimiter(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error:
          "Too many order attempts from your connection. Please wait a minute and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSec),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  let body: CheckoutRequestBody;
  try {
    body = (await request.json()) as CheckoutRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  // 1. Validate inputs strictly on the server
  const listingId =
    typeof body.listingId === "string" ? body.listingId.trim() : "";
  if (!UUID_REGEX.test(listingId)) {
    return NextResponse.json(
      { error: "Invalid listing ID." },
      { status: 400 }
    );
  }

  const buyerName =
    typeof body.buyerName === "string" ? body.buyerName.trim() : "";
  if (buyerName.length < 2 || buyerName.length > 120) {
    return NextResponse.json(
      { error: "Please enter your full name (2–120 characters)." },
      { status: 400 }
    );
  }

  const rawPhone =
    typeof body.buyerPhone === "string" ? body.buyerPhone.trim() : "";
  const buyerPhone = normalizeGhanaPhone(rawPhone);
  if (!buyerPhone) {
    return NextResponse.json(
      {
        error:
          "Enter a valid Ghanaian phone number (e.g. 024 123 4567 or +233 24 123 4567).",
      },
      { status: 400 }
    );
  }

  const qty =
    typeof body.qty === "number"
      ? body.qty
      : typeof body.qty === "string"
        ? Number.parseInt(body.qty, 10)
        : NaN;

  if (!Number.isInteger(qty) || qty < 1 || qty > 1000) {
    return NextResponse.json(
      { error: "Quantity must be a whole number between 1 and 1,000." },
      { status: 400 }
    );
  }

  // 2. Fetch listing from Postgres and verify it is still open
  const admin = createAdminClient();
  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("id, slug, title, price_pesewas, deadline, status")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError || !listing) {
    return NextResponse.json(
      { error: "Listing not found." },
      { status: 404 }
    );
  }

  if (
    listing.status !== "open" ||
    new Date(listing.deadline).getTime() <= Date.now()
  ) {
    return NextResponse.json(
      { error: "This pre-order batch is closed." },
      { status: 409 }
    );
  }

  // 3. Compute amount strictly on the server (never trust client totals)
  const amountPesewas = listing.price_pesewas * qty;
  const reference = generatePaystackReference();

  // 4. Create pending order before redirecting to Paystack
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      listing_id: listing.id,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      qty,
      amount_pesewas: amountPesewas,
      payment_status: "pending",
      paystack_reference: reference,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Could not create order. Please try again." },
      { status: 500 }
    );
  }

  // 5. Initialize Paystack transaction in GHS with Mobile Money enabled
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    new URL(request.url).origin;

  try {
    const paystack = await initializePaystackTransaction({
      email: phoneToPaystackEmail(buyerPhone),
      amountPesewas,
      reference,
      callbackUrl: `${appUrl}/orders/success`,
      metadata: {
        order_id: order.id,
        listing_id: listing.id,
        listing_slug: listing.slug,
        listing_title: listing.title,
        buyer_name: buyerName,
        buyer_phone: buyerPhone,
        qty,
      },
    });

    return NextResponse.json({
      authorization_url: paystack.authorization_url,
      reference: paystack.reference,
    });
  } catch (err) {
    // Mark pending order as failed if Paystack could not be initialized
    await admin
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", order.id);

    console.error("[checkout] Paystack initialization error:", err);

    return NextResponse.json(
      { error: "Could not start Mobile Money payment. Please try again." },
      { status: 502 }
    );
  }
}
