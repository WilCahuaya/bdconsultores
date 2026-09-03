import Link from "next/link";
import { HeroBanner } from "@/components/public/HeroBanner";
import { INICIO } from "@/lib/content/public";

export default function InicioPage() {
  return (
    <div className="space-y-12">
      <HeroBanner />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">{INICIO.heading}</h2>
        {INICIO.intro.map((paragraph) => (
          <p key={paragraph.slice(0, 40)} className="max-w-3xl text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground">Nuestros principales servicios</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INICIO.serviciosPrincipales.map((servicio) => (
            <li
              key={servicio}
              className="rounded-lg border bg-card px-4 py-3 text-sm text-foreground"
            >
              {servicio}
            </li>
          ))}
        </ul>
        <Link
          href="/servicios"
          className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
        >
          Conozca todos nuestros servicios →
        </Link>
      </section>
    </div>
  );
}
