import { PublicPageHeader } from "@/components/public/PublicPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@inventario/ui";
import { NOSOTROS } from "@/lib/content/public";

export default function NosotrosPage() {
  return (
    <section className="space-y-10">
      <PublicPageHeader title="Nosotros" description={NOSOTROS.heading} />

      <div className="space-y-4">
        {NOSOTROS.intro.map((paragraph) => (
          <p key={paragraph.slice(0, 40)} className="max-w-3xl text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-primary">Nuestra misión</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{NOSOTROS.mision}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-primary">Nuestra visión</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{NOSOTROS.vision}</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
