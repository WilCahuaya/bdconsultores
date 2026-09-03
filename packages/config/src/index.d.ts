export interface WebApp {
  id: string;
  label: string;
  basePath: string;
  localPort: number;
  originEnv: string;
}

export interface PortalApp {
  id: "portal";
  label: string;
  localPort: number;
}

export const portal: PortalApp;
export const webApps: readonly WebApp[];
export function webAppById(id: string): WebApp;
export function originFor(app: WebApp): string;
export function portalOrigin(): string;
export function portalRewrites(): Array<{ source: string; destination: string }>;
