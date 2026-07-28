import Image from "next/image";

import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/logo-mark-1024.png";

type BrandLogoProps = {
  className?: string;
  decorative?: boolean;
  label?: string;
  preload?: boolean;
  size?: number;
};

export function BrandLogo({
  className,
  decorative = false,
  label = "Projeto 30",
  preload = false,
  size = 40,
}: BrandLogoProps) {
  return (
    <Image
      alt={decorative ? "" : label}
      aria-hidden={decorative || undefined}
      className={cn("shrink-0 select-none", className)}
      height={size}
      preload={preload}
      src={LOGO_SRC}
      width={size}
    />
  );
}
