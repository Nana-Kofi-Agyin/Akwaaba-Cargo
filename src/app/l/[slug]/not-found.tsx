import Link from "next/link";

export default function ListingNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 text-center">
      <p className="text-sm font-semibold text-teal-700">Akwaaba Cargo</p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">
        Pre-order link not found
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        This batch link may be incorrect or no longer available. Check the link
        shared in your WhatsApp group.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
      >
        Go home
      </Link>
    </main>
  );
}
