import {
  verifyPaystackSignature,
  type VerifyPaystackResult,
} from "./paystack.ts";
import type { PaymentStatus } from "../types/database.ts";

export type WebhookOrderRecord = {
  id: string;
  amount_pesewas: number;
  payment_status: PaymentStatus;
  paystack_reference: string;
};

export type PaystackWebhookDeps = {
  secretKey: string;
  verifyTransaction: (reference: string) => Promise<VerifyPaystackResult | null>;
  findOrderByReference: (
    reference: string
  ) => Promise<WebhookOrderRecord | null>;
  updateOrderStatus: (
    orderId: string,
    newStatus: PaymentStatus,
    expectedCurrentStatus: PaymentStatus
  ) => Promise<boolean>;
};

export type PaystackWebhookResponse = {
  httpStatus: number;
  body: Record<string, unknown>;
};

type PaystackWebhookPayload = {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
  };
};

const HANDLED_EVENTS = new Set([
  "charge.success",
  "charge.failed",
  "charge.abandoned",
]);

export async function processPaystackWebhook(
  rawBody: string,
  signature: string | null,
  deps: PaystackWebhookDeps
): Promise<PaystackWebhookResponse> {
  // 1. Verify HMAC-SHA512 signature
  if (!verifyPaystackSignature(rawBody, signature, deps.secretKey)) {
    return {
      httpStatus: 401,
      body: { error: "Invalid signature" },
    };
  }

  // 2. Parse payload
  let payload: PaystackWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PaystackWebhookPayload;
  } catch {
    return {
      httpStatus: 400,
      body: { error: "Invalid JSON payload" },
    };
  }

  const event = payload.event ?? "";
  const reference = payload.data?.reference?.trim() ?? "";

  if (!HANDLED_EVENTS.has(event) || !reference) {
    return {
      httpStatus: 200,
      body: { received: true, status: "ignored" },
    };
  }

  // 3. Look up order
  const order = await deps.findOrderByReference(reference);
  if (!order) {
    return {
      httpStatus: 200,
      body: { received: true, status: "order_not_found" },
    };
  }

  // 4. Idempotency: never re-process an already-paid order
  if (order.payment_status === "paid") {
    return {
      httpStatus: 200,
      body: { received: true, status: "already_paid" },
    };
  }

  // 5. Verify live transaction status with Paystack's Verify API
  const verified = await deps.verifyTransaction(reference);
  if (!verified) {
    return {
      httpStatus: 502,
      body: { error: "Could not verify transaction with Paystack" },
    };
  }

  // 6. Handle verified success
  if (verified.status === "success") {
    if (
      verified.currency !== "GHS" ||
      verified.amount !== order.amount_pesewas
    ) {
      return {
        httpStatus: 400,
        body: {
          error: "Amount or currency mismatch",
          expected_pesewas: order.amount_pesewas,
          received_pesewas: verified.amount,
          received_currency: verified.currency,
        },
      };
    }

    const updated = await deps.updateOrderStatus(
      order.id,
      "paid",
      order.payment_status
    );

    return {
      httpStatus: 200,
      body: {
        received: true,
        status: updated ? "marked_paid" : "already_processed",
      },
    };
  }

  // 7. Handle failed and abandoned payments
  if (verified.status === "failed" || verified.status === "abandoned") {
    if (order.payment_status === "failed") {
      return {
        httpStatus: 200,
        body: { received: true, status: "already_failed" },
      };
    }

    await deps.updateOrderStatus(order.id, "failed", order.payment_status);

    return {
      httpStatus: 200,
      body: {
        received: true,
        status: verified.status === "abandoned" ? "marked_abandoned" : "marked_failed",
      },
    };
  }

  // Transaction still ongoing/pending on Paystack
  return {
    httpStatus: 200,
    body: { received: true, status: "pending" },
  };
}
