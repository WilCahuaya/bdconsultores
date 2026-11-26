-- El administrador elimina el menaje activo de su entidad.
-- Una baja ya registrada no se borra: queda en el historial.

DROP POLICY IF EXISTS activos_delete ON public.activos;
CREATE POLICY activos_delete ON public.activos
  FOR DELETE TO authenticated
  USING (
    public.is_contador()
    OR (
      categoria = 'MENAJE'
      AND estado_registro IS DISTINCT FROM 'DADO_DE_BAJA'
      AND entidad_id = public.my_entidad_id()
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.rol = 'ADMIN_ENTIDAD'
          AND p.activo = TRUE
      )
    )
  );

DROP POLICY IF EXISTS menaje_comprobantes_delete ON public.menaje_comprobantes;
CREATE POLICY menaje_comprobantes_delete ON public.menaje_comprobantes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.activos a
      WHERE a.id = activo_id
        AND public.can_access_entidad(a.entidad_id)
        AND (
          public.is_contador()
          OR (
            a.categoria = 'MENAJE'
            AND a.estado_registro IS DISTINCT FROM 'DADO_DE_BAJA'
            AND a.entidad_id = public.my_entidad_id()
          )
        )
    )
  );
