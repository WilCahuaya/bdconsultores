# B&D Consultores — Plataforma de gestión

Suite web y escritorio de **B&D Consultores Global EIRL**.

Hoy incluye el módulo **Inventario** (activos fijos). **Planillas** y otros módulos se irán sumando en la misma plataforma (mismo login, mismo panel).

Tras iniciar sesión: [http://localhost:3000/app](http://localhost:3000/app)

## Estructura

```
bdconsultores/
├── apps/
│   ├── web/          # Next.js 14 — plataforma (sitio, Inventario, hub /app)
│   └── desktop/      # Electron — Inventario de campo
├── packages/
│   ├── types/        # Tipos compartidos (plataforma + inventario)
│   └── ui/           # Componentes UI compartidos
├── supabase/         # Migraciones y config Supabase
└── docs/             # Documentación
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
pnpm dev:web       # http://localhost:3000  → login → /app
pnpm dev:desktop   # Electron + Vite (módulo Inventario)
```

## Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | Web + Desktop en paralelo |
| `pnpm dev:web` | Solo plataforma web |
| `pnpm dev:desktop` | Solo app Electron (Inventario de campo) |
| `pnpm build` | Build de todos los paquetes |
| `pnpm typecheck` | Verificación TypeScript |

## Módulos

| Módulo | Estado | Acceso web |
|---|---|---|
| Inventario | Operativo | Hub `/app` → `/contador` o `/admin` |
| Planillas | Pendiente | Visible en el hub como «Próximamente» |

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

Resumen: importar repo en Vercel, **Root Directory** = `apps/web`, rama `main`, variables `NEXT_PUBLIC_SUPABASE_*`.

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
