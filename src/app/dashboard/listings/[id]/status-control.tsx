"use client";

import { useState, useTransition, type FormEvent } from "react";
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
  currentStatus: ListingStatus;
  paidBuyerCount: number;
};

export function StatusControl({
  listingId,
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
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResultMessage(null);

    startTransition(async () => {
      const res = await updateListingStatus(listingId, selectedStatus, note);
      if (!res.ok) {
        setError(res.error ?? "Failed to update status.");
        return;
      }

      setNote("");
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
          Updates the public timeline and sends an SMS via Arkesel to{" "}
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
                  ? "border-teal-700 bg-teal-700 text-white"
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
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {resultMessage && (
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-900">
          {resultMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
      >
        {isPending
          ? "Updating & sending SMS..."
          : `Save status${paidBuyerCount > 0 ? ` & SMS ${paidBuyerCount} buyer${paidBuyerCount === 1 ? "" : "s"}` : ""}`}
      </button>
    </form>
  );
}
