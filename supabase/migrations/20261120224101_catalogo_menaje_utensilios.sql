-- Utensilios, limpieza, envases y baño del catálogo de menajes.
-- TÁPER va una sola vez. No toca los MJ que ya existían.

WITH nombres AS (
  SELECT *
  FROM (VALUES
    (1, 'CUCHILLO'),
    (2, 'TABLA DE PICAR'),
    (3, 'SARTÉN'),
    (4, 'PEROL'),
    (5, 'CACEROLA'),
    (6, 'TETERA'),
    (7, 'COLADOR'),
    (8, 'RALLADOR'),
    (9, 'ABRELATAS'),
    (10, 'EXPRIMIDOR'),
    (11, 'MORTERO'),
    (12, 'PELADOR'),
    (13, 'BATIDOR MANUAL'),
    (14, 'PINZA DE COCINA'),
    (15, 'RODILLO DE COCINA'),
    (16, 'TAMIZ'),
    (17, 'EMBUDO'),
    (18, 'JUEGO DE MEDIDAS'),
    (19, 'PLATO'),
    (20, 'TAZÓN'),
    (21, 'TAZA'),
    (22, 'MUG'),
    (23, 'VASO'),
    (24, 'COPA'),
    (25, 'JARRA'),
    (26, 'FUENTE'),
    (27, 'BANDEJA'),
    (28, 'AZUCARERO'),
    (29, 'SALERO'),
    (30, 'PIMENTERO'),
    (31, 'ENSALADERA'),
    (32, 'PANERA'),
    (33, 'SERVILLETERO'),
    (34, 'ESCOBA'),
    (35, 'ESCOBILLÓN'),
    (36, 'RECOGEDOR'),
    (37, 'TRAPEADOR'),
    (38, 'MOPA'),
    (39, 'BALDE'),
    (40, 'LIMPIAVIDRIOS MANUAL'),
    (41, 'CEPILLO'),
    (42, 'ESCOBILLA'),
    (43, 'ESPONJA'),
    (44, 'FRANELA'),
    (45, 'PAÑO DE MICROFIBRA'),
    (46, 'TRAPO DE LIMPIEZA'),
    (47, 'PLUMERO'),
    (48, 'ATOMIZADOR'),
    (49, 'PALA PARA BASURA'),
    (50, 'PINZA RECOLECTORA DE RESIDUOS'),
    (51, 'TACHO DE BASURA'),
    (52, 'PAPELERA'),
    (53, 'CONTENEDOR DE RESIDUOS'),
    (54, 'TÁPER'),
    (55, 'RECIPIENTE HERMÉTICO'),
    (56, 'RECIPIENTE DE PLÁSTICO'),
    (57, 'FRASCO'),
    (58, 'TARRO'),
    (59, 'BIDÓN'),
    (60, 'GALONERA'),
    (61, 'DEPÓSITO PARA ALIMENTOS'),
    (62, 'CONTENEDOR PLÁSTICO'),
    (63, 'CANASTA'),
    (64, 'CANASTILLA'),
    (65, 'LAVADOR'),
    (66, 'BATEA'),
    (67, 'TINA'),
    (68, 'CESTA PARA ROPA'),
    (69, 'CANASTA PARA ROPA'),
    (70, 'PINZA PARA ROPA'),
    (71, 'TABLA DE LAVAR'),
    (72, 'JABONERA'),
    (73, 'PORTACEPILLOS'),
    (74, 'PORTARROLLO'),
    (75, 'PORTAESCOBILLA PARA INODORO'),
    (76, 'PAPELERA DE BAÑO'),
    (77, 'LAVATORIO PORTÁTIL'),
    (78, 'DISPENSADOR MANUAL'),
    (79, 'AZAFATE'),
    (80, 'BANDEJA DE SERVICIO')
  ) AS t(orden, denominacion)
),
faltantes AS (
  SELECT n.orden, n.denominacion
  FROM nombres n
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.catalogo_nacional c
    WHERE c.origen = 'MENAJE'
      AND upper(trim(c.denominacion)) = n.denominacion
  )
),
numerados AS (
  SELECT
    f.denominacion,
    (
      SELECT COALESCE(MAX(substring(btrim(codigo::text) FROM 3)::int), 0)
      FROM public.catalogo_nacional
      WHERE origen = 'MENAJE'
        AND btrim(codigo::text) ~ '^MJ[0-9]{6}$'
    ) + row_number() OVER (ORDER BY f.orden) AS n
  FROM faltantes f
)
INSERT INTO public.catalogo_nacional (codigo, denominacion, origen, estado)
SELECT 'MJ' || lpad(n::text, 6, '0'), denominacion, 'MENAJE', 'ACTIVO'
FROM numerados;
