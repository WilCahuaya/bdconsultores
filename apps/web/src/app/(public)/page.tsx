import Link from "next/link";
import { ContactActions } from "@/components/public/ContactActions";
import { ProductWindow } from "@/components/public/ProductWindow";
import { CONTACTO } from "@/lib/content/public";

const RAZONES = [
  {
    titulo: "Contabilidad al día",
    texto: "Libros, estados financieros y la revisión de cómo estás trabajando.",
  },
  {
    titulo: "Cada bien identificado",
    texto: "Código, foto y ubicación. Lo físico y lo contable quedan en el mismo registro.",
  },
  {
    titulo: "Un solo número",
    texto: "Escribes o llamas al mismo teléfono. Respondemos desde Huancayo.",
  },
] as const;

const TARJETAS = [
  {
    titulo: "Contabilidad",
    texto: "Registro, análisis y estados financieros para decidir con números claros.",
    imagen: "/images/contabilidad.jpg",
    alt: "Laptop con gráficos de estados financieros",
  },
  {
    titulo: "Tributos",
    texto: "Declaraciones en fecha y acompañamiento cuando llega un requerimiento.",
    imagen: "/images/tributos.jpg",
    alt: "Persona firmando una declaración",
  },
  {
    titulo: "Control de activos",
    texto: "Inventario en campo, etiqueta en el bien y conciliación con la contabilidad.",
    imagen: "/images/activos.jpg",
    alt: "Oficina con muebles y equipos que forman parte del patrimonio",
  },
] as const;

export default function InicioPage() {
  return (
    <div className="space-y-20 pb-6 sm:space-y-24">
      <section className="relative left-1/2 h-[72vh] min-h-[28rem] w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden -mt-8 sm:-mt-9 md:-mt-10">
        <img
          src="/images/login-hero-light.png"
          alt="Oficina de B&D Consultores, con el logo en la pared y la ciudad al fondo"
          className="pointer-events-none absolute inset-0 h-full w-full max-w-none object-cover object-[62%_center] opacity-100 dark:opacity-0"
        />
        <img
          src="/images/login-hero-dark.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full max-w-none object-cover object-[62%_center] opacity-0 dark:opacity-100"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/45 to-transparent"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex h-full w-full max-w-[90rem] items-center px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="max-w-xl text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              Huancayo · entidades públicas y empresas
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              Tu contabilidad y tus bienes, en un solo lugar.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-white/90">
              Entramos a tu organización, ordenamos los libros y dejamos cada activo con código, foto y
              ubicación.
            </p>
            <ContactActions className="mt-8" onPhoto />
          </div>
        </div>
      </section>

      <section>
        <h2 className="max-w-lg text-3xl font-bold tracking-tight text-foreground">
          Por qué te conviene tenerlo junto
        </h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {RAZONES.map((razon) => (
            <li key={razon.titulo} className="rounded-2xl border bg-card px-5 py-6">
              <h3 className="text-lg font-semibold text-foreground">{razon.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{razon.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {TARJETAS.map((tarjeta) => (
          <article key={tarjeta.titulo} className="overflow-hidden rounded-2xl border bg-card">
            <img src={tarjeta.imagen} alt={tarjeta.alt} className="aspect-square w-full object-cover" />
            <div className="px-5 py-6">
              <h2 className="text-xl font-semibold text-foreground">{tarjeta.titulo}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tarjeta.texto}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Así se ve en el sistema</h2>
          <p className="mt-3 text-muted-foreground">
            El inventario, el código y la etiqueta que se pega al bien. Los nombres de esta vista son un
            ejemplo.
          </p>
          <Link href="/servicios" className="mt-6 inline-flex text-sm font-semibold text-primary hover:underline">
            Ver todos los servicios
          </Link>
        </div>
        <ProductWindow />
      </section>

      <section className="flex flex-col gap-6 rounded-3xl bg-primary px-6 py-10 text-primary-foreground sm:px-10 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Cuando nos necesites</h2>
          <p className="mt-2 max-w-md text-primary-foreground/90">{CONTACTO.intro}</p>
          <p className="mt-4 font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
            {CONTACTO.telefono}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={CONTACTO.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center rounded-full bg-primary-foreground px-5 text-sm font-semibold text-primary hover:opacity-90"
          >
            WhatsApp
          </a>
          <a
            href={`tel:${CONTACTO.telefonoTel}`}
            className="inline-flex h-11 items-center rounded-full border border-primary-foreground/50 px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10"
          >
            Llamar
          </a>
        </div>
      </section>
    </div>
  );
}
