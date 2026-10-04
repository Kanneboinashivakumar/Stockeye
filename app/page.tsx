import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/supabase/server";
import { AuthScreen } from "@/components/AuthScreen";
import { OnboardingForm } from "@/components/OnboardingForm";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";

export default async function HomePage() {
  const user = await getAuthenticatedUser();

  // 1. If not authenticated, render the AuthScreen as the first application experience
  if (!user) {
    return (
      <main className="min-h-dvh bg-paper px-6 py-16 md:px-12 md:py-24">
        <div className="mx-auto flex max-w-5xl items-start md:ml-[10%]">
          <AuthScreen />
        </div>
      </main>
    );
  }

  // 2. If authenticated, check if user already owns an existing store
  const store = await getStoreByOwnerId(user.id);
  if (store) {
    // Route returning store owners directly to their store scanner
    redirect(`/scan/${store.id}`);
  }

  // 3. Authenticated user without a store -> show Store Setup
  return (
    <main className="min-h-dvh bg-paper px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto flex max-w-5xl items-start md:ml-[10%]">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center justify-between">
            <Logo size="md" />
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-ink-muted truncate max-w-[130px]">
                {user.email}
              </span>
              <LogoutButton />
            </div>
          </div>
          <h1 className="font-heading text-[40px] text-ink">
            Let&apos;s set up your store
          </h1>
          <p className="mt-4 max-w-[40ch] text-[16px] text-ink-muted">
            A few details, then you can point the camera at a shelf and talk.
          </p>
          <div className="mt-10">
            <OnboardingForm />
          </div>
        </div>
      </div>
    </main>
  );
}
