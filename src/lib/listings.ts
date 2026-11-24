import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ListingStatus } from "@/types/database";

export type PublicStatusUpdate = {
  id: string;
  status: ListingStatus;
  note: string | null;
  created_at: string;
};

export type PublicListing = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  price_pesewas: number;
  min_qty: number;
  deadline: string;
  status: ListingStatus;
  importer_name: string | null;
  reserved_people: number;
  reserved_qty: number;
  status_updates: PublicStatusUpdate[];
};

/**
 * Fetches a listing by slug along with aggregate paid reservation counts
 * and public status timeline updates.
 * Wrapped in React cache() so generateMetadata and the page share one query.
 * Only returns public-safe fields (never exposes buyer PII or importer phone).
 */
export const getPublicListingBySlug = cache(
  async (slug: string): Promise<PublicListing | null> => {
    const admin = createAdminClient();

    const { data: listing, error } = await admin
      .from("listings")
      .select(
        "id, slug, title, description, image_url, price_pesewas, min_qty, deadline, status, importers(name)"
      )
      .eq("slug", slug)
      .maybeSingle();

    if (error || !listing) {
      return null;
    }

    const [{ data: paidOrders }, { data: statusUpdates }] = await Promise.all([
      admin
        .from("orders")
        .select("qty")
        .eq("listing_id", listing.id)
        .eq("payment_status", "paid"),
      admin
        .from("status_updates")
        .select("id, status, note, created_at")
        .eq("listing_id", listing.id)
        .order("created_at", { ascending: false }),
    ]);

    const reservedPeople = paidOrders?.length ?? 0;
    const reservedQty =
      paidOrders?.reduce((sum, order) => sum + order.qty, 0) ?? 0;

    const importerRel = listing.importers as
      | { name: string }
      | { name: string }[]
      | null;
    const importerName = Array.isArray(importerRel)
      ? (importerRel[0]?.name ?? null)
      : (importerRel?.name ?? null);

    return {
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      description: listing.description,
      image_url: listing.image_url,
      price_pesewas: listing.price_pesewas,
      min_qty: listing.min_qty,
      deadline: listing.deadline,
      status: listing.status,
      importer_name: importerName,
      reserved_people: reservedPeople,
      reserved_qty: reservedQty,
      status_updates: statusUpdates ?? [],
    };
  }
);
