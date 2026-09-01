# Lo desarrollado — Módulo Inventario (plataforma B&D Consultores)

| | |
|---|---|
| **Cliente** | B&D Consultores Global EIRL |
| **RUC** | 20614326418 |
| **Producto** | Plataforma B&D Consultores · módulo Inventario de Activos Fijos — MVP v1.0 |
| **Documento** | Inventario de lo implementado (no el plan) |
| **Fecha** | 31 de agosto de 2026 |

Este documento describe **lo que ya está construido** en el repositorio (módulo Inventario de la plataforma B&D Consultores): pantallas, reglas de negocio, base de datos, app de escritorio y reportes. No es el plan de fases; es el estado real del software.

---

## 1. Qué es el sistema

Sistema multi-tenant para inventariar y controlar activos fijos de varias entidades (clientes de B&D). Tiene tres piezas que comparten la misma base:

| Pieza | Tecnología | Para quién |
|---|---|---|
| Sitio web institucional + paneles | Next.js 14, Tailwind, componentes estilo shadcn | Público, contadores y administradores de entidad |
| App Windows de campo | Electron + React + SQLite | Contadores en inventario físico |
| Backend | Supabase (PostgreSQL, Auth, Storage, RLS) | Datos, login Google y archivos |

**Monorepo:** `pnpm` + Turborepo.

```
inventario-activos/
├── apps/web          Plataforma web
├── apps/desktop      App Electron
├── packages/types    Tipos, código de barras, depreciación
├── packages/ui       Componentes compartidos (tema claro/oscuro)
├── supabase/         Migraciones SQL + seed del catálogo
└── docs/             Documentación
```

---

## 2. Autenticación, roles y seguridad

### Login

- Único proveedor: **Google OAuth** (Gmail o Google Workspace).
- No hay registro público ni email/contraseña.
- El primer login crea el usuario en Supabase Auth; **no entra al panel** hasta que exista un perfil en `profiles`.
- Si no hay perfil: mensaje de “cuenta no autorizada”.
- Sesión web: cookie JWT (middleware de Next.js refresca la sesión).
- Sesión escritorio: persistente; OAuth abre el navegador del sistema y vuelve a Electron.

### Roles

| Rol | Alcance | Panel web | App escritorio |
|---|---|---|---|
| `CONTADOR` | Todas las entidades | `/contador` | Sí (usuario de campo) |
| `ADMIN_ENTIDAD` | Solo su `entidad_id` | `/admin` | No (login pide rol Contador) |

Reglas en `profiles`:

- Contador: `entidad_id` debe ser nulo.
- Admin: `entidad_id` obligatorio.

### Invitaciones (contador)

- Al crear una entidad se invita al administrador (correo + nombre). Ese correo, al entrar con Google, queda con rol `ADMIN_ENTIDAD`.
- Desde Usuarios se puede invitar a otro **contador** del estudio.
- Las invitaciones existen en web y en escritorio (IPC hacia el proceso de Electron).

### Row Level Security (RLS)

Políticas en PostgreSQL (no solo en la UI):

- Contador ve/edita todas las entidades, sedes, ambientes y activos.
- Admin solo ve datos de su entidad.
- Admin puede crear sedes y ambientes de su entidad, y actualizar ambientes (no eliminar).
- Solo contador da de baja, valida preregistros y escribe en el catálogo nacional.
- Storage: fotos y comprobantes bajo `{entidad_id}/{activo_id}/…` con RLS por entidad.

---

## 3. Modelo de datos implementado

Jerarquía: **Entidad → Sede → Ambiente → Activo**.

### Entidad

Campos: razón social, RUC, dirección, datos del administrador (nombre, correo, teléfono), activo.

Al crear una entidad el sistema genera automáticamente una sede llamada **Principal**.

### Sede

Campos: nombre, `es_principal` (una sola principal por entidad), activo. El contador puede crear, editar y eliminar sucursales.

### Ambiente

Campos: nombre, descripción, **responsable**, activo. El responsable del ambiente se copia al activo al registrarlo o al moverlo.

### Activo — ficha completa

