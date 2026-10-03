-- El número de archivo es único solo entre fichas activas.
-- Una ficha cesada puede repetir el número del trabajador actual.

DROP INDEX IF EXISTS planillas.relaciones_numero_por_entidad_unique;

CREATE UNIQUE INDEX IF NOT EXISTS relaciones_numero_activo_por_entidad
  ON planillas.relaciones_laborales (entidad_id, numero)
  WHERE numero IS NOT NULL AND estado = 'ACTIVA';

COMMENT ON COLUMN planillas.relaciones_laborales.numero IS
  'Número de archivo dentro de la empresa (01, 02). Único entre fichas activas. Una ficha cesada puede repetir el número del activo actual.';
