"use client";

import type { ReactNode } from "react";
import {
  BD_PORTAL_CONTACTO,
  BD_PORTAL_ESTUDIO,
  BD_PORTAL_FOOTER_INSTITUCIONAL,
  BD_PORTAL_HERO_DARK,
  BD_PORTAL_HERO_LIGHT,
  BD_PORTAL_INTRO,
  BD_PORTAL_RAZON_SOCIAL,
} from "@inventario/types";
import { BdPortalBrandIcon } from "./bd-portal-brand-icon";
import { BdPortalThemeToggle } from "./bd-portal-theme-toggle";

export interface BdPortalShellProps {
  children: ReactNode;
  onExit?: () => void;
  exitLabel?: string;
  showBranding?: boolean;
  footerNote?: string;
  /** Rutas del hero (p. ej. `./images/...` en Electron). */
  heroLightSrc?: string;
  heroDarkSrc?: string;
  /** `lg` deja el panel a ancho completo hasta 1024 px. */
  splitAt?: "md" | "lg";
}

function LogoutIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

export function BdPortalShell({
  children,
  onExit,
  exitLabel = "SALIR",
  showBranding = true,
  footerNote = BD_PORTAL_FOOTER_INSTITUCIONAL,
  heroLightSrc = BD_PORTAL_HERO_LIGHT,
  heroDarkSrc = BD_PORTAL_HERO_DARK,
  splitAt = "md",
}: BdPortalShellProps) {
  const wide = splitAt === "lg";
  return (
    <div className={wide ? "bd-portal-shell bd-portal-shell--lg" : "bd-portal-shell"}>
      <section className="bd-portal-panel">
        <div className="bd-portal-panel-glow" aria-hidden />

        <div className="bd-portal-panel-top flex items-center justify-between gap-3">
          <div className="bd-portal-panel-accent-line" aria-hidden />
          <BdPortalThemeToggle />
        </div>

        <div className="bd-portal-panel-main space-y-6 sm:space-y-7">
          {showBranding && (
            <header className="space-y-6">
              <div className="flex items-start gap-4">
                <BdPortalBrandIcon className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
                <div className="bd-portal-brand-copy min-w-0 space-y-1.5 pl-4">
                  <p className="bd-portal-estudio-label text-[0.7rem] font-medium uppercase tracking-[0.22em] sm:text-xs">
                    {BD_PORTAL_ESTUDIO}
                  </p>
                  <h1 className="bd-portal-brand-title">
                    {BD_PORTAL_RAZON_SOCIAL}
                  </h1>
                </div>
              </div>
              <p className="bd-portal-brand-intro">
                {BD_PORTAL_INTRO}
              </p>
            </header>
          )}

          <div className="relative">{children}</div>
        </div>

        {footerNote ? (
          <div className="bd-portal-panel-footer">
            <p className="bd-portal-footer-note">{footerNote}</p>
          </div>
        ) : (
          <span />
        )}
      </section>

      <section className={wide ? "bd-portal-hero hidden lg:block" : "bd-portal-hero hidden md:block"} aria-hidden={false}>
        {/* Tema claro: oficina diurna */}
        <img
          src={heroLightSrc}
          alt=""
          aria-hidden
          decoding="async"
          fetchPriority="high"
          className="bd-portal-hero-image bd-portal-hero-image-light opacity-100 dark:opacity-0"
        />
        <div className="bd-portal-hero-edge dark:hidden" aria-hidden />

        {/* Tema oscuro: oficina nocturna */}
        <img
          src={heroDarkSrc}
          alt=""
          aria-hidden
          decoding="async"
          fetchPriority="high"
          className="bd-portal-hero-image bd-portal-hero-image-dark opacity-0 dark:opacity-100"
        />
        <div className="bd-portal-hero-edge hidden dark:block" aria-hidden />

        {onExit && (
          <button type="button" onClick={onExit} className="bd-portal-exit-btn">
            {exitLabel}
            <LogoutIcon />
          </button>
        )}

        <footer className="bd-portal-hero-footer">
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/95">
            Contactos
          </p>
          <p>{BD_PORTAL_CONTACTO.direccion}</p>
          <p>{BD_PORTAL_CONTACTO.telefono}</p>
          <p>{BD_PORTAL_CONTACTO.email}</p>
        </footer>
      </section>

      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className={wide ? "bd-portal-exit-btn-mobile lg:hidden" : "bd-portal-exit-btn-mobile md:hidden"}
        >
          {exitLabel}
          <LogoutIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