| Grupo | Campos |
|---|---|
| Identificación | Código catálogo (FK), correlativo, código de barras |
| Clasificación | Categoría (`ACTIVO` / `CUENTA_ORDEN`), estado físico (Bueno / Regular / Malo), estado de registro |
| Descripción | Nombre, descripción, características, marca, modelo, serie, color, medidas (texto y largo/ancho/altura) |
| Valorización | Valor de adquisición, flag “valor de mercado”, fecha de adquisición, % depreciación, vida útil en meses |
| Ubicación | Entidad, sede, ambiente, responsable |
| Adjuntos | Foto, comprobante PDF, serie del comprobante |
| Baja | Motivo de baja |
| Auditoría | `created_by`, `updated_by`, fechas |

### Catálogo nacional (SBN)

Tabla `catalogo_nacional` (~4.726 ítems importados desde ODS):

- Código de 8 dígitos, denominación, grupo, clase, cuenta contable, depreciación, resolución, estado (`ACTIVO` / `EXCLUIDO`).
- Búsqueda por código o denominación (`search_catalogo_nacional`, índice trigram).
- El código del activo **debe existir** en el catálogo (FK).

### Vocabulario de atributos

Tabla `activo_atributos_vocab`: autocompletado global de marca, modelo, serie y color. Se alimenta sola al guardar un activo (conteo de uso).

### Historial

Tabla `historial_cambios`: trigger en cada UPDATE de activo (campo, valor anterior, valor nuevo, usuario, fecha). Visible en la ficha web.

### Storage

| Bucket | Uso | Límite |
|---|---|---|
| `fotos-activos` | JPEG / PNG / WebP | 500 KB |
| `comprobantes-activos` | PDF o imagen | 5 MB |

---

## 4. Reglas de negocio que ya corren en código

### Ciclo de vida

```
PREREGISTRADO  →  REGISTRADO  →  DADO_DE_BAJA
```

- **Admin** crea activo → `PREREGISTRADO`, sin correlativo ni código de barras. No graba depreciación ni vida útil.
- **Contador** crea activo → `REGISTRADO` de inmediato (trigger asigna correlativo y código).
- **Contador** valida un preregistro → pasa a `REGISTRADO` y se genera el código.
- **Contador** da de baja (motivo obligatorio). Un bien dado de baja no se puede mover de ambiente.
- Admin, sobre un **preregistrado**, puede editar la ficha completa (salvo depreciación). Sobre un **registrado**, solo sede/ambiente.

### Código de barras (Code 128)

Formato acordado e implementado:

```
{código catálogo 8 dígitos}-{correlativo 6 dígitos}
Ejemplo: 74080001-000001
```

- Correlativo **por entidad y por código de catálogo** (cada ítem del catálogo reinicia en `000001`).
- Unicidad: `(entidad_id, codigo_catalogo, correlativo)` y el string completo único en `codigo_barras`.
- Se asigna solo al pasar a `REGISTRADO`.
- Preview del próximo código: RPC `preview_codigo_barras`.
- Parsing compartido en `@inventario/types` (`formatCodigoBarras` / `parseCodigoBarras`).

### Categoría del bien

- **Activo:** patrimonio contable, se deprecia (computadoras, vehículos, mobiliario, etc.).
- **Cuenta de orden:** dura más de un año pero de bajo valor; se controla, no es patrimonio importante (sillas plásticas, enseres menores, etc.).
- La UI muestra ayuda y ejemplos en el selector.

### Depreciación lineal (MVP)

Implementada en `@inventario/types` y usada en listados y reportes:

- Período = meses calendario desde la fecha de adquisición hasta la **fecha de corte** (o hoy en pantalla).
- Depreciación mensual = valor ÷ vida útil en meses.
- Vida útil se deriva del % anual del catálogo: `100 % ÷ tasa × 12`.
- Activo vigente: valor neto **no baja de S/ 1**.
- Dado de baja: valor neto **0**; la depreciación acumulada puede llegar al valor total.
- Flag “valor de mercado”: en reportes el monto va a la columna de mercado, no a precio de adquisición.

### Ubicación

- Al registrar o mover un activo, el **responsable** se toma del ambiente destino.
- Admin y contador pueden cambiar sede/ambiente (el admin, en registrados, solo eso).

---

## 5. Sitio web público (marca B&D)

Accesible sin sesión. Tema claro/oscuro. Navegación:

| Ruta | Contenido |
|---|---|
| `/` | Inicio: hero, servicios principales |
| `/nosotros` | Misión, visión, presentación |
| `/servicios` | Catálogo de servicios del estudio |
| `/clientes` | Clientes |
| `/blog` y `/blog/[slug]` | Artículos |
| `/contacto` | Contacto |
| `/login` | Entrada con Google |

