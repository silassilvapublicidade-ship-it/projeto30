import Image from "next/image";
import Link from "next/link";

type TipCardProps = {
  altText: string | null;
  category: string | null;
  excerpt: string | null;
  href?: string;
  imageUrl: string | null;
  priority?: boolean;
  title: string;
};

/**
 * Shared between the member gallery (/app/dicas) and the admin preview
 * (/admin/dicas/[id]/preview) so "preview fiel ao que o usuário verá" is
 * structural, not just visually similar. Uses object-contain (never cover)
 * because these are finished art pieces that often bake their own text into
 * the image - cropping would cut that text off.
 */
export function TipCard({
  altText,
  category,
  excerpt,
  href,
  imageUrl,
  priority = false,
  title,
}: TipCardProps) {
  const content = (
    <>
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-black">
        {imageUrl ? (
          <Image
            alt={altText || title}
            className="object-contain"
            fill
            priority={priority}
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            src={imageUrl}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-2">
            Sem imagem
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {category ? (
          <span className="w-fit rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-2">
            {category}
          </span>
        ) : null}
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {excerpt ? <p className="line-clamp-2 text-sm leading-6 text-muted">{excerpt}</p> : null}
      </div>
    </>
  );

  const className =
    "flex flex-col overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] shadow-[var(--shadow-soft)] transition-[border-color,transform] duration-[var(--motion-base)] hover:-translate-y-0.5 hover:border-white/16";

  if (href) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
