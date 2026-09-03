# Deploy en Vercel — Portal, Inventarios y Planillas

Tres proyectos independientes en el mismo repo. El usuario ve un solo dominio: el **Portal** reescribe `/inventarios` y `/planillas` hacia los otros deploys.

`apps/web` sigue siendo la app actual en producción hasta el corte. No la borre.

---

## Orden de alta (la primera vez)

1. Crear proyecto **Inventarios** → anotar su URL (`https://….vercel.app`)
2. Crear proyecto **Planillas** → anotar su URL
3. Crear proyecto **Portal** → pegar esas URLs en variables `INVENTARIOS_ORIGIN` y `PLANILLAS_ORIGIN`
4. Dominio custom (`bdyconsultores.com`, etc.) **solo en Portal**
5. Añadir callbacks en Supabase (sección 4)

Cada proyecto: **Add New → Project** → mismo repo GitHub → **Root Directory** como en la tabla.

| Proyecto Vercel | Root Directory | `package.json` |
|---|---|---|
| Portal | `apps/portal` | `@bd/portal` |
| Inventarios | `apps/inventarios` | `@bd/inventarios` |
| Planillas | `apps/planillas` | `@bd/planillas` |
| (actual) Web | `apps/web` | `@inventario/web` |

Framework: **Next.js**. Rama: `main`. Vercel usa el `vercel.json` de cada app.

---

## Variables de entorno

### Portal

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `NEXT_PUBLIC_PORTAL_ORIGIN` | URL pública del Portal (dominio o `https://….vercel.app`) |
| `NEXT_PUBLIC_SITE_URL` | Igual que `NEXT_PUBLIC_PORTAL_ORIGIN` |
| `INVENTARIOS_ORIGIN` | Origin de Inventarios **sin** path (`https://bd-inventarios.vercel.app`) |
| `PLANILLAS_ORIGIN` | Origin de Planillas **sin** path |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor (invitaciones). Nunca `NEXT_PUBLIC_` |

`INVENTARIOS_ORIGIN` / `PLANILLAS_ORIGIN` se leen en el **build** del Portal (rewrites). Si cambian, hay que redeployar Portal.

### Inventarios y Planillas

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Mismo proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Mismo |
| `NEXT_PUBLIC_PORTAL_ORIGIN` | URL del Portal (login / “Aplicaciones”) |
| `NEXT_PUBLIC_SITE_URL` | Igual que el Portal (OAuth e invitaciones) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo Inventarios, si hay invitaciones desde ese app |

---

## Supabase — URL Configuration

**Site URL** (producción): `https://TU-DOMINIO` o la URL del Portal.

**Redirect URLs** — agregar:

```
https://TU-PORTAL.vercel.app/auth/callback
http://127.0.0.1:3010/auth/callback
http://localhost:3010/auth/callback
http://localhost:3000/auth/callback
```

Google Cloud no cambia: el callback OAuth sigue siendo `https://TU-PROJECT-REF.supabase.co/auth/v1/callback`.

---

## Verificar

- [ ] `https://TU-PORTAL/` — sitio público
- [ ] `/login` — Google
- [ ] Tras login → `/app`
- [ ] `/inventarios/...` — panel de inventario
- [ ] `/planillas` — cáscara
- [ ] Si Inventarios está caído, Portal y Planillas siguen

---

## Errores comunes

| Error | Solución |
|---|---|
| `/inventarios` 404 o JS en blanco | `INVENTARIOS_ORIGIN` mal (debe ser origin, sin `/inventarios`) y redeploy Portal |
| Login Google `redirect_uri_mismatch` | Falta `/auth/callback` del Portal en Supabase Redirect URLs |
| `Module not found: @inventario/ui` | Root Directory = `apps/portal` (o inventarios/planillas), no la raíz |
| Logout no vuelve al login | `NEXT_PUBLIC_PORTAL_ORIGIN` en el proyecto Inventarios |
