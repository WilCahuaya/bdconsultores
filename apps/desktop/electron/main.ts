import { app, BrowserWindow, ipcMain, Menu, session } from "electron";
import fs from "fs";
import path from "path";
import { ensureOAuthCallbackServer } from "./auth/callback-server";
import { registerAuthIpcHandlers } from "./auth/ipc";
import {
  attachProtocolListeners,
  getProtocolUrlFromArgv,
  handleProtocolAuthUrl,
  registerAuthProtocol,
} from "./auth/protocol";
import { openSystemBrowser } from "./auth/open-browser";
import { loadDesktopEnvFiles } from "./env";
import { inviteContador, inviteEntidadAdmin, resendInvitacionUsuario } from "./invite";
import { getUsuariosAccesoEstado } from "./users-auth-status";
import { deleteAuthUser } from "./users-admin";
import {
  getAtributoVocabMeta,
  initAtributoVocabSchema,
  replaceAtributoVocab,
  searchAtributoVocab,
  upsertAtributoVocabLocal,
  type AtributoVocabRow,
} from "./database/atributo-vocab";
import {
  deleteCatalogRow,
  getCatalogByCodigo,
  getCatalogMeta,
  initCatalogDatabase,
  listCatalogoPropioLocal,
  replaceCatalog,
  searchCatalog,
  upsertCatalogRow,
  type CatalogoRow,
} from "./database/catalogo";
import {
  cacheMeta,
  enqueueSyncItem,
  findCachedActivo,
  findMasterCacheById,
  listCachedActivos,
  listMasterCache,
  listSyncQueue,
  masterCacheMeta,
  removeCachedActivo,
  removeMasterCacheItem,
  removeSyncItem,
  replaceActivosCache,
  replaceMasterCache,
  setSyncItemError,
  syncQueueCount,
  upsertCachedActivo,
  upsertMasterCacheItem,
  type MasterCacheDomain,
} from "./database/offline";
import { buildLabelZpl, listSystemPrinters, saveZplDialog, sendZplToPrinter } from "./print";

let mainWindow: BrowserWindow | null = null;

function getDistPath(): string {
  return path.join(__dirname, "../../dist");
}

function resolvePreloadPath(): string {
  const candidates = [
    path.join(__dirname, "preload.js"),
    path.join(app.getAppPath(), "dist-electron", "electron", "preload.js"),
    path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "dist-electron",
      "electron",
      "preload.js",
    ),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.info("[app] Preload:", candidate);
      return candidate;
    }
  }

  console.error("[app] preload.js no encontrado:", candidates);
  return candidates[0];
}

function isAllowedAppNavigation(targetUrl: string): boolean {
  if (!targetUrl) return true;
  if (targetUrl.startsWith("file://")) return true;

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl && targetUrl.startsWith(devUrl)) return true;

  return (
    targetUrl.startsWith("http://127.0.0.1:5173") ||
    targetUrl.startsWith("http://localhost:5173")
  );
}

function loadMainWindowContent(win: BrowserWindow): void {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
    return;
  }
  void win.loadFile(path.join(getDistPath(), "index.html"));
}

function attachSessionNavigationGuards(): void {
  const appSession = session.fromPartition("persist:inventario");

  appSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*"] },
    (details, callback) => {
      if (details.resourceType !== "mainFrame") {
        callback({});
        return;
      }
      if (isAllowedAppNavigation(details.url)) {
        callback({});
        return;
      }

      console.warn("[auth] Cancelada carga HTTP en ventana principal:", details.url);
      callback({ cancel: true });
    },
  );
}

function attachMainWindowNavigationGuards(win: BrowserWindow): void {
  const blockExternalNavigation = (event: Electron.Event, url: string) => {
    if (isAllowedAppNavigation(url)) return;

    event.preventDefault();
    console.warn("[auth] Bloqueada navegación en ventana principal:", url);
  };

  win.webContents.on("will-navigate", blockExternalNavigation);
  win.webContents.on("will-redirect", blockExternalNavigation);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      void openSystemBrowser(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("did-navigate", (_event, url) => {
    if (isAllowedAppNavigation(url)) return;
    console.warn("[auth] Recuperando ventana principal tras navegación a", url);
    loadMainWindowContent(win);
  });
}

function createWindow(): void {
  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

  if (!process.env.VITE_DEV_SERVER_URL) {
    Menu.setApplicationMenu(null);
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "B&D Consultores — Inventario",
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: "persist:inventario",
    },
  });

  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("[app] Error al cargar preload:", preloadPath, error);
  });

  attachMainWindowNavigationGuards(mainWindow);

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(getDistPath(), "index.html"));
  }
}

registerAuthIpcHandlers(() => ({
  mainWindow,
  isAllowedAppNavigation,
  loadMainWindowContent,
  setOAuthInProgress: () => {},
}));

ipcMain.handle("catalog:replace", (_event, rows: CatalogoRow[]) => {
  return replaceCatalog(rows);
});

ipcMain.handle("catalog:search", (_event, query: string, limit?: number) => {
  return searchCatalog(query, limit);
});

ipcMain.handle("catalog:getByCodigo", (_event, codigo: string) => {
  return getCatalogByCodigo(codigo);
});

ipcMain.handle("catalog:meta", () => {
  return getCatalogMeta();
});