Tras el login, el middleware redirige según rol: contador → `/contador`, admin → `/admin`.

---

## 6. Panel web — Contador (`/contador`)

### Dashboard

Tarjetas: entidades activas, activos totales, preregistrados (enlace filtrado), usuarios. Acceso directo al inventario global.

### Entidades

- Listado con búsqueda, vista tabla/tarjetas, alta, edición y desactivación.
- Alta pide razón social, RUC, dirección y datos del administrador; envía invitación Google.
- Al entrar a una entidad: **sedes (sucursales)** y **ambientes**.
- Sucursales: crear, editar, eliminar (la Principal se crea sola).
- Ambientes: nombre, descripción, responsable; listado de activos del ambiente.
- Desde el ambiente se registran activos ya ubicados en esa sede/ambiente.

### Inventario global (`/contador/inventario`)

- Tabla estilo inventario (19 columnas) en escritorio; **tarjetas en móvil**.
- Filtros: texto, entidad, sede, ambiente, estado (todos / registrados / preregistrados / dados de baja).
- Columnas: N°, cantidad, unidad, categoría, código, correlativo, nombre, descripción, fecha, estado físico, precio, valor mercado, % depreciación, período, dep. acumulada, valor neto, observación, comprobante (CP), acciones.
- Acciones por fila: ficha, editar, validar preregistro, dar de baja, cambiar ambiente, ver foto/PDF.
- Exportación rápida PDF/Excel del inventario valorizado por ambiente (cuando aplica el contexto).
- Paginación.

### Ficha del activo (modal)

Detalle completo, vista previa de foto y PDF, historial de cambios (quién cambió qué y cuándo), validar, baja, cambio de ambiente.

### Formulario de activo

- Autocompletado del **catálogo nacional** (mínimo 2 caracteres).
- Preview del código de barras si el contador asigna código al crear.
- Autocompletado de marca/modelo/serie/color (vocabulario global).
- Selector de categoría con ayuda.
- Fechas en formato **DD/MM/AAAA**.
- Cálculo en vivo de período, depreciación acumulada y valor neto.
- Subida de foto y comprobante; diálogo de serie del comprobante.
- Alta de sede/ambiente desde el propio formulario si faltan.

### Catálogo

Alta de ítems que no están en el maestro SBN. Validación: código de 8 dígitos, denominación, estado ACTIVO/EXCLUIDO. Plantillas listas (cocina enseres, cocina equipo, aseo, etc.).

### Usuarios

Listado de perfiles (contador y admin) con búsqueda. Invitación de un nuevo contador (nombre + correo).

### Reportes

Pantalla `/contador/reportes` (detalle en la sección 9).

---

## 7. Panel web — Administrador de entidad (`/admin`)

Alcance **solo su entidad** (RLS + UI).

### Dashboard

Nombre/RUC de la entidad, total de activos, cantidad de preregistros.

### Ambientes e inventario (`/admin/activos`)

- Navegación por ambientes de su entidad.
- Preregistrar activo (sin correlativo).
- En preregistrados: puede completar la ficha (sin depreciación).
- En registrados: **solo cambiar ubicación**.
- No puede dar de baja ni validar (eso es del contador).
- Mismos listados tabla/móvil y exportación de reportes sin valores.

### Reportes

Solo los dos inventarios **sin valores** (ambiente y entidad). No ve valorizados, acta ni bajas.

---

## 8. App de escritorio Windows (Fase 3)

Dirigida al **contador en campo**. Requiere Node 20+, `.env.local` con URL y anon key de Supabase, y perfil `CONTADOR`.

### Login y shell

- Google OAuth nativo (ventana del sistema).
- Indicador **en línea / offline** y contador de cambios pendientes.
- Tema claro/oscuro.
- Navegación: Entidades · Inventario · Catálogo · Usuarios.

### Entidades (flujo de campo)

1. Lista de entidades (alta/edición/baja, igual que web).
2. Al elegir entidad: ambientes de esa entidad (con sucursales).
3. Al elegir ambiente: inventario de ese ambiente + registro de activos.
4. Ficha del activo: editar, validar preregistro, baja, cambiar ambiente, foto/PDF, **imprimir etiqueta**.

### Inventario global

