import { PublicPageHeader } from "@/components/public/PublicPageHeader";
import { ServiceCard } from "@/components/public/ServiceCard";
import { SERVICIOS } from "@/lib/content/public";

export default function ServiciosPage() {
  return (
    <section>
      <PublicPageHeader
        title="Servicios"
        description="Asesoría contable, tributaria y servicios especializados de control patrimonial."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICIOS.map((servicio) => (
          <ServiceCard key={servicio.title} title={servicio.title} description={servicio.description} />
        ))}
      </div>
    </section>
  );
}
