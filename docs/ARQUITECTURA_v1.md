# Arquitectura v1 — Plataforma B&D Consultores (módulo Inventario)

**Versión:** 1.1 · **Fase:** 0 (Fundamentos)

La web es la **plataforma B&D Consultores**. Tras el login el usuario entra a `/app` (selector de módulos). Inventario vive en `/contador` y `/admin`. Planillas y otros módulos se añadirán al mismo producto.

## 1. Diagrama de componentes

```
┌─────────────────────┐     ┌─────────────────────┐
│   App Escritorio    │     │   Plataforma Web    │
│   Electron + React  │     │   Next.js 14        │
│   SQLite (offline)  │     │   Vercel            │
└──────────┬──────────┘     └──────────┬──────────┘
           │                             │
           │    HTTPS / REST / Auth JWT  │
           └──────────────┬──────────────┘
                          ▼
              ┌───────────────────────┐
              │       Supabase        │
              │  PostgreSQL + RLS     │
              │  Auth · Storage       │
              └───────────────────────┘
```

## 2. Monorepo

| Paquete | Nombre npm | Responsabilidad |
|---|---|---|
| `apps/web` | `@inventario/web` | UI web, reportes (Fase 4) |
| `apps/desktop` | `@inventario/desktop` | Campo, ZPL, offline (Fase 3) |
| `packages/types` | `@inventario/types` | Tipos, utilidades código barras |
| `packages/ui` | `@inventario/ui` | Componentes UI compartidos |

**Orquestación:** Turborepo + pnpm workspaces

## 3. Autenticación

- **Proveedor:** Supabase Auth (email/password)
- **Token:** JWT en cookie (web) / localStorage persist (desktop)
- **Roles:** `CONTADOR` | `ADMIN_ENTIDAD` (tabla `profiles` — Fase 1)
- **Autorización:** Row Level Security en PostgreSQL (Fase 1)

### Flujo web

```
/login → signInWithPassword → middleware refresca sesión → /dashboard
```

### Flujo desktop

```
Login → sesión persistida → offline con sesión cacheada (Fase 3)
```

## 4. Datos (Fase 1)

Jerarquía: **Entidad → Sede → Ambiente → Activo**

Estados activo: `PREREGISTRADO` → `REGISTRADO` → `DADO_DE_BAJA`

## 5. Offline (Fase 3)

```
Online  → Supabase directo
Offline → SQLite local + cola pending_sync
Reconnect → sync automático
```

## 6. Impresión (Fase 3)

- Impresora: Honeywell PC42E-T (modo ZSim / ZPL II)
- Formato: Code 128 — ver `CODIGO_BARRAS_v1.md`

## 7. Deploy

| Entorno | Web | Backend | Desktop |
|---|---|---|---|
| Dev | localhost:3000 | Supabase cloud o local | Electron dev |
| Staging | Vercel preview | Supabase staging | .exe interno |
| Prod | Vercel | Supabase Pro | Instalador NSIS |

## 8. Decisiones técnicas (ADR resumidas)

| Decisión | Elección | Motivo |
|---|---|---|
| Backend | Supabase | RLS, auth, storage, velocidad MVP |
| Monorepo | pnpm + Turbo | Compartir UI/types web/desktop |
| UI | Tailwind + componentes shadcn-style | Consistencia, accesibilidad |
| Desktop | Electron | USB, impresión, ecosistema maduro |
| Etiquetas | ZPL nativo | Calidad PC42E-T |

---

*Documento vivo — se actualiza al cierre de cada fase.*
