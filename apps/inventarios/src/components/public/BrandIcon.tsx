import {
  BRAND_LOGO_PATH,
  BRAND_LOGO_TRANSFORM,
  BRAND_LOGO_VIEWBOX,
} from "@/components/public/brand-logo-path";

interface BrandIconProps {
  className?: string;
}

/** Logo vectorial oficial B&D — rombo con barras y flecha. */
export function BrandIcon({ className = "h-12 w-12" }: BrandIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={BRAND_LOGO_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      className={`block shrink-0 ${className}`}
      aria-hidden
    >
      <g transform={BRAND_LOGO_TRANSFORM} className="fill-brand" stroke="none">
        <path d={BRAND_LOGO_PATH} />
      </g>
    </svg>
  );
}
