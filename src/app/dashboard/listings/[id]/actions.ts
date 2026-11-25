"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth";
import {
  buildStatusSmsMessage,
  sendSmsQueue,
  type NotifiableListingStatus,
} from "@/lib/arkesel";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_UPDATE_STATUSES = new Set<NotifiableListingStatus>([
  "ordered",
  "shipped",
  "arrived",
  "ready",
]);

export async function closeListingEarly(listingId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!UUID_REGEX.test(listingId)) {
    return { ok: false, error: "Invalid listing ID." };
  }

  const { supabase, importer } = await getAuthContext();

  if (!supabase || !importer) {
    return { ok: false, error: "Not authenticated." };
  }

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("id, slug, status")
    .eq("id", listingId)
    .eq("importer_id", importer.id)
    .maybeSingle();

  if (fetchError || !listing) {
    return { ok: false, error: "Listing not found." };
  }

  if (listing.status !== "open") {
    return { ok: false, error: "Listing is already closed." };
  }

  const { error: updateError } = await supabase
    .from("listings")
    .update({ status: "closed" })
    .eq("id", listing.id)
    .eq("importer_id", importer.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await supabase.from("status_updates").insert({
    listing_id: listing.id,
    status: "closed",
    note: "Closed early by importer",
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/listings/${listing.id}`);
  revalidatePath(`/l/${listing.slug}`);
  revalidatePath(`/l/${listing.slug}/track`);

  return { ok: true };
}

export type UpdateListingStatusResult = {
  ok: boolean;
  error?: string;
  totalRecipients?: number;
  sentCount?: number;
  failedCount?: number;
};

export async function updateListingStatus(
  listingId: string,
  status: NotifiableListingStatus,
  note: string,
  proofImageUrl?: string | null
): Promise<UpdateListingStatusResult> {
  if (!UUID_REGEX.test(listingId)) {
    return { ok: false, error: "Invalid listing ID." };
  }

  if (!ALLOWED_UPDATE_STATUSES.has(status)) {
    return { ok: false, error: "Invalid status selected." };
  }

  if (typeof note !== "string" || note.trim().length > 200) {
    return { ok: false, error: "Note must be 200 characters or fewer." };
  }

  const safeProofUrl =
    typeof proofImageUrl === "string" &&
    /^https:\/\/[a-z0-9.-]+\.supabase\.co\/storage\/v1\/object\/public\/listing-images\//i.test(
      proofImageUrl.trim()
    )
      ? proofImageUrl.trim()
      : null;

  const { supabase, importer } = await getAuthContext();
  if (!supabase || !importer) {
    return { ok: false, error: "Not authenticated." };
  }

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("id, slug, title")
    .eq("id", listingId)
    .eq("importer_id", importer.id)
    .maybeSingle();

  if (fetchError || !listing) {
    return { ok: false, error: "Listing not found." };
  }

  const trimmedNote = note.trim() || null;

  // 1. Update listing status
  const { error: updateError } = await supabase
    .from("listings")
    .update({ status })
    .eq("id", listing.id)
    .eq("importer_id", importer.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // 2. Save status_update record
  const { data: statusUpdate, error: statusInsertError } = await supabase
    .from("status_updates")
    .insert({
      listing_id: listing.id,
      status,
      note: trimmedNote,
      proof_image_url: safeProofUrl,
    })
    .select("id")
    .single();

  if (statusInsertError || !statusUpdate) {
    return {
      ok: false,
      error: statusInsertError?.message || "Could not save status update.",
    };
  }

  // 3. Fetch all paid buyers for this listing
  const { data: paidOrders } = await supabase
    .from("orders")
    .select("buyer_phone")
    .eq("listing_id", listing.id)
    .eq("payment_status", "paid");

  const recipients = Array.from(
    new Set((paidOrders ?? []).map((o) => o.buyer_phone))
  );

  // 4. Queue SMS sends via Arkesel so one failure never blocks the rest
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const trackUrl = appUrl ? `${appUrl}/l/${listing.slug}/track` : undefined;
  const message = buildStatusSmsMessage({
    title: listing.title,
    status,
    note: trimmedNote,
    trackUrl,
  });

  const results = await sendSmsQueue({
    recipients,
    message,
    concurrency: 5,
  });

  // 5. Log every delivery result in sms_logs
  if (results.length > 0) {
    await supabase.from("sms_logs").insert(
      results.map((r) => ({
        listing_id: listing.id,
        status_update_id: statusUpdate.id,
        recipient_phone: r.recipientPhone,
        message,
        delivery_status: r.deliveryStatus,
        provider_response: r.providerResponse,
        error_message: r.errorMessage,
      }))
    );
  }

  const sentCount = results.filter((r) => r.deliveryStatus === "sent").length;
  const failedCount = results.length - sentCount;

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/listings/${listing.id}`);
  revalidatePath(`/l/${listing.slug}`);
  revalidatePath(`/l/${listing.slug}/track`);

  return {
    ok: true,
    totalRecipients: results.length,
    sentCount,
    failedCount,
  };
}