Listado de activos de la entidad seleccionada (o caché local si no hay red). Búsqueda y escaneo.

### Escaneo con pistola USB

- El lector envía el código + Enter al campo enfocado.
- Busca por `codigo_barras` o `codigo_catalogo`.
- Si hay red: consulta Supabase; si no: **caché SQLite** de la última sync.
- Si no existe: ofrece registrar un activo nuevo con ese código.

### Registro / edición

Mismo conjunto de campos que la web, con picker de catálogo **local** (SQLite) para trabajar sin internet.

### Catálogo offline

Tras el login (con red) se descarga el catálogo nacional a `userData/inventario.db`. IPC:

- `catalog:replace` — sync masiva
- `catalog:search` — búsqueda local
- `catalog:getByCodigo` / `catalog:meta` / `catalog:upsert`

El vocabulario de atributos también se replica (`atributoVocab:*`).

### Offline y cola de sincronización

SQLite local (`inventario.db`):

| Tabla | Uso |
|---|---|
| `activos_cache` | Copia de activos por entidad para escanear/consultar sin red |
| `sync_queue` | Operaciones `create` / `update` pendientes |

Comportamiento:

1. Con internet, los activos de la entidad se bajan a caché.
2. Sin internet se puede escanear, registrar y editar; los cambios van a la cola (incluidas foto y PDF en base64).
3. Al reconectar: sync automática + botón “Sincronizar ahora”.
4. Los ítems pendientes se marcan en ficha (`pending-…`) hasta confirmarse en el servidor.
5. Impresión ZPL **no depende de internet** (USB local).

Login: la primera vez necesita red; con sesión previa cacheada se puede seguir trabajando.

### Impresión de etiquetas ZPL

Impresora objetivo: **Honeywell PC42E-T** (modo ZSim / ZPL II). Etiqueta de referencia 50×25 mm.

Contenido de la etiqueta:

- Encabezado `B&D - {entidad}`
- Code 128 con el código completo
- Nombre del bien

Funciones ya hechas:

- Vista previa del ZPL
- Envío RAW a impresora de Windows (lista de impresoras del sistema; se recuerda la última)
- Guardar archivo `.zpl`
- Reimpresión desde la ficha al escanear un activo existente
- **Impresión por lote** (varios códigos en un solo trabajo)

---

## 9. Reportes (Fase 4)

Generación **en el navegador** (jsPDF + SheetJS). Rutas: `/contador/reportes` y `/admin/reportes`.

Filtros: tipo de reporte, entidad, sede/ambiente si aplica, **fecha de corte**.

| # | Reporte | PDF | Excel | Roles |
|---|---|---|---|---|
| 1 | Inventario por ambiente (sin valores) | Sí | Sí | Contador y admin |
| 2 | Inventario general por entidad (sin valores) | Sí | Sí | Contador y admin |
| 3 | Inventario valorizado por ambiente | Sí | Sí | Solo contador |
| 4 | Inventario valorizado por entidad | Sí | Sí | Solo contador |
| 5 | Acta de inventario (con bloques de firma) | Sí | — | Solo contador |
| 6 | Reporte de bajas (motivo y fecha) | Sí | Sí | Solo contador |

### Membrete institucional (PDF y Excel)

- Razón social B&D Consultores Global EIRL
- Nombre del producto y RUC (el RUC en código aún es placeholder `2060XXXXXXX`)
- Entidad, sede/ambiente/responsable si aplica
- Fecha de generación, fecha de corte, usuario (nombre y correo)
- Número de registros
- Pie: “Página X de Y”
- Marca de agua / logo (si está configurado el PNG)

### Columnas de inventario

**Sin valores:** N°, Cant., Und., Cat., Código, Corr., Nombre, Descripción, (Ubicación en reportes por entidad), Fecha adq., Estado, Observación.

**Valorizados:** lo anterior + Precio adq., V. mercado, % Deprec., Periodo, Dep. acum., Valor neto, Observación, CP. Totales al pie. Resumen por **cuenta contable** del catálogo nacional.

**Acta:** listado físico + bloques “Contador / Auditor”, “Representante de la entidad”, “Fecha”.

**Bajas:** código, correlativo, nombre, sede, ambiente, motivo, fecha de baja.

