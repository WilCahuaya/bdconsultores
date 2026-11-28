-- Espacios que no tenían ambiente: no se convirtieron en ambiente y se eliminan.
-- Los que sí tenían ambiente ya están en el nombre («Espacio 01 - …») y se conservan.

DELETE FROM public.espacios AS e
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ambientes AS a
  WHERE a.espacio_id = e.id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.ambientes AS a
  WHERE a.sede_id = e.sede_id
    AND left(a.nombre, char_length(btrim(e.nombre)) + 3) = btrim(e.nombre) || ' - '
);
