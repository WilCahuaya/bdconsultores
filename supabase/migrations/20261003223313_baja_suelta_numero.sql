-- Al cesar, la ficha suelta el número. Solo quien está activo lo conserva.
-- El número vuelve a ser único entre quienes lo tienen.

UPDATE planillas.relaciones_laborales
SET numero = NULL
WHERE estado = 'CESADA'
  AND numero IS NOT NULL;

DROP INDEX IF EXISTS planillas.relaciones_numero_activo_por_entidad;

CREATE UNIQUE INDEX IF NOT EXISTS relaciones_numero_por_entidad_unique
  ON planillas.relaciones_laborales (entidad_id, numero)
  WHERE numero IS NOT NULL;

COMMENT ON COLUMN planillas.relaciones_laborales.numero IS
  'Número de archivo dentro de la empresa (01, 02). Único entre quienes lo tienen. Al cesar queda vacío y el número se puede volver a usar.';
