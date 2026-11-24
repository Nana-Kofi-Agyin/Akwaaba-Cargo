import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  processPaystackWebhook,
  type PaystackWebhookDeps,
  type WebhookOrderRecord,
} from "./paystack-webhook.ts";
import type { VerifyPaystackResult } from "./paystack.ts";

const TEST_SECRET = "sk_test_akwaaba_cargo_secret_key";

function signPayload(rawBody: string, secret = TEST_SECRET): string {
  return crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
}

function createInMemoryDeps(
  initialOrder: WebhookOrderRecord,
  verifyImpl: (ref: string) => Promise<VerifyPaystackResult | null>
) {
  const store = new Map<string, WebhookOrderRecord>([
    [initialOrder.paystack_reference, { ...initialOrder }],
  ]);

  let verifyCalls = 0;
  let updateCalls = 0;

  const deps: PaystackWebhookDeps = {
    secretKey: TEST_SECRET,
    verifyTransaction: async (ref) => {
      verifyCalls += 1;
      return verifyImpl(ref);
    },
    findOrderByReference: async (ref) => {
      const found = store.get(ref);
      return found ? { ...found } : null;
    },
    updateOrderStatus: async (orderId, newStatus, expectedCurrentStatus) => {
      for (const order of store.values()) {
        if (
          order.id === orderId &&
          order.payment_status === expectedCurrentStatus
        ) {
          updateCalls += 1;
          order.payment_status = newStatus;
          return true;
        }
      }
      return false;
    },
  };

  return {
    deps,
    getOrder: (ref: string) => store.get(ref),
    getVerifyCalls: () => verifyCalls,
    getUpdateCalls: () => updateCalls,
  };
}

