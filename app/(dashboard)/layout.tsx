import { AppShell } from "@/src/components/presentational/app-shell";
import { requireAppUser } from "@/src/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAppUser();
  return <AppShell user={user}>{children}</AppShell>;
}
