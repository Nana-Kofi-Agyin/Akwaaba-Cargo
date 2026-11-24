import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const { user, importer } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  if (importer) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <BrandLogo />
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-stone-900">
          Set up your business profile
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Tell us your business name and Ghanaian phone number before creating
          your first pre-order batch.
        </p>
      </div>

      <OnboardingForm userId={user.id} />
    </main>
  );
}
