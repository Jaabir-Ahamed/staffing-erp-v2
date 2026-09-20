"use client";

import { useRouter } from "next/navigation";
import { SignOutRegular } from "@fluentui/react-icons";
import { Button } from "@/src/components/ui/button";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" className="-ml-2" onClick={signOut} aria-label="Sign out">
      <SignOutRegular className="size-4" aria-hidden />
      Sign out
    </Button>
  );
}
