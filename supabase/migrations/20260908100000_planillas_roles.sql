-- Planillas Fase 1a — roles nuevos (enum). Hay que commitear antes de usarlos en CHECKs.
ALTER TYPE public.rol_usuario ADD VALUE IF NOT EXISTS 'ASISTENTE';
ALTER TYPE public.rol_usuario ADD VALUE IF NOT EXISTS 'TESORERO_ENTIDAD';
ALTER TYPE public.rol_usuario ADD VALUE IF NOT EXISTS 'SECRETARIO_ENTIDAD';
