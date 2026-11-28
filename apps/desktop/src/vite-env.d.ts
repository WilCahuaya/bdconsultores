/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  electronAPI?: {
    platform: string;
    authCallbackPath: string;
    authCallbackUrl: string;
    authDesktopRedirectUrl?: string;
    beginGoogleAuth: () => Promise<void>;
    cancelGoogleAuth: () => Promise<void>;
    getAuthDiagnostics: () => Promise<{
      ok: boolean;
      callbackUrl: string;
      localCallbackUrl?: string;
      callbackPort: number;
      platform: string;
      error?: string;
    }>;
    openGoogleAuth: (url: string) => Promise<string>;
    syncCatalog: (
      rows: unknown[],
    ) => Promise<{ count: number; syncedAt: string | null }>;
    searchCatalogLocal: (
      query: string,
      limit?: number,
    ) => Promise<
      Array<{
        codigo: string;
        denominacion: string;
        grupo: string | null;
        clase: string | null;
        cuenta_codigo?: string | null;
        contabilidad?: string | null;
        depreciacion?: string | null;
        resolucion?: string | null;
        estado?: string | null;
        origen?: string | null;
      }>
    >;
    getCatalogByCodigo: (codigo: string) => Promise<{
      codigo: string;
      denominacion: string;
      grupo: string | null;
      clase: string | null;
      cuenta_codigo: string | null;
      contabilidad: string | null;
      depreciacion: string | null;
      resolucion: string | null;
      estado: string | null;
      origen: string;
    } | null>;
    getCatalogMeta: () => Promise<{ count: number; syncedAt: string | null }>;
    upsertCatalogRow: (row: {
      codigo: string;
      denominacion: string;
      grupo: string | null;
      clase: string | null;
      cuenta_codigo: string | null;
      contabilidad: string | null;
      depreciacion: string | null;
      resolucion: string | null;
      estado: string | null;
      origen: string;
    }) => Promise<void>;
    deleteCatalogRow: (codigo: string) => Promise<void>;
    listCatalogoMenajeLocal: () => Promise<
      Array<{
        codigo: string;
        denominacion: string;
        grupo: string | null;
        clase: string | null;
        cuenta_codigo: string | null;
        contabilidad: string | null;
        depreciacion: string | null;
        resolucion: string | null;
        estado: string | null;
        origen: string;
      }>
    >;
    listCatalogoPropioLocal: () => Promise<
      Array<{
        codigo: string;
        denominacion: string;
        grupo: string | null;
        clase: string | null;
        cuenta_codigo: string | null;
        contabilidad: string | null;
        depreciacion: string | null;
        resolucion: string | null;
        estado: string | null;
        origen: string;
      }>
    >;
    syncAtributoVocab: (
      rows: unknown[],
    ) => Promise<{ count: number; syncedAt: string | null }>;
    searchAtributoVocabLocal: (
      campo: string,
      query: string,
      limit?: number,
    ) => Promise<string[]>;
    upsertAtributoVocabLocal: (campo: string, valor: string) => Promise<void>;
    getAtributoVocabMeta: () => Promise<{ count: number; syncedAt: string | null }>;
    offlineEnqueue: (item: unknown) => Promise<unknown>;
    offlineQueue: () => Promise<unknown[]>;
    offlineQueueCount: () => Promise<number>;
    offlineRemove: (id: string) => Promise<void>;
    offlineSetError: (id: string, error: string) => Promise<void>;
    offlineCacheReplace: (entidadId: string, items: unknown[]) => Promise<number>;
    offlineCacheFind: (entidadId: string, codigo: string) => Promise<unknown | null>;
    offlineCacheUpsert: (entidadId: string, activo: unknown) => Promise<void>;
    offlineCacheRemove: (entidadId: string, activoId: string) => Promise<boolean>;
    offlineCacheMeta: (entidadId: string) => Promise<{ count: number; updatedAt: string | null }>;
    offlineCacheList: (entidadId: string) => Promise<unknown[]>;
    offlineMasterReplace: (
      domain: string,
      entidadId: string,
      items: unknown[],
    ) => Promise<number>;
    offlineMasterList: (domain: string, entidadId?: string) => Promise<unknown[]>;
    offlineMasterUpsert: (domain: string, entidadId: string, item: unknown) => Promise<void>;
    offlineMasterRemove: (domain: string, entidadId: string, id: string) => Promise<void>;
    offlineMasterMeta: (
      domain: string,
      entidadId?: string,
    ) => Promise<{ count: number; updatedAt: string | null }>;
    offlineMasterFind: (
      domain: string,
      id: string,
    ) => Promise<{ entidadId: string; data: unknown } | null>;
    printBuildZpl: (options: {
      entidadNombre: string;
      codigoBarras: string;
      nombreBien: string;
      fechaAdquisicion?: string | null;
    }) => Promise<string>;
    printSaveDialog: (zpl: string) => Promise<{ saved: boolean; path?: string; error?: string }>;
    printSend: (zpl: string, printerName?: string) => Promise<{ ok: boolean; message: string }>;
    printListPrinters: () => Promise<
      Array<{ name: string; status: string; isDefault: boolean }>
    >;
    inviteEntidadAdmin: (input: {
      entidadId: string;
      email: string;
      nombre: string;
      entidadNombre?: string;
      mode?: "invite" | "resend";
    }) => Promise<{
      success?: boolean;
      invited?: boolean;
      resent?: boolean;
      message?: string;
      warning?: string;
      error?: string;
    }>;
    inviteContador: (input: {
      email: string;
      nombre: string;
      mode?: "invite" | "resend";
    }) => Promise<{
      success?: boolean;
      invited?: boolean;
      resent?: boolean;
      message?: string;
      warning?: string;
      error?: string;
    }>;
    resendInvitacionUsuario: (input: {
      email: string;
      nombre: string;
      rol: "CONTADOR" | "ADMIN_ENTIDAD";
      entidadId?: string | null;
      entidadNombre?: string | null;
    }) => Promise<{
      success?: boolean;
      invited?: boolean;
      resent?: boolean;
      message?: string;
      warning?: string;
      error?: string;
    }>;
    getUsuariosAccesoEstado: (emails: string[]) => Promise<
      Record<string, "confirmado" | "pendiente" | "sin_cuenta" | "desconocido">
    >;
    deleteAuthUser: (userId: string) => Promise<{ error?: string }>;
    mediaExists: (bucket: string, storagePath: string) => Promise<boolean>;
    mediaPut: (bucket: string, storagePath: string, bytes: Uint8Array) => Promise<boolean>;
  };
}
