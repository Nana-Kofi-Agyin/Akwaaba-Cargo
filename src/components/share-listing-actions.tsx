"use client";

import { useState } from "react";
import { buildWhatsAppShareUrl } from "@/lib/format";

type ShareListingActionsProps = {
  slug: string;
  title: string;
  pricePesewas: number;
  deadline: string;
  compact?: boolean;
};

export function ShareListingActions({
  slug,
  title,
  pricePesewas,
  deadline,
  compact = false,
}: ShareListingActionsProps) {
  const [copied, setCopied] = useState(false);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "";

  const shareUrl = `${origin}/l/${slug}`;
  const whatsappUrl = buildWhatsAppShareUrl({
    title,
    pricePesewas,
    deadline,
    shareUrl,
  });

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older mobile browsers
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (compact) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-lg bg-[#25D366] px-3 py-2 text-center text-xs font-semibold text-white hover:bg-[#1fb858]"
        >
          WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs font-medium text-gray-500">Shareable link</p>
        <p className="mt-1 break-all font-mono text-sm text-gray-900">
          {shareUrl}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleCopy}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
        >
          {copied ? "Link copied!" : "Copy link"}
        </button>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-lg bg-[#25D366] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#1fb858]"
        >
          Share to WhatsApp
        </a>
      </div>
    </div>
  );
}
