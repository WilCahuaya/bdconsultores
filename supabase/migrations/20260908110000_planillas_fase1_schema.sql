-- Planillas Fase 1 — esquema, RLS y campos de entidad.
-- Estudio (CONTADOR, ASISTENTE): ve y escribe todas las empresas.
-- Empresa (ADMIN_ENTIDAD, TESORERO_ENTIDAD, SECRETARIO_ENTIDAD): solo lectura de su entidad.
-- Inventario no cambia: can_access_entidad sigue siendo CONTADOR + ADMIN_ENTIDAD.

-- ---------------------------------------------------------------------------
-- Perfiles: asistente sin entidad; tesorero/secretario con entidad
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_admin_entidad_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_rol_entidad_check CHECK (
    (rol IN ('CONTADOR', 'ASISTENTE') AND entidad_id IS NULL)
    OR (
      rol IN ('ADMIN_ENTIDAD', 'TESORERO_ENTIDAD', 'SECRETARIO_ENTIDAD')
      AND entidad_id IS NOT NULL
    )
  );

ALTER TABLE public.entidades
  ADD COLUMN IF NOT EXISTS pe_codigo TEXT,
  ADD COLUMN IF NOT EXISTS notas_planillas TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS entidades_pe_codigo_unique
  ON public.entidades (pe_codigo)
  WHERE pe_codigo IS NOT NULL;