ipcMain.handle("catalog:upsert", (_event, row: CatalogoRow) => {
  upsertCatalogRow(row);
});

ipcMain.handle("catalog:delete", (_event, codigo: string) => {
  deleteCatalogRow(codigo);
});

ipcMain.handle("catalog:listPropio", () => {
  return listCatalogoPropioLocal();
});

ipcMain.handle("atributoVocab:replace", (_event, rows: AtributoVocabRow[]) => {
  return replaceAtributoVocab(rows);
});

ipcMain.handle(
  "atributoVocab:search",
  (_event, campo: string, query: string, limit?: number) => {
    return searchAtributoVocab(campo, query, limit);
  },
);

ipcMain.handle("atributoVocab:upsert", (_event, campo: string, valor: string) => {
  upsertAtributoVocabLocal(campo, valor);
});

ipcMain.handle("atributoVocab:meta", () => {
  return getAtributoVocabMeta();
});

ipcMain.handle("offline:enqueue", (_event, item) => enqueueSyncItem(item));
ipcMain.handle("offline:queue", () => listSyncQueue());
ipcMain.handle("offline:queueCount", () => syncQueueCount());
ipcMain.handle("offline:remove", (_event, id: string) => removeSyncItem(id));
ipcMain.handle("offline:setError", (_event, id: string, error: string) => setSyncItemError(id, error));
ipcMain.handle("offline:cacheReplace", (_event, entidadId: string, items: unknown[]) =>
  replaceActivosCache(entidadId, items),
);
ipcMain.handle("offline:cacheFind", (_event, entidadId: string, codigo: string) =>
  findCachedActivo(entidadId, codigo),
);
ipcMain.handle("offline:cacheUpsert", (_event, entidadId: string, activo: unknown) =>
  upsertCachedActivo(entidadId, activo),
);
ipcMain.handle("offline:cacheRemove", (_event, entidadId: string, activoId: string) =>
  removeCachedActivo(entidadId, activoId),
);
ipcMain.handle("offline:cacheMeta", (_event, entidadId: string) => cacheMeta(entidadId));
ipcMain.handle("offline:cacheList", (_event, entidadId: string) => listCachedActivos(entidadId));
ipcMain.handle(
  "offline:masterReplace",
  (_event, domain: MasterCacheDomain, entidadId: string, items: unknown[]) =>
    replaceMasterCache(domain, entidadId, items),
);
ipcMain.handle(
  "offline:masterList",
  (_event, domain: MasterCacheDomain, entidadId?: string) =>
    listMasterCache(domain, entidadId ?? ""),
);
ipcMain.handle(
  "offline:masterUpsert",
  (_event, domain: MasterCacheDomain, entidadId: string, item: unknown) =>
    upsertMasterCacheItem(domain, entidadId, item),
);
ipcMain.handle(
  "offline:masterRemove",
  (_event, domain: MasterCacheDomain, entidadId: string, id: string) =>
    removeMasterCacheItem(domain, entidadId, id),
);
ipcMain.handle(
  "offline:masterMeta",
  (_event, domain: MasterCacheDomain, entidadId?: string) =>
    masterCacheMeta(domain, entidadId ?? ""),
);
ipcMain.handle(
  "offline:masterFind",
  (_event, domain: MasterCacheDomain, id: string) => findMasterCacheById(domain, id),
);

ipcMain.handle("print:buildZpl", (_event, options) => buildLabelZpl(options));
ipcMain.handle("print:saveDialog", (event, zpl: string) => {
  const parent = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  return saveZplDialog(zpl, parent);
});
ipcMain.handle("print:send", (_event, zpl: string, printerName?: string) =>
  sendZplToPrinter(zpl, printerName),
);
ipcMain.handle("print:listPrinters", (event) => {
  const sender = BrowserWindow.fromWebContents(event.sender);
  const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
  if (sender && !windows.includes(sender)) {
    windows.unshift(sender);
  }
  if (mainWindow && !mainWindow.isDestroyed() && !windows.includes(mainWindow)) {
    windows.unshift(mainWindow);
  }
  return listSystemPrinters(windows);
});

ipcMain.handle("invite:entidadAdmin", (_event, input) => inviteEntidadAdmin(input));
ipcMain.handle("invite:contador", (_event, input) => inviteContador(input));
ipcMain.handle("users:resendInvitation", async (_event, input) => {
  try {
    return await resendInvitacionUsuario(input);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Error al reenviar la invitación.",
    };
  }
});
ipcMain.handle("users:accesoEstado", (_event, emails: string[]) =>
  getUsuariosAccesoEstado(emails),
);
ipcMain.handle("users:deleteAuth", (_event, userId: string) => deleteAuthUser(userId));

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const protocolUrl = getProtocolUrlFromArgv(argv);
    if (protocolUrl) handleProtocolAuthUrl(protocolUrl);
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

registerAuthProtocol();
attachProtocolListeners();

app.whenReady().then(() => {
  attachSessionNavigationGuards();
  void ensureOAuthCallbackServer().catch((err) => {
    console.error("[auth] No se pudo iniciar servidor OAuth local:", err);
  });
  loadDesktopEnvFiles();
  initCatalogDatabase();
  initAtributoVocabSchema();
  createWindow();

  const startupProtocolUrl = getProtocolUrlFromArgv(process.argv);
  if (startupProtocolUrl) handleProtocolAuthUrl(startupProtocolUrl);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
