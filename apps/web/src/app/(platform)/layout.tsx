import { ThemeToggle } from "@/components/public/ThemeToggle";
import { LogoutButton } from "@/components/shared/LogoutButton";
import { PLATFORM_NAME } from "@inventario/types";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b border-border/70 bg-card shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-primary sm:text-lg">{PLATFORM_NAME}</p>
            <p className="truncate text-xs text-muted-foreground">Plataforma de gestión</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