describe("processPaystackWebhook", () => {
  it("happy path: verifies signature, confirms amount with Paystack API, and marks order paid", async () => {
    const ref = "ac_1700000000_happy";
    const { deps, getOrder, getVerifyCalls, getUpdateCalls } =
      createInMemoryDeps(
        {
          id: "order-1",
          amount_pesewas: 30000, // GHS 300.00
          payment_status: "pending",
          paystack_reference: ref,
        },
        async (reference) => ({
          status: "success",
          reference,
          amount: 30000,
          currency: "GHS",
          paid_at: "2026-11-24T12:00:00Z",
        })
      );

    const rawBody = JSON.stringify({
      event: "charge.success",
      data: { reference: ref, status: "success" },
    });
    const signature = signPayload(rawBody);

    const res = await processPaystackWebhook(rawBody, signature, deps);

    assert.equal(res.httpStatus, 200);
    assert.equal(res.body.status, "marked_paid");
    assert.equal(getOrder(ref)?.payment_status, "paid");
    assert.equal(getVerifyCalls(), 1);
    assert.equal(getUpdateCalls(), 1);
  });

  it("duplicate webhook: is idempotent and does not double-process an already paid order", async () => {
    const ref = "ac_1700000000_dup";
    const { deps, getOrder, getVerifyCalls, getUpdateCalls } =
      createInMemoryDeps(
        {
          id: "order-2",
          amount_pesewas: 15000, // GHS 150.00
          payment_status: "pending",
          paystack_reference: ref,
        },
        async (reference) => ({
          status: "success",
          reference,
          amount: 15000,
          currency: "GHS",
          paid_at: "2026-11-24T12:00:00Z",
        })
      );

    const rawBody = JSON.stringify({
      event: "charge.success",
      data: { reference: ref, status: "success" },
    });
    const signature = signPayload(rawBody);

    const first = await processPaystackWebhook(rawBody, signature, deps);
    const second = await processPaystackWebhook(rawBody, signature, deps);

    assert.equal(first.httpStatus, 200);
    assert.equal(first.body.status, "marked_paid");

    assert.equal(second.httpStatus, 200);
    assert.equal(second.body.status, "already_paid");

    assert.equal(getOrder(ref)?.payment_status, "paid");
    assert.equal(getVerifyCalls(), 1);
    assert.equal(getUpdateCalls(), 1);
  });

  it("wrong-amount case: rejects mismatched amount and leaves order pending", async () => {
    const ref = "ac_1700000000_wrong_amt";
    const { deps, getOrder, getVerifyCalls, getUpdateCalls } =
      createInMemoryDeps(
        {
          id: "order-3",
          amount_pesewas: 45000, // Expected GHS 450.00
          payment_status: "pending",
          paystack_reference: ref,
        },
        async (reference) => ({
          status: "success",
          reference,
          amount: 10000, // Only GHS 100.00 paid
          currency: "GHS",
          paid_at: "2026-11-24T12:00:00Z",
        })
      );

    const rawBody = JSON.stringify({
      event: "charge.success",
      data: { reference: ref, status: "success" },
    });
    const signature = signPayload(rawBody);

    const res = await processPaystackWebhook(rawBody, signature, deps);

    assert.equal(res.httpStatus, 400);
    assert.equal(res.body.error, "Amount or currency mismatch");
    assert.equal(getOrder(ref)?.payment_status, "pending");
    assert.equal(getVerifyCalls(), 1);
    assert.equal(getUpdateCalls(), 0);
  });

  it("rejects invalid webhook signatures with 401", async () => {
    const ref = "ac_1700000000_bad_sig";
    const { deps, getOrder, getVerifyCalls, getUpdateCalls } =
      createInMemoryDeps(
        {
          id: "order-4",
          amount_pesewas: 20000,
          payment_status: "pending",
          paystack_reference: ref,
        },
        async () => {
          throw new Error("should not call verify on bad signature");
        }
      );

    const rawBody = JSON.stringify({
      event: "charge.success",
      data: { reference: ref },
    });

    const res = await processPaystackWebhook(rawBody, "invalid-signature", deps);

    assert.equal(res.httpStatus, 401);
    assert.equal(getOrder(ref)?.payment_status, "pending");
    assert.equal(getVerifyCalls(), 0);
    assert.equal(getUpdateCalls(), 0);
  });

  it("handles failed and abandoned payments cleanly", async () => {
    const failedRef = "ac_1700000000_failed";
    const failedCtx = createInMemoryDeps(
      {
        id: "order-5",
        amount_pesewas: 20000,
        payment_status: "pending",
        paystack_reference: failedRef,
      },
      async (reference) => ({
        status: "failed",
        reference,
        amount: 20000,
        currency: "GHS",
        paid_at: null,
      })
    );

    const failedBody = JSON.stringify({
      event: "charge.failed",
      data: { reference: failedRef, status: "failed" },
    });
    const failedRes = await processPaystackWebhook(
      failedBody,
      signPayload(failedBody),
      failedCtx.deps
    );

    assert.equal(failedRes.httpStatus, 200);
    assert.equal(failedRes.body.status, "marked_failed");
    assert.equal(failedCtx.getOrder(failedRef)?.payment_status, "failed");

    const abandonedRef = "ac_1700000000_abandoned";
    const abandonedCtx = createInMemoryDeps(
      {
        id: "order-6",
        amount_pesewas: 20000,
        payment_status: "pending",
        paystack_reference: abandonedRef,
      },
      async (reference) => ({
        status: "abandoned",
        reference,
        amount: 20000,
        currency: "GHS",
        paid_at: null,
      })
    );

    const abandonedBody = JSON.stringify({
      event: "charge.abandoned",
      data: { reference: abandonedRef, status: "abandoned" },
    });
    const abandonedRes = await processPaystackWebhook(
      abandonedBody,
      signPayload(abandonedBody),
      abandonedCtx.deps
    );

    assert.equal(abandonedRes.httpStatus, 200);
    assert.equal(abandonedRes.body.status, "marked_abandoned");
    assert.equal(abandonedCtx.getOrder(abandonedRef)?.payment_status, "failed");
  });
});
