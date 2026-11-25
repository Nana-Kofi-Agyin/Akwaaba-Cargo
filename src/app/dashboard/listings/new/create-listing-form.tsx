"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  formatGhs,
  generateListingSlug,
  ghsToPesewas,
} from "@/lib/format";
import {
  compressListingImage,
  formatFileSize,
} from "@/lib/image-compress";
import { ShareListingActions } from "@/components/share-listing-actions";
import type { ShippingMethod } from "@/types/database";

type CreatedListing = {
  id: string;
  slug: string;
  title: string;
  price_pesewas: number;
  deadline: string;
};

type CreateListingFormProps = {
  importerId: string;
  userId: string;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PHOTOS = 5;

export function CreateListingForm({
  importerId,
  userId,
}: CreateListingFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceGhs, setPriceGhs] = useState("");
  const [fullPriceGhs, setFullPriceGhs] = useState("");
  const [minQty, setMinQty] = useState("1");
  const [maxQtyPerOrder, setMaxQtyPerOrder] = useState("");
  const [shippingMethod, setShippingMethod] = useState<"" | ShippingMethod>("");
  const [estimatedArrival, setEstimatedArrival] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [deliveryFeeGhs, setDeliveryFeeGhs] = useState("");
  const [deadline, setDeadline] = useState("");

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageInfo, setImageInfo] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedListing | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setImageInfo(null);
    const selected = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS);

    if (selected.length === 0) {
      setImageFiles([]);
      setImagePreviews([]);
      return;
    }

    for (const file of selected) {
      if (file.size > MAX_IMAGE_BYTES * 3) {
        setError("Each photo must be 15 MB or smaller before compression.");
        e.target.value = "";
        return;
      }
    }

    setCompressing(true);
    try {
      const compressedFiles: File[] = [];
      const previews: string[] = [];
      let totalOrig = 0;
      let totalCompressed = 0;

      for (const file of selected) {
        const result = await compressListingImage(file);
        if (result.file.size > MAX_IMAGE_BYTES) {
          setError("Each photo must be 5 MB or smaller after compression.");
          e.target.value = "";
          return;
        }
        compressedFiles.push(result.file);
        previews.push(URL.createObjectURL(result.file));
        totalOrig += result.originalBytes;
        totalCompressed += result.compressedBytes;
      }

      setImageFiles(compressedFiles);
      setImagePreviews(previews);
      setImageInfo(
        `${compressedFiles.length} ${compressedFiles.length === 1 ? "photo" : "photos"} ready (${formatFileSize(totalOrig)} → ${formatFileSize(totalCompressed)})`
      );
    } finally {
      setCompressing(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setError("Please enter a title of at least 3 characters.");
      return;
    }

    const pricePesewas = ghsToPesewas(priceGhs);
    if (!pricePesewas) {
      setError("Please enter a valid price in GHS greater than 0.");
      return;
    }

    let fullPricePesewas: number | null = null;
    if (fullPriceGhs.trim() !== "") {
      fullPricePesewas = ghsToPesewas(fullPriceGhs);
      if (!fullPricePesewas || fullPricePesewas < pricePesewas) {
        setError(
          "Full price must be greater than or equal to the upfront price/deposit."
        );
        return;
      }
    }

    const parsedMinQty = Number.parseInt(minQty, 10);
    if (!Number.isInteger(parsedMinQty) || parsedMinQty < 1) {
      setError("Minimum quantity must be at least 1.");
      return;
    }

    let parsedMaxQty: number | null = null;
    if (maxQtyPerOrder.trim() !== "") {
      parsedMaxQty = Number.parseInt(maxQtyPerOrder, 10);
      if (!Number.isInteger(parsedMaxQty) || parsedMaxQty < 1) {
        setError("Maximum quantity per order must be at least 1.");
        return;
      }
    }

    let deliveryFeePesewas: number | null = null;
    if (deliveryFeeGhs.trim() !== "") {
      const parsedFee = Number(deliveryFeeGhs);
      if (!Number.isFinite(parsedFee) || parsedFee < 0) {
        setError("Delivery fee must be 0 or greater.");
        return;
      }
      deliveryFeePesewas = Math.round(parsedFee * 100);
    }

    const deadlineDate = new Date(deadline);
    if (!deadline || Number.isNaN(deadlineDate.getTime())) {
      setError("Please pick a valid deadline.");
      return;
    }

    if (deadlineDate.getTime() <= Date.now()) {
      setError("Deadline must be in the future.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const uploadedUrls: string[] = [];

      for (const file of imageFiles) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext)
          ? ext
          : "jpg";
        const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setError(`Photo upload failed: ${uploadError.message}`);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("listing-images")
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrlData.publicUrl);
      }

      let savedListing: CreatedListing | null = null;
      let lastError: string | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const slug = generateListingSlug(trimmedTitle);
        const { data, error: insertError } = await supabase
          .from("listings")
          .insert({
            importer_id: importerId,
            slug,
            title: trimmedTitle,
            description: description.trim() || null,
            image_url: uploadedUrls[0] ?? null,
            gallery_urls: uploadedUrls,
            price_pesewas: pricePesewas,
            full_price_pesewas: fullPricePesewas,
            min_qty: parsedMinQty,
            max_qty_per_order: parsedMaxQty,
            shipping_method: shippingMethod || null,
            estimated_arrival: estimatedArrival.trim() || null,
            pickup_location: pickupLocation.trim() || null,
            delivery_fee_pesewas: deliveryFeePesewas,
            deadline: deadlineDate.toISOString(),
            status: "open",
          })
          .select("id, slug, title, price_pesewas, deadline")
          .single();

        if (!insertError && data) {
          savedListing = data;
          break;
        }

        if (insertError?.code === "23505") {
          lastError = insertError.message;
          continue;
        }

        lastError = insertError?.message ?? "Failed to save listing.";
        break;
      }

      if (!savedListing) {
        setError(lastError ?? "Could not create listing. Please try again.");
        return;
      }

      setCreated(savedListing);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setCreated(null);
    setTitle("");
    setDescription("");
    setPriceGhs("");
    setFullPriceGhs("");
    setMinQty("1");
    setMaxQtyPerOrder("");
    setShippingMethod("");
    setEstimatedArrival("");
    setPickupLocation("");
    setDeliveryFeeGhs("");
    setDeadline("");
    setImageFiles([]);
    setImagePreviews([]);
    setImageInfo(null);
    setError(null);
  }

  if (created) {
    return (
      <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
        <div>
          <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[#0f6b47]">
            Batch live
          </span>
          <h2 className="mt-2 text-xl font-bold text-gray-900">
            {created.title}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {formatGhs(created.price_pesewas)} · Deadline{" "}
            {new Date(created.deadline).toLocaleDateString("en-GH", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        <ShareListingActions
          slug={created.slug}
          title={created.title}
          pricePesewas={created.price_pesewas}
          deadline={created.deadline}
        />

        <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
          <button
            type="button"
            onClick={handleReset}
            className="font-medium text-[#0f6b47] hover:underline"
          >
            + Create another
          </button>
          <Link
            href="/dashboard"
            className="font-medium text-gray-600 hover:text-gray-900"
          >
            Back to batches
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
    >
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-gray-700"
        >
          Product title
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Rechargeable Mini Fan (Batch 4)"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-[#0f6b47] focus:outline-none focus:ring-2 focus:ring-[#0f6b47]/20"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700"
        >
          Description <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Sizes, colours, specs, or pickup notes..."
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-[#0f6b47] focus:outline-none focus:ring-2 focus:ring-[#0f6b47]/20"
        />
      </div>

      <div>
        <label
          htmlFor="photo"
          className="block text-sm font-medium text-gray-700"
        >
          Product photos{" "}
          <span className="font-normal text-gray-400">(up to 5)</span>
        </label>
        <input
          id="photo"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-[#0f6b47] hover:file:bg-emerald-100"
        />
        <p className="mt-1 text-xs text-gray-500">
          {compressing
            ? "Optimizing photos for mobile..."
            : imageInfo || "Auto-compressed for fast WhatsApp & mobile loading."}
        </p>
        {imagePreviews.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {imagePreviews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={`Preview ${i + 1}`}
                className="h-20 w-20 shrink-0 rounded-lg border border-gray-200 object-cover"
              />
            ))}
          </div>
        )}
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="priceGhs"
            className="block text-sm font-medium text-gray-700"
          >
            Pay now (GHS)
          </label>
          <input
            id="priceGhs"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="1"
            required
            value={priceGhs}
            onChange={(e) => setPriceGhs(e.target.value)}
            placeholder="200.00"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-[#0f6b47] focus:outline-none focus:ring-2 focus:ring-[#0f6b47]/20"
          />
        </div>

        <div>
          <label
            htmlFor="fullPriceGhs"
            className="block text-sm font-medium text-gray-700"
          >
            Full price{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="fullPriceGhs"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="1"
            value={fullPriceGhs}
            onChange={(e) => setFullPriceGhs(e.target.value)}
            placeholder="680.00"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-[#0f6b47] focus:outline-none focus:ring-2 focus:ring-[#0f6b47]/20"
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-gray-500">
        Leave Full price blank for full upfront payment. Set it higher than Pay
        now to collect a deposit with balance due on pickup.
      </p>

      {/* Quantities */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="minQty"
            className="block text-sm font-medium text-gray-700"
          >
            Min. batch qty
          </label>
          <input
            id="minQty"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            required
            value={minQty}
            onChange={(e) => setMinQty(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 focus:border-[#0f6b47] focus:outline-none focus:ring-2 focus:ring-[#0f6b47]/20"
          />
        </div>

        <div>
          <label
            htmlFor="maxQtyPerOrder"
            className="block text-sm font-medium text-gray-700"
          >
            Max / order{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="maxQtyPerOrder"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={maxQtyPerOrder}
            onChange={(e) => setMaxQtyPerOrder(e.target.value)}
            placeholder="e.g. 5"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-[#0f6b47] focus:outline-none focus:ring-2 focus:ring-[#0f6b47]/20"
          />
        </div>
      </div>

      {/* Shipping & Arrival */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="shippingMethod"
            className="block text-sm font-medium text-gray-700"
          >
            Shipping method
          </label>
          <select
            id="shippingMethod"
            value={shippingMethod}
            onChange={(e) =>
              setShippingMethod(e.target.value as "" | ShippingMethod)
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 focus:border-[#0f6b47] focus:outline-none focus:ring-2 focus:ring-[#0f6b47]/20"
          >
            <option value="">Not specified</option>
            <option value="air">Air freight</option>
            <option value="sea">Sea freight</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="estimatedArrival"
            className="block text-sm font-medium text-gray-700"
          >
            Est. arrival
          </label>
          <input
            id="estimatedArrival"
            type="text"
            value={estimatedArrival}
            onChange={(e) => setEstimatedArrival(e.target.value)}
            placeholder="e.g. Dec 10 – 15"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-[#0f6b47] focus:outline-none focus:ring-2 focus:ring-[#0f6b47]/20"
          />
        </div>
      </div>

      {/* Pickup & Delivery */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="pickupLocation"
            className="block text-sm font-medium text-gray-700"
          >
            Pickup location
          </label>
          <input
            id="pickupLocation"
            type="text"
            value={pickupLocation}
            onChange={(e) => setPickupLocation(e.target.value)}
            placeholder="e.g. Circle Mall, Accra"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-[#0f6b47] focus:outline-none focus:ring-2 focus:ring-[#0f6b47]/20"
          />
        </div>

        <div>
          <label
            htmlFor="deliveryFeeGhs"
            className="block text-sm font-medium text-gray-700"
          >
            Delivery fee (GHS)
          </label>
          <input
            id="deliveryFeeGhs"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={deliveryFeeGhs}
            onChange={(e) => setDeliveryFeeGhs(e.target.value)}
            placeholder="Blank = pickup only"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-[#0f6b47] focus:outline-none focus:ring-2 focus:ring-[#0f6b47]/20"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="deadline"
          className="block text-sm font-medium text-gray-700"
        >
          Order deadline
        </label>
        <input
          id="deadline"
          type="datetime-local"
          required
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-base text-gray-900 focus:border-[#0f6b47] focus:outline-none focus:ring-2 focus:ring-[#0f6b47]/20"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || compressing}
        className="w-full rounded-lg bg-[#0f6b47] px-4 py-3.5 text-base font-semibold text-white transition hover:bg-[#0a5236] disabled:opacity-60"
      >
        {loading
          ? "Saving listing..."
          : compressing
            ? "Optimizing photos..."
            : "Save & get share link"}
      </button>
    </form>
  );
}
