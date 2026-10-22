import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { findDesktopInstaller } from "@inventario/ui/desktop-installer-server";
import { getProfile } from "@/lib/auth/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Debe iniciar sesión." }, { status: 401 });
  }

  const installer = findDesktopInstaller();
  if (!installer) {
    return NextResponse.json({ error: "No hay instalador publicado." }, { status: 404 });
  }
  if (installer.externalUrl) {
    return NextResponse.redirect(installer.externalUrl);
  }

  const stream = Readable.toWeb(createReadStream(installer.filePath)) as ReadableStream;
  const filename = encodeURIComponent(installer.fileName);
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(installer.sizeBytes),
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "Cache-Control": "no-store",
    },
  });
}
