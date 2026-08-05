"use server";

import { revalidatePath } from "next/cache";

import { requireAuthUser } from "@/server/services/auth-session.service";
import { upsertLibraryProgress } from "@/server/services/library.service";

export async function updateLibraryProgressAction(formData: FormData) {
  await requireAuthUser("/app/biblioteca");

  const contentId = String(formData.get("contentId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const status = String(formData.get("status") ?? "");
  const progressPercent = status === "completed" ? 100 : status === "reading" ? 50 : 0;

  if (contentId && (status === "reading" || status === "completed")) {
    await upsertLibraryProgress({ contentId, status, progressPercent });
  }

  revalidatePath(`/app/biblioteca/${slug}`);
  revalidatePath("/app/biblioteca");
}
