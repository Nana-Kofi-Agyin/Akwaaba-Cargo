"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeGhanaPhone } from "@/lib/format";

export function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedName = businessName.trim();
    if (trimmedName.length < 2) {
      setError("Please enter your business name.");
      return;
    }

    const normalizedPhone = normalizeGhanaPhone(phone);
    if (!normalizedPhone) {
      setError(
        "Enter a valid Ghanaian phone number (e.g. 024 123 4567 or +233 24 123 4567)."
      );
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("importers").insert({
        user_id: userId,
        name: trimmedName,
        phone: normalizedPhone,
      });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      router.push("/dashboard/listings/new");
      router.refresh();
    } catch {
      setError("Could not save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="businessName"
          className="block text-sm font-medium text-gray-700"
        >
          Business name
        </label>
        <input
          id="businessName"
          type="text"
          required
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. Ama's China Imports"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
        />
      </div>

      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-medium text-gray-700"
        >
          Phone number (Ghana)
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="024 123 4567"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
        />
        <p className="mt-1 text-xs text-gray-500">
          Used for your importer profile (MTN, Telecel, or AirtelTigo).
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-700 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
      >
        {loading ? "Saving..." : "Continue"}
      </button>
    </form>
  );
}
