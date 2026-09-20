import { AppNav } from "@/src/components/presentational/app-nav";
import { SignOutButton } from "@/src/features/auth/ui/sign-out-button";
import type { AppUser } from "@/src/lib/auth";
import { isAdminRole } from "@/src/lib/auth";

export function AppShell({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  const admin = isAdminRole(user.role);
  return (
    <div className="flex min-h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4">
        <div className="px-2 pb-4">
          <p className="type-section">StaffHub</p>
          <p className="type-meta">Technical Trading Agency</p>
        </div>
        <div className="mb-4 space-y-1 border-b border-sidebar-border px-2 pb-4">
          <p className="type-body font-medium">{user.full_name}</p>
          <p className="type-meta capitalize">{user.role}</p>
          <SignOutButton />
        </div>
        <AppNav admin={admin} />
      </aside>
      <div className="min-w-0 flex-1 overflow-auto">
        <main className="mx-auto w-full max-w-7xl px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
