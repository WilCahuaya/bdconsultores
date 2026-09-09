-- Completa el alta del administrador si faltó la relación (CTE concurrentes).
-- Idempotente.

INSERT INTO planillas.relaciones_laborales (
  persona_id, entidad_id, cargo, estado, fecha_ingreso
)
SELECT p.id, e.id, 'Administrador', 'ACTIVA', CURRENT_DATE
FROM public.entidades e
JOIN planillas.personas p
  ON p.dni = regexp_replace(COALESCE(e.admin_dni, ''), '\D', '', 'g')
WHERE COALESCE(e.usa_planillas, TRUE)
  AND length(regexp_replace(COALESCE(e.admin_dni, ''), '\D', '', 'g')) >= 8
  AND NOT EXISTS (
    SELECT 1
    FROM planillas.relaciones_laborales r
    WHERE r.persona_id = p.id
      AND r.entidad_id = e.id
      AND r.fecha_cese IS NULL
  );

INSERT INTO planillas.documentos (relacion_id, tipo, estado)
SELECT r.id, t.tipo, 'PENDIENTE'
FROM planillas.relaciones_laborales r
CROSS JOIN (
  VALUES
    ('CONTRATO_FIRMADO'::planillas.tipo_documento),
    ('DNI'::planillas.tipo_documento),
    ('FICHA_DATOS'::planillas.tipo_documento),
    ('PENSIONES_FIRMADO'::planillas.tipo_documento),
    ('TR_ALTA'::planillas.tipo_documento),
    ('ASIGNACION_FAMILIAR'::planillas.tipo_documento),
    ('VIDA_LEY'::planillas.tipo_documento)
) AS t(tipo)
WHERE NOT EXISTS (
  SELECT 1 FROM planillas.documentos d
  WHERE d.relacion_id = r.id AND d.tipo = t.tipo
);
