-- El estado Recogido del contrato solo lo marca el estudio, tras revisar el PDF firmado.
-- La empresa puede pasar de Pendiente de documentos a Elaborado al generar el documento.

CREATE OR REPLACE FUNCTION planillas.enforce_estado_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = planillas, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_personal_estudio() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.estado := 'PENDIENTE_DOCS';
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF OLD.estado = 'PENDIENTE_DOCS' AND NEW.estado = 'ELABORADO' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Solo el estudio puede marcar el contrato como recogido.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contratos_enforce_estado ON planillas.contratos;
CREATE TRIGGER contratos_enforce_estado
  BEFORE INSERT OR UPDATE OF estado ON planillas.contratos
  FOR EACH ROW EXECUTE FUNCTION planillas.enforce_estado_contrato();
