import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";

import { FeedbackForm } from "@/components/member/feedback-form";
import { Card } from "@/components/ui/card";
import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Feedback · Projeto 30",
};

type FeedbackPageProps = {
  searchParams: Promise<{ tipo?: string; diagnostico?: string; rota?: string }>;
};

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("record_analytics_event", { p_event_name: "feedback_form_opened", p_source: "server" });

  return (
    <MemberEmptyPage
      description="Relate um problema, envie uma sugestão ou avalie sua experiência. Seu feedback fica privado - só você e a equipe do Projeto 30 têm acesso."
      icon={MessageCircle}
      title="Feedback"
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <Link className="text-sm font-semibold text-action-soft hover:underline" href="/app/feedback/meus">
            Ver meus feedbacks →
          </Link>
        </div>
        <Card className="p-5 sm:p-6">
          <FeedbackForm
            defaultDiagnosticCode={params.diagnostico}
            defaultRoute={params.rota}
            defaultType={params.tipo}
          />
        </Card>
      </div>
    </MemberEmptyPage>
  );
}
