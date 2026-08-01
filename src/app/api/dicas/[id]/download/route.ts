import { NextResponse } from "next/server";

import { tipIdSchema } from "@/features/admin/admin-tips.schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordAnalyticsEvent } from "@/server/services/analytics.service";
import { getDownloadableTip } from "@/server/services/tips.service";

export const runtime = "nodejs";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function sanitizeSlugForFilename(slug: string): string {
  const cleaned = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return cleaned || "dica";
}

/**
 * The only client input here is `id`, validated as a UUID before ever
 * touching the database - there is no client-supplied storage path, so path
 * traversal into the bucket isn't reachable. getDownloadableTip re-applies
 * the same published/status/display-window rules as the public detail page,
 * so a draft, archived or out-of-window card can't be downloaded by id even
 * by a signed-in member who has (or guesses) it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const parsedId = tipIdSchema.safeParse(rawId);

  if (!parsedId.success) {
    return NextResponse.json({ error: "Identificador de dica inválido." }, { status: 400 });
  }

  const tip = await getDownloadableTip(parsedId.data);

  if (!tip || !tip.image_storage_path) {
    return NextResponse.json({ error: "Dica não encontrada." }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: blob, error } = await supabase.storage
    .from("tip-cards")
    .download(tip.image_storage_path);

  if (error || !blob) {
    return NextResponse.json({ error: "Não foi possível baixar a imagem." }, { status: 404 });
  }

  const extension = tip.image_storage_path.split(".").pop()?.toLowerCase() ?? "webp";
  const contentType = CONTENT_TYPE_BY_EXTENSION[extension] ?? (blob.type || "application/octet-stream");
  const filename = `dica-${sanitizeSlugForFilename(tip.slug)}.${extension}`;
  const bytes = new Uint8Array(await blob.arrayBuffer());

  await recordAnalyticsEvent({ contentItemId: tip.id, eventName: "tip_card_downloaded" });

  return new NextResponse(bytes, {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(bytes.byteLength),
      "content-type": contentType,
    },
  });
}
