import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/member/onboarding-flow";
import { getMemberContext } from "@/server/services/member-area.service";

export default async function OnboardingPage() {
  const context = await getMemberContext();

  if (context.profile.onboarding_completed) {
    redirect("/app/hoje");
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10 lg:px-8">
      <OnboardingFlow
        initialData={{
          avatarUrl: context.profile.avatar_url ?? "",
          displayName: context.profile.display_name ?? "",
          name: context.profile.name ?? "",
          timezone: context.profile.timezone,
        }}
      />
    </main>
  );
}
