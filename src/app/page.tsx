import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";

const STEPS = [
  {
    number: "1",
    title: "Create your batch",
    description:
      "Upload a product photo, set your GHS price, minimum quantity, and order deadline in under a minute.",
  },
  {
    number: "2",
    title: "Share one WhatsApp link",
    description:
      "Post the link in your WhatsApp groups. Buyers enter their name and phone, pick a quantity, and pay deposits via Mobile Money—no accounts needed.",
  },
  {
    number: "3",
    title: "Update status, auto-SMS buyers",
    description:
      "Mark the batch Ordered, Shipped, Arrived, or Ready for pickup. Every paid buyer gets a friendly SMS automatically.",
  },
];

export default async function HomePage() {
  const { user, importer } = await getAuthContext();

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white/90">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3.5">
          <BrandLogo />
          {user ? (
            <Link
              href={importer ? "/dashboard" : "/onboarding"}
              className="rounded-lg bg-[#0f6b47] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0a5236]"
            >
              {importer ? "Dashboard" : "Finish setup"}
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        {/* Hero */}
        <section className="space-y-4">
          <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
            Built for China-to-Ghana importers
          </span>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-stone-900">
            Collect Mobile Money pre-orders with one WhatsApp link
          </h1>
          <p className="text-base leading-relaxed text-stone-600">
            Stop chasing screenshots and manual spreadsheets. Track deposits in
            GHS, hit your minimum order quantity, and keep every buyer updated
            by SMS.
          </p>

          <div className="flex flex-col gap-2.5 pt-2 sm:flex-row">
            {user ? (
              <Link
                href={importer ? "/dashboard" : "/onboarding"}
                className="w-full rounded-xl bg-[#0f6b47] px-5 py-3.5 text-center text-base font-semibold text-white transition hover:bg-[#0a5236]"
              >
                {importer ? "Go to your dashboard" : "Complete business setup"}
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="w-full rounded-xl bg-[#0f6b47] px-5 py-3.5 text-center text-base font-semibold text-white transition hover:bg-[#0a5236]"
                >
                  Start free as an importer
                </Link>
                <Link
                  href="/login"
                  className="w-full rounded-xl border border-stone-300 bg-white px-5 py-3.5 text-center text-base font-semibold text-stone-800 transition hover:bg-stone-50"
                >
                  Importer sign in
                </Link>
              </>
            )}
          </div>
        </section>

        {/* 3 Steps */}
        <section className="mt-10 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">
            How it works in 3 steps
          </h2>

          <ol className="space-y-3">
            {STEPS.map((step) => (
              <li
                key={step.number}
                className="flex gap-3.5 rounded-xl border border-stone-200 bg-white p-4 shadow-2xs"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-extrabold text-[#0f6b47]">
                  {step.number}
                </span>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Footer note */}
        <footer className="mt-10 border-t border-stone-200 pt-5 text-center text-xs text-stone-500">
          Fast on mobile data · GHS Mobile Money via Paystack · Ghana SMS via
          Arkesel
        </footer>
      </main>
    </div>
  );
}
