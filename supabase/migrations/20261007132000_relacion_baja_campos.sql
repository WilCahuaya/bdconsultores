-- Datos del cese en la empresa: motivo, observación y baja AFP.

ALTER TABLE planillas.relaciones_laborales
  ADD COLUMN IF NOT EXISTS tipo_baja TEXT,
  ADD COLUMN IF NOT EXISTS observacion_baja TEXT,
  ADD COLUMN IF NOT EXISTS baja_afp BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE planillas.relaciones_laborales
  DROP CONSTRAINT IF EXISTS relaciones_tipo_baja_check;

ALTER TABLE planillas.relaciones_laborales
  ADD CONSTRAINT relaciones_tipo_baja_check
  CHECK (tipo_baja IS NULL OR tipo_baja IN ('CARTA_RENUNCIA', 'TERMINO_CONTRATO'));

COMMENT ON COLUMN planillas.relaciones_laborales.tipo_baja IS
  'Motivo del cese: carta de renuncia o término de contrato.';
COMMENT ON COLUMN planillas.relaciones_laborales.observacion_baja IS
  'Nota libre al dar de baja al trabajador.';
COMMENT ON COLUMN planillas.relaciones_laborales.baja_afp IS
  'Indica si ya se dio de baja en AFP.';
