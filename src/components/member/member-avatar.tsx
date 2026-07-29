import Image from "next/image";

import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "P30"
  );
}

const sizeClasses = {
  lg: "size-20 text-lg",
  md: "size-10 text-xs",
  xl: "size-28 text-2xl",
} as const;

export function MemberAvatar({
  avatarUrl,
  className,
  name,
  size = "md",
}: {
  avatarUrl?: string | null;
  className?: string;
  name: string;
  size?: keyof typeof sizeClasses;
}) {
  if (avatarUrl) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-hidden rounded-full bg-white/[0.08] shadow-[var(--shadow-hairline)]",
          sizeClasses[size],
          className,
        )}
      >
        <Image
          alt={`Foto de perfil de ${name}`}
          className="object-cover"
          fill
          sizes="112px"
          src={avatarUrl}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-mono font-semibold text-foreground shadow-[var(--shadow-hairline)]",
        sizeClasses[size],
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