Exportación rápida desde la vista de inventario por ambiente usa el formato valorizado (#3).

---

## 10. Paquetes compartidos

### `@inventario/types`

Roles, estados, interfaces (`Activo`, `Entidad`, `Sede`, `Ambiente`, `Profile`, `CatalogoNacional`, historial), formato de fechas DD/MM/AAAA, moneda `es-PE`, código de barras, depreciación, categoría del bien, plantillas de catálogo, validaciones.

### `@inventario/ui`

Botones, inputs, diálogos, tarjetas, selector de categoría, autocompletado de atributos, panel de alta de catálogo, tablas/paginación del panel, toggle de tema.

---

## 11. Migraciones SQL aplicadas (orden)

| Archivo | Qué aporta |
|---|---|
| `20260606000000_fase0_placeholder.sql` | Base Fase 0 |
| `20260608100000_fase1_schema.sql` | Tablas, enums, RLS, correlativo, historial, storage |
| `20260609100000_catalogo_nacional.sql` | Maestro SBN + búsqueda + FK |
| `20260610100000_activos_campos_extendidos.sql` | Ficha extendida (marca, medidas, etc.) |
| `20260611100000_fase2_entidad_sede_ambiente.sql` | Datos de entidad, sede Principal, responsable de ambiente |
| `20260612100000_activos_medidas_texto.sql` | Medidas como texto consolidado |
| `20260613100000_activos_comprobante_serie.sql` | Serie del comprobante |
| `20260614100000_fase2_profiles_insert.sql` | Contador puede crear perfiles |
| `20260615100000_activos_motivo_baja.sql` | Motivo de baja |
| `20260616100000_ambientes_update_admin.sql` | Admin edita ambientes de su entidad |
| `20260617100000_correlativo_por_catalogo.sql` | Correlativo por entidad **y** código catálogo |
| `20260618100000_activo_atributos_vocab.sql` | Autocompletado marca/modelo/serie/color |
| `20260619100000_catalogo_contador_write.sql` | Contador da de alta ítems al catálogo |

Seed: `supabase/seed/catalogo_nacional.sql` (idempotente). Script: `pnpm import:catalogo`.

---

## 12. Lo que falta respecto al plan (no desarrollado o incompleto)

### Operación / despliegue

- Repositorio remoto y CI/CD completos (Vercel está documentado; hay que conectar variables y OAuth de producción).
- Instalador Windows (.exe / NSIS) de la app de escritorio.
- Política formal de backup y go-live (Fase 6).
- Capacitación y manual de usuario v1.

### Validación en campo (Fase 5)

- Piloto con entidad real (50–200 activos).
- Prueba de 4 horas offline sin pérdida de datos.
- Calibración física de la PC42E-T y aprobación del tamaño de etiqueta con contadores.
- Acta de piloto y métricas de satisfacción.

### Detalles pendientes de reportes / marca

- RUC real en `apps/web/src/lib/reportes/branding.ts` (hoy placeholder).
- Logo gráfico definitivo en membrete (hoy texto + marca de agua opcional).
- Prueba de rendimiento: 500 activos en menos de 10 s.
- Validación visual de Excel en LibreOffice y Microsoft Excel.

### Fuera de alcance del MVP (no se construyó a propósito)

- App móvil ni escaneo por cámara.
- Integración SIAF / SAP u otros sistemas contables.
- Notificaciones y alertas automáticas.
- Firma digital electrónica certificada (el acta solo deja espacios para firma manuscrita).
- Multi-idioma.
- Nivel “Piso” como jerarquía formal.

---

## 13. Cómo ejecutar lo desarrollado

Requisitos: Node.js ≥ 20, pnpm ≥ 9, proyecto Supabase con migraciones y catálogo cargados, Google OAuth configurado.

```bash
pnpm install
cp .env.example apps/web/.env.local
cp .env.example apps/desktop/.env.local
# Completar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
# (en desktop: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY)

pnpm dev:web        # http://localhost:3000
pnpm dev:desktop    # Electron
pnpm typecheck
pnpm build:web
```

Guías relacionadas: `docs/FASE1_SETUP.md`, `docs/FASE3_SETUP.md`, `docs/FASE4_SETUP.md`, `docs/AUTH_GOOGLE.md`, `docs/CATALOGO_NACIONAL.md`, `docs/CODIGO_BARRAS_v1.md`, `docs/DEPLOY_VERCEL.md`.

---

*B&D Consultores Global EIRL · Documento de lo implementado · MVP v1.0*
