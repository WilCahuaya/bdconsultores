-- Nuevo valor del enum. No se usa en este archivo: Postgres solo permite
-- referenciarlo después de confirmar la transacción.
ALTER TYPE public.categoria_bien ADD VALUE IF NOT EXISTS 'MENAJE';
