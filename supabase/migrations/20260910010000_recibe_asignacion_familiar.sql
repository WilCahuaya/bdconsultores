ALTER TABLE planillas.relaciones_laborales
  ADD COLUMN IF NOT EXISTS recibe_asignacion_familiar BOOLEAN;

COMMENT ON COLUMN planillas.relaciones_laborales.recibe_asignacion_familiar IS
  'Si la ficha de datos indica que recibe asignación familiar. El monto va en el contrato; el trámite AFP se registra después.';
