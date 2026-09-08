"use client";

import type { ReactNode } from "react";

export interface EntityPortalMenuItem {
  id: string;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  highlight?: boolean;
}

export interface EntityPortalMenuProps {
  /** Etiqueta opcional sobre el título (p. ej. «Entidad»). Omitir en portal contador. */
  sectionLabel?: string;
  entidadNombre: string;
  entidadRuc?: string | null;
  entidadDireccion?: string | null;
  /** Líneas adicionales bajo el título (sustituyen RUC/dirección si se usan). */
  subtitleLines?: string[];
  /** `entity`: razón social en mayúsculas; `person`: nombre de persona en formato natural. */
  titleVariant?: "entity" | "person";
  items: EntityPortalMenuItem[];
  extraActions?: ReactNode;
}

export function EntityPortalMenu({
  sectionLabel,
  entidadNombre,
  entidadRuc,
  entidadDireccion,
  subtitleLines,
  titleVariant = "entity",
  items,
  extraActions,
}: EntityPortalMenuProps) {
  const showRucDireccion = !subtitleLines?.length;
  const titleClassName =
    titleVariant === "person"
      ? "bd-portal-person-title text-2xl font-semibold leading-snug sm:text-[1.65rem]"
      : "bd-portal-entity-title text-2xl font-semibold uppercase leading-tight tracking-[0.06em] sm:text-[1.65rem]";

  return (
    <div className="bd-portal-card space-y-5 sm:space-y-6">
      <div className="bd-portal-inner-divider space-y-2.5">
        {sectionLabel ? <p className="bd-portal-section-label">{sectionLabel}</p> : null}
        <h2 className={titleClassName}>{entidadNombre}</h2>
        {showRucDireccion && entidadRuc && (
          <p className="bd-portal-meta-line font-mono text-sm">RUC {entidadRuc}</p>
        )}
        {showRucDireccion && entidadDireccion && (
          <p className="bd-portal-meta-line bd-portal-meta-line--muted">{entidadDireccion}</p>
        )}
        {subtitleLines?.map((line) => (
          <p key={line} className="bd-portal-meta-line bd-portal-meta-line--muted text-sm">
            {line}
          </p>
        ))}
      </div>

      <div>
        <p className="bd-portal-menu-heading">Aplicaciones</p>
        <div className="space-y-2.5">
          {items.map((item) => {
            const className = item.disabled
              ? "bd-portal-menu-item bd-portal-menu-item--disabled"
              : item.highlight
                ? "bd-portal-menu-item bd-portal-menu-item--highlight"
                : "bd-portal-menu-item";

            const content = (
              <>
                {item.label}
                {item.disabled ? (
                  <span className="bd-portal-menu-item-badge">Próximamente</span>
                ) : null}
              </>
            );

            if (item.href && !item.disabled) {
              return (
                <a key={item.id} href={item.href} className={className}>
                  {content}
                </a>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={item.onClick}
                className={className}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>

      {extraActions ? <div className="pt-1">{extraActions}</div> : null}
    </div>
  );
}
