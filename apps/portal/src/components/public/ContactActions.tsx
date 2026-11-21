import { CONTACTO } from "@/lib/content/public";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.39-1.4a10 10 0 0 0 4.65 1.18h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2Zm5.76 13.95c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.42-.14-.95-.31-1.64-.6-2.88-1.24-4.76-4.14-4.9-4.33-.14-.2-1.16-1.54-1.16-2.94 0-1.4.73-2.09 1-2.37.24-.28.64-.41 1.02-.41.12 0 .23 0 .33.01.3.01.44-.1.69.53.24.68.84 2.36.91 2.53.08.17.12.37.02.58-.1.22-.14.35-.28.54-.14.18-.3.41-.42.55-.14.16-.29.33-.12.63.16.3.73 1.2 1.57 1.94 1.08.96 1.98 1.26 2.28 1.4.3.14.47.12.64-.07.18-.2.74-.86.94-1.16.2-.3.4-.24.67-.14.28.1 1.75.82 2.05.97.3.15.5.22.57.34.08.12.08.7-.16 1.38Z" />
    </svg>
  );
}

interface ContactActionsProps {
  className?: string;
  /** Sobre la foto de la oficina, el botón de llamada va en blanco. */
  onPhoto?: boolean;
}

export function ContactActions({ className = "", onPhoto = false }: ContactActionsProps) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <a
        href={CONTACTO.whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <WhatsAppIcon className="h-4 w-4" />
        WhatsApp
      </a>
      <a
        href={`tel:${CONTACTO.telefonoTel}`}
        className={
          onPhoto
            ? "inline-flex h-11 items-center rounded-full border border-white/80 px-5 text-sm font-semibold text-white hover:bg-white/10"
            : "inline-flex h-11 items-center rounded-full border border-primary/40 px-5 text-sm font-semibold text-primary hover:bg-primary/10"
        }
      >
        Llamar al {CONTACTO.telefono}
      </a>
    </div>
  );
}
