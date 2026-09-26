import { NextResponse } from "next/server";

const LOCAL_CALLBACK = "http://127.0.0.1:54324/auth/callback";
const APP_PROTOCOL = "pe.bdconsultores.inventario://auth/callback";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Puente OAuth para la app de escritorio.
 * No intercambia el code (PKCE vive en Electron). Abre el protocolo de la app
 * y, si el navegador lo permite, también el servidor local.
 */
export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const hasPayload = [...incoming.searchParams.keys()].some((key) => key === "code" || key === "error");

  if (!hasPayload) {
    return new NextResponse(
      `<!DOCTYPE html><html lang="es"><body style="font-family:sans-serif;padding:2rem">
        <p>No se recibió el código de autorización. Vuelva a la aplicación de escritorio e intente de nuevo.</p>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const query = incoming.searchParams.toString();
  const localUrl = `${LOCAL_CALLBACK}?${query}`;
  const protocolUrl = `${APP_PROTOCOL}?${query}`;
  const protocolHref = escapeHtml(protocolUrl);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Volver a Inventario</title>
</head>
<body style="font-family:sans-serif;padding:2rem;max-width:32rem">
  <p><strong>Inicio de sesión correcto.</strong></p>
  <p>Abriendo la aplicación de escritorio…</p>
  <p><a id="open-app" href="${protocolHref}">Abrir B&amp;D Consultores Inventario</a></p>
  <script>
    var localUrl = ${JSON.stringify(localUrl)};
    var protocolUrl = ${JSON.stringify(protocolUrl)};
    window.location.href = localUrl;
    setTimeout(function () {
      window.location.href = protocolUrl;
    }, 1200);
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
