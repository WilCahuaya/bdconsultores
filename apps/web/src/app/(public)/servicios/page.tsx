import { ContactActions } from "@/components/public/ContactActions";
import { PublicPageHeader } from "@/components/public/PublicPageHeader";
import { ServiceCard } from "@/components/public/ServiceCard";
import { SERVICIOS } from "@/lib/content/public";

export default function ServiciosPage() {
  return (
    <section>
      <PublicPageHeader
        title="Servicios"
        description="Contabilidad, tributos y el control de tus bienes. Si no ves lo que buscas, escríbenos."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICIOS.map((servicio) => (
          <ServiceCard key={servicio.title} title={servicio.title} description={servicio.description} />
        ))}
      </div>
      <ContactActions className="mt-10" />
    </section>
  );
}
