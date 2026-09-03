import Link from "next/link";
import { BrandIcon } from "@/components/public/BrandIcon";

interface BrandLogoProps {
  linked?: boolean;
  /** default: navbar. large: login u otros encabezados. */
  size?: "default" | "large";
}

export function BrandLogo({ linked = true, size = "default" }: BrandLogoProps) {
  const isLarge = size === "large";

  const content = (
    <span
      className={`inline-flex items-center ${isLarge ? "flex-col gap-2.5" : "gap-2.5"}`}
    >
      <BrandIcon className={isLarge ? "h-14 w-14" : "h-10 w-10"} />
      <span
        className={`font-bold leading-none tracking-tight text-brand ${
          isLarge ? "text-3xl" : "text-xl md:text-2xl"
        }`}
      >
        B&amp;D
      </span>
    </span>
  );

  if (!linked) {
    return content;
  }

  return (
    <Link
      href="/"
      className="inline-flex shrink-0 hover:opacity-90"
      aria-label="B&D Consultores Global EIRL — Inicio"
    >
      {content}
    </Link>
  );
}
