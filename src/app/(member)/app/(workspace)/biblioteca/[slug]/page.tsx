import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { LibraryContentView } from "@/components/library/library-content-view";
import { getLibraryContentBySlug } from "@/server/services/library.service";

type BibliotecaDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BibliotecaDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = await getLibraryContentBySlug(slug);
  return { title: content ? `${content.title} · Biblioteca · Projeto 30` : "Biblioteca · Projeto 30" };
}

export default async function BibliotecaDetailPage({ params }: BibliotecaDetailPageProps) {
  const { slug } = await params;
  const content = await getLibraryContentBySlug(slug);

  if (!content) {
    notFound();
  }

  return <LibraryContentView backHref="/app/biblioteca" content={content} mode="member" />;
}
