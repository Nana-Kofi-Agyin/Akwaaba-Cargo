/**
 * Format pesewas (integer) as Ghana Cedis, e.g. 15000 -> "GH₵ 150.00"
 */
export function formatGhs(pesewas: number): string {
  const cedis = pesewas / 100;
  return `GH₵ ${cedis.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Detect Ghana mobile money network label from a phone number prefix.
 */
export function detectGhanaNetwork(
  raw: string
): "MTN" | "Telecel" | "AT" | null {
  const digits = raw.replace(/\D/g, "");
  let prefix = "";
  if (digits.startsWith("233") && digits.length >= 5) {
    prefix = `0${digits.slice(3, 5)}`;
  } else if (digits.startsWith("0") && digits.length >= 3) {
    prefix = digits.slice(0, 3);
  } else if (digits.length >= 2) {
    prefix = `0${digits.slice(0, 2)}`;
  }

  if (["024", "025", "053", "054", "055", "059"].includes(prefix)) return "MTN";
  if (["020", "050"].includes(prefix)) return "Telecel";
  if (["026", "027", "056", "057"].includes(prefix)) return "AT";
  return null;
}

/**
 * Build a direct WhatsApp contact link (wa.me) to message the importer.
 */
export function buildImporterWhatsAppUrl(
  importerPhone: string,
  listingTitle: string
): string | null {
  const normalized = normalizeGhanaPhone(importerPhone);
  if (!normalized) return null;
  const waDigits = normalized.replace(/\D/g, "");
  const message = `Hi, I have a question about the "${listingTitle}" pre-order batch on Akwaaba Cargo.`;
  return `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`;
}

/**
 * Get 1-2 letter uppercase initials from a business name.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Convert a GHS decimal string or number into integer pesewas.
 * Returns null if invalid or <= 0.
 */
export function ghsToPesewas(value: string | number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const pesewas = Math.round(parsed * 100);
  return pesewas > 0 ? pesewas : null;
}

/**
 * Normalize a Ghanaian phone number to E.164 format (+233XXXXXXXXX).
 * Accepts: 0241234567, 055 123 4567, 233241234567, +233241234567.
 * Returns null if invalid.
 */
export function normalizeGhanaPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");

  let digits = cleaned;
  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  }

  // Local format: 0XXXXXXXXX (10 digits)
  if (/^0[235]\d{8}$/.test(digits)) {
    return `+233${digits.slice(1)}`;
  }

  // International format: 233XXXXXXXXX (12 digits)
  if (/^233[235]\d{8}$/.test(digits)) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Generate a readable, URL-safe unique slug from a listing title.
 * Example: "Wireless Earbuds Batch 3" -> "wireless-earbuds-batch-3-k7m2"
 */
export function generateListingSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");

  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let suffix = "";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) {
    suffix += chars[bytes[i] % chars.length];
  }

  return base ? `${base}-${suffix}` : `batch-${suffix}`;
}

/**
 * Build a WhatsApp share link (wa.me) with a prefilled pre-order message.
 */
export function buildWhatsAppShareUrl(params: {
  title: string;
  pricePesewas: number;
  deadline: string;
  shareUrl: string;
}): string {
  const formattedDate = new Date(params.deadline).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const text = [
    `New Pre-Order Batch: ${params.title}`,
    `Price: ${formatGhs(params.pricePesewas)}`,
    `Order deadline: ${formattedDate}`,
    ``,
    `Reserve your slot & pay deposit via MoMo here:`,
    params.shareUrl,
  ].join("\n");

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
