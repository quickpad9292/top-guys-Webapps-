import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app/app-shell";

export default async function NotesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/notes");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,email")
    .eq("id", data.user.id)
    .maybeSingle();

  const user = {
    id: data.user.id,
    email: data.user.email ?? profile?.email ?? "",
    name: profile?.display_name ?? data.user.email?.split("@")[0] ?? "You",
  };

  return <AppShell user={user}>{children}</AppShell>;
}
