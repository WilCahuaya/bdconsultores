# B&D Consultores — Plataforma de gestión

Suite web y escritorio de **B&D Consultores Global EIRL**.

Hoy incluye el módulo **Inventario** (activos fijos). **Planillas** y otros módulos se irán sumando en la misma plataforma (mismo login, mismo panel).

Tras iniciar sesión (plataforma nueva): [http://localhost:3010/app](http://localhost:3010/app)

La app actual en Vercel sigue en `apps/web` (puerto 3000).

## Estructura

```
bdconsultores/
├── apps/
│   ├── web/           # Next.js 14 — app actual en Vercel (no partir aún)
│   ├── desktop/       # Electron — Inventario de campo
│   ├── portal/        # Dominio único: público, login, /app (puerto 3010)
│   ├── inventarios/   # Módulo Inventario en /inventarios (puerto 3011)
│   └── planillas/     # Módulo Planillas en /planillas (puerto 3012)
├── packages/
│   ├── auth/          # Clientes Supabase compartidos (Portal + Inventarios)
│   ├── config/        # Rutas y rewrites de las apps web
│   ├── types/
│   └── ui/
├── supabase/
└── docs/
```

## Requisitos

- Node.js ≥ 20
- pnpm ≥ 9

## Inicio rápido

```bash
# 1. Instalar dependencias (descarga binario de Electron)
pnpm install
# Si desktop falla con "Electron failed to install correctly":
# node node_modules/.pnpm/electron@*/node_modules/electron/install.js

# 2. Configurar Supabase (ver supabase/README.md)
cp .env.example apps/web/.env.local
cp .env.example apps/desktop/.env.local
# Editar con URL y anon key de su proyecto Supabase

# 3. Configurar login Google (ver docs/AUTH_GOOGLE.md)

# 4. Desarrollo
pnpm dev:web          # http://localhost:3000  — app actual (Vercel)
pnpm dev:plataforma   # http://localhost:3010 — Portal + Inventarios + Planillas
pnpm dev:desktop      # Electron + Vite (módulo Inventario)
```

Copiar env del web actual al Portal e Inventarios:

```bash
pnpm.cmd sync:plataforma-env
```

## Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | Web actual (`apps/web`) + Desktop |
| `pnpm dev:web` | Solo `apps/web` (localhost:3000) |
| `pnpm dev:desktop` | Solo app Electron (Inventario de campo) |
| `pnpm dev:plataforma` | Portal + Inventarios + Planillas (3010–3012) |
| `pnpm sync:plataforma-env` | Copia keys de `apps/web/.env.local` a Portal e Inventarios |
| `pnpm dev:portal` | Solo Portal (localhost:3010) |
| `pnpm build` | Build de todos los paquetes |
| `pnpm typecheck` | Verificación TypeScript |

## Módulos

| Módulo | Estado | Acceso web |
|---|---|---|
| Inventario | Operativo | Portal `/app` → `/inventarios/admin` o `/inventarios/contador` |
| Planillas | En construcción | Portal `/app` → `/planillas` |

## Fases de desarrollo (Inventario)

Ver [docs/PLAN_DESARROLLO_MVP_v1.md](./docs/PLAN_DESARROLLO_MVP_v1.md)

| Fase | Estado |
|---|---|
| 0 — Fundamentos | ✅ En progreso |
| 1 — Backend y datos | Pendiente |
| 2 — Plataforma web | Pendiente |
| 3 — App escritorio | Pendiente |
| 4 — Reportes | Pendiente |
| 5 — Piloto | Pendiente |
| 6 — Cierre MVP | Pendiente |

## Deploy (Vercel)

Ver guía paso a paso: [docs/DEPLOY_VERCEL.md](./docs/DEPLOY_VERCEL.md)

Resumen: tres proyectos (Portal, Inventarios, Planillas). El dominio va solo en Portal. `apps/web` sigue siendo la producción actual hasta el corte.

## Documentación

- [Lo desarrollado (detalle del MVP Inventario)](./docs/DESARROLLADO_MVP.md)
- [Plan de desarrollo](./docs/PLAN_DESARROLLO_MVP_v1.md)
- [Deploy Vercel](./docs/DEPLOY_VERCEL.md)
- [App de escritorio — build e instalación](./apps/desktop/README.md)
- [Arquitectura v1](./docs/ARQUITECTURA_v1.md)
- [Código de barras v1](./docs/CODIGO_BARRAS_v1.md)
- [Login con Google](./docs/AUTH_GOOGLE.md)
- [Contribución](./CONTRIBUTING.md)

## Stack

Supabase · Next.js 14 · Electron · TypeScript · Tailwind · shadcn-style UI · ZPL (Inventario de campo)
