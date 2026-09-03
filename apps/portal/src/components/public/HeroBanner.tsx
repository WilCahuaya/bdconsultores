import Link from "next/link";
import { APP_CLIENT } from "@inventario/types";
import { HERO } from "@/lib/content/public";

export function HeroBanner() {
  return (
    <section className="rounded-xl border bg-gradient-to-br from-primary/15 via-card to-card p-8 dark:from-primary/25 dark:via-card dark:to-background md:p-12">
      <p className="text-sm font-medium text-primary">{APP_CLIENT}</p>
      <blockquote className="mt-4 text-2xl font-bold leading-tight text-foreground md:text-3xl">
        &ldquo;{HERO.quote}&rdquo;
      </blockquote>
      <p className="mt-4 max-w-3xl text-lg text-muted-foreground">{HERO.subtitle}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/contacto"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Solicitar cotización
        </Link>
        <Link
          href="/servicios"
          className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium hover:bg-accent"
        >
          Ver servicios
        </Link>
      </div>
    </section>
  );
}
