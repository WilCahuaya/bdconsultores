-- Cada versión de contrato guarda su propio PDF firmado.

ALTER TABLE planillas.contratos
  ADD COLUMN IF NOT EXISTS documento_id UUID REFERENCES planillas.documentos(id) ON DELETE SET NULL;

WITH candidatos AS (
  SELECT
    c.id AS contrato_id,
    d.id AS documento_id,
    ROW_NUMBER() OVER (
      PARTITION BY c.relacion_id
      ORDER BY c.version DESC, c.created_at DESC
    ) AS rn
  FROM planillas.contratos c
  INNER JOIN planillas.documentos d
    ON d.relacion_id = c.relacion_id
    AND d.tipo = 'CONTRATO_FIRMADO'
  WHERE c.documento_id IS NULL
    AND c.estado <> 'BAJA'
    AND NOT EXISTS (
      SELECT 1
      FROM planillas.contratos otros
      WHERE otros.documento_id = d.id
    )
)
UPDATE planillas.contratos c
SET documento_id = candidatos.documento_id
FROM candidatos
WHERE candidatos.rn = 1
  AND candidatos.contrato_id = c.id;

CREATE UNIQUE INDEX IF NOT EXISTS contratos_documento_unique
  ON planillas.contratos (documento_id)
  WHERE documento_id IS NOT NULL;
