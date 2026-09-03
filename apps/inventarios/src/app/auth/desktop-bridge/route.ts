import { NextResponse } from "next/server";

const DESKTOP_CALLBACK = "http://localhost:54324/auth/callback";

/**
 * Puente OAuth para la app de escritorio.
 * No intercambia el code (PKCE vive en Electron): solo reenvía query a localhost:54324.
 */
export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const target = new URL(DESKTOP_CALLBACK);

  incoming.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  if (![...target.searchParams.keys()].some((k) => k === "code" || k === "error")) {
    return new NextResponse(
      `<!DOCTYPE html><html lang="es"><body style="font-family:sans-serif;padding:2rem">
        <p>No se recibió el código de autorización. Vuelva a la aplicación de escritorio e intente de nuevo.</p>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  return NextResponse.redirect(target.toString(), 302);
}
