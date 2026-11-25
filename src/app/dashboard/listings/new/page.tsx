import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { CreateListingForm } from "./create-listing-form";

export default async function NewListingPage() {
  const { user, importer } = await getAuthContext();
  if (!user || !importer) {
    redirect("/login");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create listing</h1>
          <p className="text-xs text-gray-500">
            Set up a new pre-order batch for your buyers.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-xs font-medium text-gray-600 hover:text-gray-900"
        >
          Back
        </Link>
      </div>

      <CreateListingForm importerId={importer.id} userId={user.id} />
    </div>
  );
}
