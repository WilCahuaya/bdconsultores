import { PublicPageHeader } from "@/components/public/PublicPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@inventario/ui";
import { CONTACTO } from "@/lib/content/public";

export default function ContactoPage() {
  return (
    <section className="space-y-10">
      <PublicPageHeader title="Contacto" description={CONTACTO.heading} />
      <p className="max-w-2xl text-muted-foreground">{CONTACTO.intro}</p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{CONTACTO.empresa}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Ubicación:</span> {CONTACTO.direccion}
            </p>
            <p>
              <span className="font-medium text-foreground">Teléfono:</span> {CONTACTO.telefono}
            </p>
            <p>
              <span className="font-medium text-foreground">Correo:</span> {CONTACTO.email}
            </p>
            <p>
              <span className="font-medium text-foreground">RUC:</span> 20614326418
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-primary">{CONTACTO.cotizacion.title}</CardTitle>
            <CardDescription>{CONTACTO.cotizacion.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="rounded-lg border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
              Formulario de contacto y cotización en desarrollo. Próximamente podrá enviarnos su
              consulta desde esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