-- Inventario: tesorero/secretario no heredan acceso a activos
CREATE OR REPLACE FUNCTION public.can_access_entidad(p_entidad_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_contador()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND activo = TRUE
        AND rol = 'ADMIN_ENTIDAD'
        AND entidad_id = p_entidad_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_asistente()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol = 'ASISTENTE' AND activo = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_personal_estudio()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND activo = TRUE
      AND rol IN ('CONTADOR', 'ASISTENTE')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_entidad_planillas(p_entidad_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_personal_estudio()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND activo = TRUE
        AND rol IN ('ADMIN_ENTIDAD', 'TESORERO_ENTIDAD', 'SECRETARIO_ENTIDAD')
        AND entidad_id = p_entidad_id
    );
$$;

-- ---------------------------------------------------------------------------
-- Esquema planillas
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS planillas;

GRANT USAGE ON SCHEMA planillas TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums del módulo
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE planillas.clasificacion_trabajador AS ENUM ('PATROCINADO', 'SUPERVIVENCIA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE planillas.jornada_laboral AS ENUM ('TIEMPO_COMPLETO', 'TIEMPO_PARCIAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE planillas.estado_relacion AS ENUM ('ACTIVA', 'CESADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE planillas.estado_contrato AS ENUM (
    'PENDIENTE_DOCS',
    'ELABORADO',
    'ENVIADO_FIRMA',
    'FIRMADO',
    'PRESENTADO_MTPE',
    'RECEPCIONADO',
    'RECOGIDO',
    'REGISTRADO',
    'ALTA_TR',
    'COMPLETO',
    'BAJA',
    'NO_UBICADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE planillas.tipo_documento AS ENUM (
    'DNI',
    'FICHA_DATOS',
    'PENSIONES_FIRMADO',
    'ASIGNACION_FAMILIAR',
    'CONTRATO_FIRMADO',
    'TR_ALTA',
    'TR_BAJA',
    'CARTA_RENUNCIA',
    'VIDA_LEY',
    'OTRO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE planillas.estado_documento AS ENUM ('SI', 'NO', 'NA', 'PENDIENTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE planillas.tipo_pension AS ENUM ('AFP', 'ONP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE planillas.estado_tramite_pension AS ENUM ('PENDIENTE', 'TRAMITADO', 'NO_APLICA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE planillas.tipo_t_registro AS ENUM ('ALTA', 'BAJA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planillas.personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dni TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellido_paterno TEXT,
  apellido_materno TEXT,
  fecha_nacimiento DATE,
  celular TEXT,
  correo TEXT,
  direccion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT personas_dni_unique UNIQUE (dni)
);

CREATE TABLE IF NOT EXISTS planillas.relaciones_laborales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES planillas.personas(id) ON DELETE RESTRICT,
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE RESTRICT,
  cargo TEXT,
  clasificacion planillas.clasificacion_trabajador,
  jornada planillas.jornada_laboral,
  fecha_ingreso DATE,
  fecha_cese DATE,
  estado planillas.estado_relacion NOT NULL DEFAULT 'ACTIVA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT relaciones_cese_check CHECK (
    fecha_cese IS NULL OR fecha_ingreso IS NULL OR fecha_cese >= fecha_ingreso
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS relaciones_persona_entidad_activa
  ON planillas.relaciones_laborales (persona_id, entidad_id)
  WHERE fecha_cese IS NULL;

CREATE TABLE IF NOT EXISTS planillas.contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relacion_id UUID NOT NULL REFERENCES planillas.relaciones_laborales(id) ON DELETE CASCADE,
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1,
  numero_contrato TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  remuneracion NUMERIC(12, 2),
  asignacion_familiar NUMERIC(12, 2),
  jornada planillas.jornada_laboral,
  es_vigente BOOLEAN NOT NULL DEFAULT FALSE,
  estado planillas.estado_contrato NOT NULL DEFAULT 'PENDIENTE_DOCS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS contratos_un_vigente_por_relacion
  ON planillas.contratos (relacion_id)
  WHERE es_vigente;

CREATE TABLE IF NOT EXISTS planillas.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relacion_id UUID NOT NULL REFERENCES planillas.relaciones_laborales(id) ON DELETE CASCADE,
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE RESTRICT,
  tipo planillas.tipo_documento NOT NULL,
  estado planillas.estado_documento NOT NULL DEFAULT 'PENDIENTE',
  storage_path TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planillas.pensiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relacion_id UUID NOT NULL REFERENCES planillas.relaciones_laborales(id) ON DELETE CASCADE,
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE RESTRICT,
  tipo planillas.tipo_pension NOT NULL,
  afp_nombre TEXT,
  cuspp TEXT,
  tramite_estado planillas.estado_tramite_pension NOT NULL DEFAULT 'PENDIENTE',
  fecha_tramite DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pensiones_relacion_unique UNIQUE (relacion_id)
);

CREATE TABLE IF NOT EXISTS planillas.vida_ley (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relacion_id UUID NOT NULL REFERENCES planillas.relaciones_laborales(id) ON DELETE CASCADE,
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE RESTRICT,
  estado TEXT,
  numero_poliza TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vida_ley_relacion_unique UNIQUE (relacion_id)
);

CREATE TABLE IF NOT EXISTS planillas.t_registro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relacion_id UUID NOT NULL REFERENCES planillas.relaciones_laborales(id) ON DELETE CASCADE,
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE RESTRICT,
  tipo planillas.tipo_t_registro NOT NULL,
  realizado BOOLEAN NOT NULL DEFAULT FALSE,
  fecha DATE,
  documento_id UUID REFERENCES planillas.documentos(id) ON DELETE SET NULL,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planillas.auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id UUID REFERENCES public.entidades(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tabla TEXT NOT NULL,
  registro_id UUID,
  accion TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relaciones_entidad ON planillas.relaciones_laborales (entidad_id);
CREATE INDEX IF NOT EXISTS idx_relaciones_persona ON planillas.relaciones_laborales (persona_id);
CREATE INDEX IF NOT EXISTS idx_contratos_relacion ON planillas.contratos (relacion_id);
CREATE INDEX IF NOT EXISTS idx_documentos_relacion ON planillas.documentos (relacion_id);
CREATE INDEX IF NOT EXISTS idx_t_registro_relacion ON planillas.t_registro (relacion_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON planillas.auditoria (entidad_id);

-- ---------------------------------------------------------------------------
-- entidad_id en hijos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION planillas.set_entidad_from_relacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = planillas, public
AS $$
BEGIN
  SELECT r.entidad_id INTO NEW.entidad_id
  FROM planillas.relaciones_laborales r
  WHERE r.id = NEW.relacion_id;

  IF NEW.entidad_id IS NULL THEN
    RAISE EXCEPTION 'relacion_laboral no encontrada';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contratos_set_entidad ON planillas.contratos;
CREATE TRIGGER contratos_set_entidad
  BEFORE INSERT OR UPDATE OF relacion_id ON planillas.contratos
  FOR EACH ROW EXECUTE FUNCTION planillas.set_entidad_from_relacion();

DROP TRIGGER IF EXISTS documentos_set_entidad ON planillas.documentos;
CREATE TRIGGER documentos_set_entidad
  BEFORE INSERT OR UPDATE OF relacion_id ON planillas.documentos
  FOR EACH ROW EXECUTE FUNCTION planillas.set_entidad_from_relacion();

DROP TRIGGER IF EXISTS pensiones_set_entidad ON planillas.pensiones;
CREATE TRIGGER pensiones_set_entidad
  BEFORE INSERT OR UPDATE OF relacion_id ON planillas.pensiones
  FOR EACH ROW EXECUTE FUNCTION planillas.set_entidad_from_relacion();

DROP TRIGGER IF EXISTS vida_ley_set_entidad ON planillas.vida_ley;
CREATE TRIGGER vida_ley_set_entidad
  BEFORE INSERT OR UPDATE OF relacion_id ON planillas.vida_ley
  FOR EACH ROW EXECUTE FUNCTION planillas.set_entidad_from_relacion();

DROP TRIGGER IF EXISTS t_registro_set_entidad ON planillas.t_registro;
CREATE TRIGGER t_registro_set_entidad
  BEFORE INSERT OR UPDATE OF relacion_id ON planillas.t_registro
  FOR EACH ROW EXECUTE FUNCTION planillas.set_entidad_from_relacion();

DROP TRIGGER IF EXISTS personas_updated_at ON planillas.personas;
CREATE TRIGGER personas_updated_at
  BEFORE UPDATE ON planillas.personas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS relaciones_updated_at ON planillas.relaciones_laborales;
CREATE TRIGGER relaciones_updated_at
  BEFORE UPDATE ON planillas.relaciones_laborales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS contratos_updated_at ON planillas.contratos;
CREATE TRIGGER contratos_updated_at
  BEFORE UPDATE ON planillas.contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS documentos_updated_at ON planillas.documentos;
CREATE TRIGGER documentos_updated_at
  BEFORE UPDATE ON planillas.documentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS pensiones_updated_at ON planillas.pensiones;
CREATE TRIGGER pensiones_updated_at
  BEFORE UPDATE ON planillas.pensiones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS vida_ley_updated_at ON planillas.vida_ley;
CREATE TRIGGER vida_ley_updated_at
  BEFORE UPDATE ON planillas.vida_ley
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS t_registro_updated_at ON planillas.t_registro;
CREATE TRIGGER t_registro_updated_at
  BEFORE UPDATE ON planillas.t_registro
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE planillas.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE planillas.relaciones_laborales ENABLE ROW LEVEL SECURITY;
ALTER TABLE planillas.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE planillas.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE planillas.pensiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE planillas.vida_ley ENABLE ROW LEVEL SECURITY;
ALTER TABLE planillas.t_registro ENABLE ROW LEVEL SECURITY;
ALTER TABLE planillas.auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personas_select ON planillas.personas;
CREATE POLICY personas_select ON planillas.personas
  FOR SELECT TO authenticated
  USING (
    public.is_personal_estudio()
    OR EXISTS (
      SELECT 1 FROM planillas.relaciones_laborales r
      WHERE r.persona_id = personas.id
        AND public.can_access_entidad_planillas(r.entidad_id)
    )
  );

DROP POLICY IF EXISTS personas_write ON planillas.personas;
CREATE POLICY personas_write ON planillas.personas
  FOR ALL TO authenticated
  USING (public.is_personal_estudio())
  WITH CHECK (public.is_personal_estudio());

DROP POLICY IF EXISTS relaciones_select ON planillas.relaciones_laborales;
CREATE POLICY relaciones_select ON planillas.relaciones_laborales
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS relaciones_write ON planillas.relaciones_laborales;
CREATE POLICY relaciones_write ON planillas.relaciones_laborales
  FOR ALL TO authenticated
  USING (public.is_personal_estudio())
  WITH CHECK (public.is_personal_estudio());

DROP POLICY IF EXISTS contratos_select ON planillas.contratos;
CREATE POLICY contratos_select ON planillas.contratos
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS contratos_write ON planillas.contratos;
CREATE POLICY contratos_write ON planillas.contratos
  FOR ALL TO authenticated
  USING (public.is_personal_estudio())
  WITH CHECK (public.is_personal_estudio());

DROP POLICY IF EXISTS documentos_select ON planillas.documentos;
CREATE POLICY documentos_select ON planillas.documentos
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS documentos_write ON planillas.documentos;
CREATE POLICY documentos_write ON planillas.documentos
  FOR ALL TO authenticated
  USING (public.is_personal_estudio())
  WITH CHECK (public.is_personal_estudio());

DROP POLICY IF EXISTS pensiones_select ON planillas.pensiones;
CREATE POLICY pensiones_select ON planillas.pensiones
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS pensiones_write ON planillas.pensiones;
CREATE POLICY pensiones_write ON planillas.pensiones
  FOR ALL TO authenticated
  USING (public.is_personal_estudio())
  WITH CHECK (public.is_personal_estudio());

DROP POLICY IF EXISTS vida_ley_select ON planillas.vida_ley;
CREATE POLICY vida_ley_select ON planillas.vida_ley
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS vida_ley_write ON planillas.vida_ley;
CREATE POLICY vida_ley_write ON planillas.vida_ley
  FOR ALL TO authenticated
  USING (public.is_personal_estudio())
  WITH CHECK (public.is_personal_estudio());

DROP POLICY IF EXISTS t_registro_select ON planillas.t_registro;
CREATE POLICY t_registro_select ON planillas.t_registro
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS t_registro_write ON planillas.t_registro;
CREATE POLICY t_registro_write ON planillas.t_registro
  FOR ALL TO authenticated
  USING (public.is_personal_estudio())
  WITH CHECK (public.is_personal_estudio());

DROP POLICY IF EXISTS auditoria_select ON planillas.auditoria;
CREATE POLICY auditoria_select ON planillas.auditoria
  FOR SELECT TO authenticated
  USING (
    public.is_personal_estudio()
    OR (entidad_id IS NOT NULL AND public.can_access_entidad_planillas(entidad_id))
  );

DROP POLICY IF EXISTS auditoria_insert ON planillas.auditoria;
CREATE POLICY auditoria_insert ON planillas.auditoria
  FOR INSERT TO authenticated
  WITH CHECK (public.is_personal_estudio());

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA planillas TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA planillas
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
