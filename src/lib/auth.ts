import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ImporterRow = Database["public"]["Tables"]["importers"]["Row"];
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AuthContext =
  | {
      supabase: null;
      user: null;
      importer: null;
    }
  | {
      supabase: ServerSupabaseClient;
      user: User | null;
      importer: ImporterRow | null;
    };

export async function getAuthContext(): Promise<AuthContext> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { supabase: null, user: null, importer: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, importer: null };
  }

  const { data: importer } = await supabase
    .from("importers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return { supabase, user, importer };
}
