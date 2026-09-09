-- Administrador de cada entidad con Planillas → primer trabajador (ficha laboral).
-- Cubre empresas creadas antes del alta automático en la app.

WITH src AS (
  SELECT
    e.id AS entidad_id,
    regexp_replace(e.admin_dni, '\D', '', 'g') AS dni,
    nullif(lower(trim(e.admin_email)), '') AS correo,
    nullif(trim(e.admin_telefono), '') AS celular,
    regexp_split_to_array(trim(e.admin_nombre), '\s+') AS words
  FROM public.entidades e
  WHERE COALESCE(e.usa_planillas, TRUE)
    AND e.admin_nombre IS NOT NULL
    AND btrim(e.admin_nombre) <> ''
    AND length(regexp_replace(COALESCE(e.admin_dni, ''), '\D', '', 'g')) >= 8
),
parsed AS (
  SELECT
    entidad_id,
    dni,
    correo,
    celular,
    CASE
      WHEN cardinality(words) <= 1 THEN words[1]
      WHEN cardinality(words) = 2 THEN words[1]
      ELSE array_to_string(words[1:cardinality(words) - 2], ' ')
    END AS nombres,
    CASE
      WHEN cardinality(words) = 2 THEN words[2]
      WHEN cardinality(words) >= 3 THEN words[cardinality(words) - 1]
      ELSE NULL
    END AS apellido_paterno,
    CASE
      WHEN cardinality(words) >= 3 THEN words[cardinality(words)]
      ELSE NULL
    END AS apellido_materno
  FROM src
),
ins_personas AS (
  INSERT INTO planillas.personas (dni, nombres, apellido_paterno, apellido_materno, celular, correo)
  SELECT DISTINCT ON (dni) dni, nombres, apellido_paterno, apellido_materno, celular, correo
  FROM parsed
  ORDER BY dni
  ON CONFLICT (dni) DO NOTHING
  RETURNING id
),
ins_relaciones AS (
  INSERT INTO planillas.relaciones_laborales (
    persona_id, entidad_id, cargo, estado, fecha_ingreso
  )
  SELECT p.id, parsed.entidad_id, 'Administrador', 'ACTIVA', CURRENT_DATE
  FROM parsed
  JOIN planillas.personas p ON p.dni = parsed.dni
  WHERE NOT EXISTS (
    SELECT 1
    FROM planillas.relaciones_laborales r
    WHERE r.persona_id = p.id
      AND r.entidad_id = parsed.entidad_id
      AND r.fecha_cese IS NULL
  )
  RETURNING id
)
INSERT INTO planillas.documentos (relacion_id, tipo, estado)
SELECT ins_relaciones.id, t.tipo, 'PENDIENTE'
FROM ins_relaciones
CROSS JOIN (
  VALUES
    ('CONTRATO_FIRMADO'::planillas.tipo_documento),
    ('DNI'::planillas.tipo_documento),
    ('FICHA_DATOS'::planillas.tipo_documento),
    ('PENSIONES_FIRMADO'::planillas.tipo_documento),
    ('TR_ALTA'::planillas.tipo_documento),
    ('ASIGNACION_FAMILIAR'::planillas.tipo_documento),
    ('VIDA_LEY'::planillas.tipo_documento)
) AS t(tipo);
