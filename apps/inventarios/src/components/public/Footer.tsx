import Link from "next/link";
import { APP_CLIENT } from "@inventario/types";
import { CONTACTO } from "@/lib/content/public";
import { PUBLIC_NAV } from "@/lib/routes";

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-medium text-foreground">{APP_CLIENT}</p>
          <p className="mt-1 text-sm text-muted-foreground">RUC 20614326418</p>
          <p className="mt-3 text-sm text-muted-foreground">{CONTACTO.direccion}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">Enlaces</p>
          <nav className="mt-3 flex flex-col gap-1">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">Contacto</p>
          <p className="mt-3 text-sm text-muted-foreground">{CONTACTO.telefono}</p>
          <a
            href={`mailto:${CONTACTO.email}`}
            className="mt-1 block text-sm text-muted-foreground hover:text-primary"
          >
            {CONTACTO.email}
          </a>
        </div>
      </div>

      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {APP_CLIENT} — Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
