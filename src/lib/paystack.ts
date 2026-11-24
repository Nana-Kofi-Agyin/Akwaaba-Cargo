import crypto from "crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("Missing PAYSTACK_SECRET_KEY environment variable");
  }
  return key;
}

export function generatePaystackReference(): string {
  const rand = crypto.randomBytes(6).toString("hex");
  return `ac_${Date.now()}_${rand}`;
}

/**
 * Verify Paystack webhook HMAC-SHA512 signature using timing-safe comparison.
 */
export function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
  secretKey: string = getPaystackSecretKey()
): boolean {
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");

  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expected, "utf8");

  if (sigBuf.length !== expBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Paystack requires an email field on transaction/initialize.
 * Since buyers have no accounts (name + phone only), synthesize a valid
 * deterministic email from their normalized Ghanaian phone number.
 */
export function phoneToPaystackEmail(normalizedPhone: string): string {
  const digits = normalizedPhone.replace(/\D/g, "");
  return `${digits}@orders.akwaabacargo.com`;
}

export type InitializePaystackParams = {
  email: string;
  amountPesewas: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
};

export type InitializePaystackResult = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export async function initializePaystackTransaction(
  params: InitializePaystackParams
): Promise<InitializePaystackResult> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountPesewas,
      currency: "GHS",
      reference: params.reference,
      channels: ["mobile_money"],
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });

  const payload = (await res.json()) as {
    status: boolean;
    message: string;
    data?: InitializePaystackResult;
  };

  if (!res.ok || !payload.status || !payload.data?.authorization_url) {
    throw new Error(payload.message || "Paystack initialization failed");
  }

  return payload.data;
}

export type VerifyPaystackResult = {
  status: string; // "success" | "failed" | "abandoned" | "ongoing" | ...
  reference: string;
  amount: number;
  currency: string;
  paid_at: string | null;
};

export async function verifyPaystackTransaction(
  reference: string
): Promise<VerifyPaystackResult | null> {
  const res = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getPaystackSecretKey()}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return null;
  }

  const payload = (await res.json()) as {
    status: boolean;
    data?: VerifyPaystackResult;
  };

  if (!payload.status || !payload.data) {
    return null;
  }

  return payload.data;
}
