import { portalOrigin } from "@bd/config";
import { NextResponse, type NextRequest } from "next/server";

/** El OAuth vive en el Portal. Si el callback llega aquí, reenvía el `code` sin consumirlo. */
export async function GET(request: NextRequest) {
  const qs = request.nextUrl.search;
  return NextResponse.redirect(`${portalOrigin()}/auth/callback${qs}`);
}
