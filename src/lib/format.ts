/**
 * Format pesewas (integer) as Ghana Cedis, e.g. 15000 -> "GHS 150.00"
 */
export function formatGhs(pesewas: number): string {
  const cedis = pesewas / 100;
  return `GHS ${cedis.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
