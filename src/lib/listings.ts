import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildImporterWhatsAppUrl } from "@/lib/format";
import type { ListingStatus, ShippingMethod } from "@/types/database";

export type PublicStatusUpdate = {
  id: string;
  status: ListingStatus;
  note: string | null;
  proof_image_url: string | null;
  created_at: string;
};

export type PublicListing = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  photos: string[];
  price_pesewas: number;
  full_price_pesewas: number | null;
  min_qty: number;
  max_qty_per_order: number | null;
  shipping_method: ShippingMethod | null;
  estimated_arrival: string | null;
  pickup_location: string | null;
  delivery_fee_pesewas: number | null;
  deadline: string;
  status: ListingStatus;
  created_at: string;
  importer_name: string | null;
  importer_whatsapp_url: string | null;
  reserved_people: number;
  reserved_qty: number;
  status_updates: PublicStatusUpdate[];
};

const FULL_LISTING_SELECT =
  "id, slug, title, description, image_url, gallery_urls, price_pesewas, full_price_pesewas, min_qty, max_qty_per_order, shipping_method, estimated_arrival, pickup_location, delivery_fee_pesewas, deadline, status, created_at, importers(name, phone)";

const BASE_LISTING_SELECT =
  "id, slug, title, description, image_url, price_pesewas, min_qty, deadline, status, created_at";

/**
 * Fetches a listing by slug along with aggregate paid reservation counts
 * and public status timeline updates.
 * Wrapped in React cache() so generateMetadata and the page share one query.
 * Only returns public-safe fields (never exposes buyer PII).
 */
export const getPublicListingBySlug = cache(
  async (rawSlug: string): Promise<PublicListing | null> => {
    const slug = decodeURIComponent(rawSlug).trim();
    if (!slug) return null;

    const hasServiceRole = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const db = hasServiceRole ? createAdminClient() : await createClient();

    // Try full query first (includes optional 0004/0005 columns & importer join)
    const { data: fullListing, error: fullError } = await db
      .from("listings")
      .select(FULL_LISTING_SELECT)
      .eq("slug", slug)
      .maybeSingle();

    type ListingRowShape = {
      id: string;
      slug: string;
      title: string;
      description: string | null;
      image_url: string | null;
      gallery_urls?: string[] | null;
      price_pesewas: number;
      full_price_pesewas?: number | null;
      min_qty: number;
      max_qty_per_order?: number | null;
      shipping_method?: ShippingMethod | null;
      estimated_arrival?: string | null;
      pickup_location?: string | null;
      delivery_fee_pesewas?: number | null;
      deadline: string;
      status: ListingStatus;
      created_at: string;
      importers?:
        | { name: string; phone: string }
        | { name: string; phone: string }[]
        | null;
    };

    let listing: ListingRowShape | null = fullListing as ListingRowShape | null;

    // Fallback to base columns if a newer migration (0004/0005) hasn't been run
    // or if using the anon client where importers join is blocked by RLS.
    if (fullError) {
      console.error("[getPublicListingBySlug] full query failed:", fullError);
      const { data: baseListing, error: baseError } = await db
        .from("listings")
        .select(BASE_LISTING_SELECT)
        .eq("slug", slug)
        .maybeSingle();

      if (baseError) {
        console.error("[getPublicListingBySlug] base query failed:", baseError);
        return null;
      }
      listing = baseListing as ListingRowShape | null;
    }

    if (!listing) {
      return null;
    }

    const [{ data: paidOrders }, { data: statusUpdates, error: updatesError }] =
      await Promise.all([
        db
          .from("orders")
          .select("qty")
          .eq("listing_id", listing.id)
          .eq("payment_status", "paid"),
        db
          .from("status_updates")
          .select("id, status, note, proof_image_url, created_at")
          .eq("listing_id", listing.id)
          .order("created_at", { ascending: false }),
      ]);

    let resolvedUpdates: PublicStatusUpdate[] =
      (statusUpdates as PublicStatusUpdate[] | null) ?? [];

    // Fallback if proof_image_url column (0004) isn't present yet
    if (updatesError) {
      const { data: baseUpdates } = await db
        .from("status_updates")
        .select("id, status, note, created_at")
        .eq("listing_id", listing.id)
        .order("created_at", { ascending: false });

      resolvedUpdates = (baseUpdates ?? []).map((u) => ({
        ...u,
        proof_image_url: null,
      }));
    }

    const reservedPeople = paidOrders?.length ?? 0;
    const reservedQty =
      paidOrders?.reduce((sum, order) => sum + order.qty, 0) ?? 0;

    const importerRel = listing.importers ?? null;
    const importer = Array.isArray(importerRel) ? importerRel[0] : importerRel;

    const photoSet = new Set<string>();
    if (listing.image_url) photoSet.add(listing.image_url);
    for (const url of listing.gallery_urls ?? []) {
      if (url) photoSet.add(url);
    }

    return {
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      description: listing.description,
      image_url: listing.image_url,
      photos: Array.from(photoSet),
      price_pesewas: listing.price_pesewas,
      full_price_pesewas: listing.full_price_pesewas ?? null,
      min_qty: listing.min_qty,
      max_qty_per_order: listing.max_qty_per_order ?? null,
      shipping_method: listing.shipping_method ?? null,
      estimated_arrival: listing.estimated_arrival ?? null,
      pickup_location: listing.pickup_location ?? null,
      delivery_fee_pesewas: listing.delivery_fee_pesewas ?? null,
      deadline: listing.deadline,
      status: listing.status,
      created_at: listing.created_at,
      importer_name: importer?.name ?? null,
      importer_whatsapp_url: importer?.phone
        ? buildImporterWhatsAppUrl(importer.phone, listing.title)
        : null,
      reserved_people: reservedPeople,
      reserved_qty: reservedQty,
      status_updates: resolvedUpdates,
    };
  }
);
