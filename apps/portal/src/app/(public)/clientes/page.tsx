import { PublicPageHeader } from "@/components/public/PublicPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@inventario/ui";
import { CLIENTES } from "@/lib/content/public";

export default function ClientesPage() {
  const { sectores } = CLIENTES;

  return (
    <section className="space-y-8">
      <PublicPageHeader title="Clientes" description={CLIENTES.heading} />
      <p className="max-w-2xl text-muted-foreground">{CLIENTES.intro}</p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-primary">{sectores.publico.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {sectores.publico.items.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-primary">{sectores.privado.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {sectores.privado.items.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
