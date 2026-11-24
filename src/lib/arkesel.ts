import type { ListingStatus } from "../types/database.ts";

const ARKESEL_SMS_URL = "https://sms.arkesel.com/api/v2/sms/send";

export type NotifiableListingStatus =
  | "ordered"
  | "shipped"
  | "arrived"
  | "ready";

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  open: "Open for pre-orders",
  closed: "Pre-orders closed",
  ordered: "Ordered from China",
  shipped: "Shipped to Ghana",
  arrived: "Arrived in Ghana",
  ready: "Ready for pickup",
};

/**
 * Arkesel expects Ghanaian phone numbers in international format without "+": 233XXXXXXXXX.
 */
export function toArkeselRecipient(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/**
 * Keep SMS short and in plain, friendly English.
 */
export function buildStatusSmsMessage(params: {
  title: string;
  status: NotifiableListingStatus;
  note?: string | null;
  trackUrl?: string;
}): string {
  const shortTitle =
    params.title.length > 36
      ? `${params.title.slice(0, 33).trim()}...`
      : params.title;

  const trimmedNote = params.note?.trim();
  const shortNote = trimmedNote
    ? trimmedNote.length > 60
      ? ` Note: ${trimmedNote.slice(0, 57).trim()}...`
      : ` Note: ${trimmedNote}`
    : "";

  const statusLine: Record<NotifiableListingStatus, string> = {
    ordered: `Good news! Your "${shortTitle}" batch has been ordered from China.`,
    shipped: `Your "${shortTitle}" batch has shipped from China to Ghana.`,
    arrived: `Your "${shortTitle}" batch has arrived in Ghana!`,
    ready: `Your "${shortTitle}" order is ready for pickup!`,
  };

  const linkPart = params.trackUrl ? ` Track: ${params.trackUrl}` : "";

  return `Akwaaba Cargo: ${statusLine[params.status]}${shortNote}${linkPart}`;
}

export type SmsSendResult = {
  recipientPhone: string;
  deliveryStatus: "sent" | "failed";
  providerResponse: string | null;
  errorMessage: string | null;
};

export type SingleSmsSender = (params: {
  recipientPhone: string;
  message: string;
}) => Promise<SmsSendResult>;

/**
 * Sends a single SMS via Arkesel v2 API. Never throws—returns a structured result.
 */
export async function sendArkeselSms(params: {
  recipientPhone: string;
  message: string;
}): Promise<SmsSendResult> {
  const apiKey = process.env.ARKESEL_API_KEY;
  const sender = (process.env.ARKESEL_SENDER_ID || "AkwaabaCrgo").slice(0, 11);

  if (!apiKey) {
    return {
      recipientPhone: params.recipientPhone,
      deliveryStatus: "failed",
      providerResponse: null,
      errorMessage: "Missing ARKESEL_API_KEY",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(ARKESEL_SMS_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender,
        message: params.message,
        recipients: [toArkeselRecipient(params.recipientPhone)],
      }),
      signal: controller.signal,
    });

    const responseText = await res.text();
    let parsed: { status?: string; message?: string } | null = null;
    try {
      parsed = JSON.parse(responseText) as { status?: string; message?: string };
    } catch {
      parsed = null;
    }

    const ok = res.ok && parsed?.status === "success";
    return {
      recipientPhone: params.recipientPhone,
      deliveryStatus: ok ? "sent" : "failed",
      providerResponse: responseText.slice(0, 500),
      errorMessage: ok
        ? null
        : parsed?.message || `Arkesel HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      recipientPhone: params.recipientPhone,
      deliveryStatus: "failed",
      providerResponse: null,
      errorMessage:
        err instanceof Error ? err.message : "Network error sending SMS",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Processes SMS sends through a bounded-concurrency queue so one failure
 * never blocks or aborts the remaining recipients.
 */
export async function sendSmsQueue(params: {
  recipients: string[];
  message: string;
  concurrency?: number;
  sender?: SingleSmsSender;
}): Promise<SmsSendResult[]> {
  const uniqueRecipients = Array.from(new Set(params.recipients));
  if (uniqueRecipients.length === 0) return [];

  const concurrency = Math.max(1, params.concurrency ?? 5);
  const sender = params.sender ?? sendArkeselSms;
  const results: SmsSendResult[] = new Array(uniqueRecipients.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < uniqueRecipients.length) {
      const current = nextIndex;
      nextIndex += 1;
      const recipientPhone = uniqueRecipients[current];

      try {
        results[current] = await sender({
          recipientPhone,
          message: params.message,
        });
      } catch (err) {
        results[current] = {
          recipientPhone,
          deliveryStatus: "failed",
          providerResponse: null,
          errorMessage:
            err instanceof Error ? err.message : "Unexpected SMS queue error",
        };
      }
    }
  }

  const workerCount = Math.min(concurrency, uniqueRecipients.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
