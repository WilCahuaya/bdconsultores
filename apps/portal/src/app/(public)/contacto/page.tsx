import { ContactActions } from "@/components/public/ContactActions";
import { CONTACTO } from "@/lib/content/public";

export default function ContactoPage() {
  return (
    <section className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Contacto</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        {CONTACTO.heading}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">{CONTACTO.intro}</p>

      <p className="mt-8 font-mono text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
        {CONTACTO.telefono}
      </p>
      <ContactActions className="mt-6" />

      <dl className="mt-12 grid gap-6 border-t pt-8 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-medium text-foreground">Correo</dt>
          <dd className="mt-1">
            <a href={`mailto:${CONTACTO.email}`} className="text-muted-foreground hover:text-primary">
              {CONTACTO.email}
            </a>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Dónde estamos</dt>
          <dd className="mt-1 text-muted-foreground">{CONTACTO.direccion}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">{CONTACTO.empresa}</dt>
          <dd className="mt-1 text-muted-foreground">RUC 20614326418</dd>
        </div>
      </dl>
    </section>
  );
}
