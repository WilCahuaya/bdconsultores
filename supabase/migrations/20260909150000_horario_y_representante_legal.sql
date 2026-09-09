-- Horario laboral del trabajador y representante legal según SUNAT (no el administrador).

ALTER TABLE public.entidades
  ADD COLUMN IF NOT EXISTS representante_legal_nombre TEXT,
  ADD COLUMN IF NOT EXISTS representante_legal_dni TEXT,
  ADD COLUMN IF NOT EXISTS representante_legal_cargo TEXT;

ALTER TABLE planillas.relaciones_laborales
  ADD COLUMN IF NOT EXISTS horario TEXT;
