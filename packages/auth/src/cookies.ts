/** Path raíz para que Portal e Inventarios (Multi Zones) compartan la sesión. */
export const supabaseCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
};
