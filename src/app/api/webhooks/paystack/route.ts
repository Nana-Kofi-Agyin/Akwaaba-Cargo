import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { processPaystackWebhook } from "@/lib/paystack-webhook";

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "Webhook secret is not configured" },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > 65_536) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const signature = request.headers.get("x-paystack-signature");
  const admin = createAdminClient();

  const result = await processPaystackWebhook(rawBody, signature, {
    secretKey,
    verifyTransaction: verifyPaystackTransaction,
    findOrderByReference: async (reference) => {
      const { data } = await admin
        .from("orders")
        .select("id, amount_pesewas, payment_status, paystack_reference")
        .eq("paystack_reference", reference)
        .maybeSingle();

      return data ?? null;
    },
    updateOrderStatus: async (orderId, newStatus, expectedCurrentStatus) => {
      const { data } = await admin
        .from("orders")
        .update({ payment_status: newStatus })
        .eq("id", orderId)
        .eq("payment_status", expectedCurrentStatus)
        .select("id");

      return (data?.length ?? 0) > 0;
    },
  });

  return NextResponse.json(result.body, { status: result.httpStatus });
}
