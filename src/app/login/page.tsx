import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getAuthContext } from "@/lib/auth";

export default async function LoginPage() {
  const { user, importer } = await getAuthContext();

  if (user) {
    redirect(importer ? "/dashboard" : "/onboarding");
  }

  return <AuthForm mode="login" />;
}
