import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, importer } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  if (!importer) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div>
            <Link href="/dashboard">
              <BrandLogo />
            </Link>
            <p className="mt-0.5 text-xs text-stone-500">{importer.name}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
