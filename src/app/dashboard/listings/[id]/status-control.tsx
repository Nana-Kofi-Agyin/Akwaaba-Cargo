"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressListingImage, formatFileSize } from "@/lib/image-compress";
import { updateListingStatus } from "./actions";
import type { ListingStatus } from "@/types/database";
import type { NotifiableListingStatus } from "@/lib/arkesel";

const STATUS_OPTIONS: { value: NotifiableListingStatus; label: string }[] = [
  { value: "ordered", label: "Ordered" },
  { value: "shipped", label: "Shipped" },
  { value: "arrived", label: "Arrived" },
  { value: "ready", label: "Ready for pickup" },
];

type StatusControlProps = {
  listingId: string;
  userId: string;
  currentStatus: ListingStatus;
  paidBuyerCount: number;
};

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export function StatusControl({
  listingId,
  userId,
  currentStatus,
  paidBuyerCount,
}: StatusControlProps) {
  const defaultSelection: NotifiableListingStatus =
    currentStatus === "ordered"
      ? "shipped"
      : currentStatus === "shipped"
        ? "arrived"
        : currentStatus === "arrived" || currentStatus === "ready"
          ? "ready"
          : "ordered";

  const [selectedStatus, setSelectedStatus] =
    useState<NotifiableListingStatus>(defaultSelection);
  const [note, setNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofInfo, setProofInfo] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleProofChange(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setProofInfo(null);
    const file = e.target.files?.[0] ?? null;

    if (!file) {
      setProofFile(null);
      return;
    }

    if (file.size > MAX_PROOF_BYTES * 3) {
      setError("Proof photo is too large (max 15 MB before compression).");
      e.target.value = "";
      return;
    }

    setCompressing(true);
    try {
      const result = await compressListingImage(file);
      if (result.file.size > MAX_PROOF_BYTES) {
        setError("Proof photo must be 5 MB or smaller after compression.");
        e.target.value = "";
        return;
      }

      setProofFile(result.file);
      setProofInfo(
        result.wasCompressed
          ? `Ready (${formatFileSize(result.originalBytes)} → ${formatFileSize(result.compressedBytes)})`
          : `Ready (${formatFileSize(result.file.size)})`
      );
    } finally {
      setCompressing(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResultMessage(null);

    startTransition(async () => {
      let proofUrl: string | null = null;

      if (proofFile) {
        const supabase = createClient();
        const ext = proofFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext)
          ? ext
          : "jpg";
        const filePath = `${userId}/proofs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(filePath, proofFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setError(`Proof photo upload failed: ${uploadError.message}`);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("listing-images")
          .getPublicUrl(filePath);
        proofUrl = urlData.publicUrl;
      }

      const res = await updateListingStatus(
        listingId,
        selectedStatus,
        note,
        proofUrl
      );

      if (!res.ok) {
        setError(res.error ?? "Failed to update status.");
        return;
      }

      setNote("");
      setProofFile(null);
      setProofInfo(null);

      if ((res.totalRecipients ?? 0) === 0) {
        setResultMessage(
          "Status saved. No paid buyers to notify by SMS yet."
        );
      } else if ((res.failedCount ?? 0) === 0) {
        setResultMessage(
          `Status saved. SMS sent to ${res.sentCount} of ${res.totalRecipients} paid buyers.`
        );
      } else {
        setResultMessage(
          `Status saved. SMS sent to ${res.sentCount} of ${res.totalRecipients} paid buyers (${res.failedCount} failed — check SMS logs).`
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
    >
      <div>
        <h2 className="text-base font-bold text-gray-900">
          Update batch status &amp; notify buyers
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Updates the public tracking timeline and sends an SMS via Arkesel to{" "}
          {paidBuyerCount === 1
            ? "1 paid buyer"
            : `${paidBuyerCount} paid buyers`}
          .
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const active = selectedStatus === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={isPending}
              onClick={() => setSelectedStatus(opt.value)}
              className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                active
                  ? "border-[#0f6b47] bg-[#0f6b47] text-white"
                  : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div>
        <label
          htmlFor="statusNote"
          className="block text-xs font-medium text-gray-700"
        >
          Optional note{" "}
          <span className="font-normal text-gray-400">
            (included in SMS &amp; timeline)
          </span>
        </label>
        <textarea
          id="statusNote"
          rows={2}
          maxLength={140}
          disabled={isPending}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Pickup at Circle Mall Shop 12 from 9am–5pm"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0f6b47] focus:outline-none focus:ring-2 focus:ring-[#0f6b47]/20"
        />
      </div>

      <div>
        <label
          htmlFor="proofPhoto"
          className="block text-xs font-medium text-gray-700"
        >
          Proof photo{" "}
          <span className="font-normal text-gray-400">
            (optional — supplier receipt, packing, or arrival photo)
          </span>
        </label>
        <input
          id="proofPhoto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={isPending || compressing}
          onChange={handleProofChange}
          className="mt-1 block w-full text-xs text-gray-600 file:mr-2.5 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#0f6b47] hover:file:bg-emerald-100"
        />
        {(compressing || proofInfo) && (
          <p className="mt-1 text-[11px] text-gray-500">
            {compressing ? "Compressing proof photo..." : proofInfo}
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {resultMessage && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-[#0f6b47]">
          {resultMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || compressing}
        className="w-full rounded-lg bg-[#0f6b47] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0a5236] disabled:opacity-60"
      >
        {isPending
          ? "Updating & sending SMS..."
          : compressing
            ? "Optimizing proof photo..."
            : `Save status${paidBuyerCount > 0 ? ` & SMS ${paidBuyerCount} buyer${paidBuyerCount === 1 ? "" : "s"}` : ""}`}
      </button>
    </form>
  );
}
