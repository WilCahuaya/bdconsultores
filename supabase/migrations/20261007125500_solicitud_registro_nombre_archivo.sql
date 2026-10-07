-- Nombre original del archivo subido en la solicitud de registro de contratos.

ALTER TABLE planillas.solicitudes_registro
  ADD COLUMN IF NOT EXISTS nombre_archivo TEXT;
