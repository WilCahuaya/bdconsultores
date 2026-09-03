import { Suspense } from "react";
import LoginPage from "./login-page";

export default function LoginRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Cargando…
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
