# Login con Google — Configuración

Autenticación OAuth con cuentas **@gmail.com** o **Google Workspace** (correo corporativo).

---

## Paso 1 — Google Cloud Console

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear o seleccionar un proyecto (ej. `inventario-bd-consultores`)
3. **APIs & Services → OAuth consent screen**
   - User type: **Internal** (solo Workspace) o **External** (cualquier Gmail)
   - Completar nombre de app, email de soporte
   - Scopes: `email`, `profile`, `openid` (por defecto)
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Inventario Activos Supabase`
   - **Authorized redirect URIs** — agregar **exactamente**:

```
https://TU-PROJECT-REF.supabase.co/auth/v1/callback
```

> Reemplace `TU-PROJECT-REF` por el ID de su proyecto Supabase  
> (visible en Project URL: `https://eeivmgvspexctjeowrmk.supabase.co` → ref = `eeivmgvspexctjeowrmk`)

5. Copiar **Client ID** y **Client Secret**

---

## Paso 2 — Supabase Dashboard

### 2.1 Activar proveedor Google

1. **Authentication → Providers → Google**
2. **Enable Google**
3. Pegar **Client ID** y **Client Secret** de Google Cloud
4. Guardar

### 2.2 URLs de redirección

**Authentication → URL Configuration**

Proyecto cloud: [inventario-activos-B&D → URL Configuration](https://supabase.com/dashboard/project/eeivmgvspexctjeowrmk/auth/url-configuration)

| Campo | Valor |
|---|---|
| Site URL | `http://127.0.0.1:3010` (dev plataforma) o `http://localhost:3000` (`apps/web`) |
| Redirect URLs | Ver lista abajo |

Agregar estas **Redirect URLs** (las de 3010 son imprescindibles para el Portal):

```
http://127.0.0.1:3010/auth/callback
http://localhost:3010/auth/callback
http://localhost:3000/auth/callback
http://localhost:5173/auth/callback
http://localhost:54324/auth/callback
http://127.0.0.1:54324/auth/callback
pe.bdconsultores.inventario://auth/callback
https://bdconsultores.vercel.app/auth/callback
https://bdconsultores.vercel.app/auth/desktop-bridge
```

> **Site URL** recomendado: `https://bdconsultores.vercel.app` (no use `https://bdconsultores.org`).

**Escritorio:** tras Google, Supabase debe ir al puente `/auth/desktop-bridge`, que reenvía el `code` a `localhost:54324` sin consumirlo (PKCE en Electron). Si abre `bdconsultores.org`, falta el puente en Redirect URLs o el Site URL está mal.

### 2.3 (Opcional) Restringir dominios

Para permitir solo correos `@bdconsultores.pe` (o su dominio):

**Authentication → Providers → Google → Advanced**  
O en Fase 1 con trigger/policy que valide el dominio del email al crear `profiles`.

Alternativa rápida en Supabase:  
**Authentication → Settings → Auth Hooks** o validación en Fase 1 al insertar perfil.

---

## Paso 3 — Ya NO crear usuario manual

Con Google OAuth **no hace falta** el Paso 5 anterior (Add user manual).

El primer login con Google crea el usuario automáticamente en Supabase.

---

## Paso 4 — Probar

### Web

```bash
pnpm dev:web
```

1. Abrir http://localhost:3000
2. Clic en **Continuar con Google**
3. Elegir cuenta corporativa
4. Debe redirigir a `/dashboard`

### Desktop

```bash
pnpm dev:desktop
```

1. Clic en **Continuar con Google**
2. Se abre una ventana de la app para Google
3. Tras autorizar → la app continúa con su email (aunque el redirect pase por el Site URL)

---

## Errores comunes

| Error | Solución |
|---|---|
| `redirect_uri_mismatch` | URI en Google Cloud debe ser `https://REF.supabase.co/auth/v1/callback` |
| Desktop no completa login / abre bdconsultores.org | Agregar `http://localhost:54324/auth/callback` (y `127.0.0.1`) en Redirect URLs; Site URL = app Vercel, no el sitio .org |
| Vuelve a login sin sesión | Agregar el callback de esa app: `http://127.0.0.1:3010/auth/callback` (Portal) o `http://localhost:3000/auth/callback` (`apps/web`) |
| Desktop (Vite) no completa login | Agregar `http://localhost:5173/auth/callback` en Redirect URLs |
| `Access blocked: app not verified` | Completar OAuth consent screen o usar cuentas de prueba en External |

---

## Notas de seguridad

- No commitear Client Secret de Google ni `service_role` de Supabase
- En producción usar dominio HTTPS en Site URL y Redirect URLs
- Fase 1 asignará rol `CONTADOR` / `ADMIN_ENTIDAD` en tabla `profiles`
