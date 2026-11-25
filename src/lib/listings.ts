import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildImporterWhatsAppUrl } from "@/lib/format";
import type { ListingStatus } from "@/types/database";

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
  price_pesewas: number;
  full_price_pesewas: number | null;
  min_qty: number;
  deadline: string;
  status: ListingStatus;
  created_at: string;
  importer_name: string | null;
  importer_whatsapp_url: string | null;
  reserved_people: number;
  reserved_qty: number;
  status_updates: PublicStatusUpdate[];
};

/**
 * Fetches a listing by slug along with aggregate paid reservation counts
 * and public status timeline updates.
 * Wrapped in React cache() so generateMetadata and the page share one query.
 * Only returns public-safe fields (never exposes buyer PII).
 */
export const getPublicListingBySlug = cache(
  async (slug: string): Promise<PublicListing | null> => {
    const admin = createAdminClient();

    const { data: listing, error } = await admin
      .from("listings")
      .select(
        "id, slug, title, description, image_url, price_pesewas, full_price_pesewas, min_qty, deadline, status, created_at, importers(name, phone)"
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
        .select("id, status, note, proof_image_url, created_at")
        .eq("listing_id", listing.id)
        .order("created_at", { ascending: false }),
    ]);

    const reservedPeople = paidOrders?.length ?? 0;
    const reservedQty =
      paidOrders?.reduce((sum, order) => sum + order.qty, 0) ?? 0;

    const importerRel = listing.importers as
      | { name: string; phone: string }
      | { name: string; phone: string }[]
      | null;
    const importer = Array.isArray(importerRel) ? importerRel[0] : importerRel;

    return {
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      description: listing.description,
      image_url: listing.image_url,
      price_pesewas: listing.price_pesewas,
      full_price_pesewas: listing.full_price_pesewas ?? null,
      min_qty: listing.min_qty,
      deadline: listing.deadline,
      status: listing.status,
      created_at: listing.created_at,
      importer_name: importer?.name ?? null,
      importer_whatsapp_url: importer?.phone
        ? buildImporterWhatsAppUrl(importer.phone, listing.title)
        : null,
      reserved_people: reservedPeople,
      reserved_qty: reservedQty,
      status_updates: statusUpdates ?? [],
    };
  }
);
