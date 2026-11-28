import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let ventana: BrowserWindow | null = null;
let proceso: ChildProcess | null = null;

function raizDelRepo(): string {
  const marcada = process.env.BAJADA_REPO;
  if (marcada && fs.existsSync(path.join(marcada, "pnpm-workspace.yaml"))) return marcada;
  let dir = path.resolve(__dirname, "..");
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const padre = path.dirname(dir);
    if (padre === dir) break;
    dir = padre;
  }
  throw new Error("No encontré la carpeta del proyecto. Abre Bajada SUNAT desde el repositorio.");
}

function archivoInicio(): string {
  return path.join(app.getPath("userData"), "inicio.json");
}

function quiereInicio(): boolean {
  try {
    const dato = JSON.parse(fs.readFileSync(archivoInicio(), "utf8")) as { abrir?: boolean };
    return dato.abrir !== false;
  } catch {
    return true;
  }
}

function aplicarInicio(abrir: boolean): void {
  fs.mkdirSync(path.dirname(archivoInicio()), { recursive: true });
  fs.writeFileSync(archivoInicio(), JSON.stringify({ abrir }), "utf8");
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: abrir });
    return;
  }
  app.setLoginItemSettings({
    openAtLogin: abrir,
    path: process.execPath,
    args: [path.resolve(app.getAppPath())],
  });
}

function leerEnvEmpaquetado(): Record<string, string> {
  const archivo = path.join(app.getAppPath(), "embebido.env");
  if (!fs.existsSync(archivo)) return {};
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

function enviar(canal: "linea" | "estado", valor: string): void {
  if (ventana && !ventana.isDestroyed()) ventana.webContents.send(canal, valor);
}

function detenerEscucha(): void {
  const pid = proceso?.pid;
  if (!pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { shell: true, windowsHide: true });
  } else {
    proceso?.kill();
  }
  proceso = null;
}

function arrancarEscucha(): void {
  if (proceso) return;
  enviar("estado", "escuchando");
  enviar("linea", "Busco pedidos de XML. Deja esta ventana abierta.");
  let hijo: ChildProcess;
  if (app.isPackaged) {
    const env: NodeJS.ProcessEnv = { ...process.env, ...leerEnvEmpaquetado() };
    env.NEXT_PUBLIC_PORTAL_ORIGIN = "https://www.bdconsultores.org";
    env.SUNAT_SESION_FILE = path.join(app.getPath("userData"), "sunat-session.json");
    env.PLAYWRIGHT_BROWSERS_PATH = path.join(process.resourcesPath, "browsers");
    env.BAJADA_PLAYWRIGHT = path.join(process.resourcesPath, "node_modules", "playwright");
    env.BAJADA_CHROMIUM = path.join(
      process.resourcesPath,
      "browsers",
      "chromium-1255",
      "chrome-win64",
      "chrome.exe",
    );
    env.BAJADA_BAJAR = path.join(process.resourcesPath, "bundle", "bajar.cjs");
    env.ELECTRON_RUN_AS_NODE = "1";
    const script = path.join(process.resourcesPath, "bundle", "escuchar.cjs");
    hijo = spawn(process.execPath, [script], { env, windowsHide: true });
  } else {
    let raiz: string;
    try {
      raiz = raizDelRepo();
    } catch (error) {
      enviar("estado", "detenido");
      enviar("linea", error instanceof Error ? error.message : "No encontré el proyecto.");
      return;
    }
    hijo = spawn("pnpm", ["sunat:escuchar"], {
      cwd: raiz,
      shell: true,
      env: process.env,
      windowsHide: true,
    });
  }
  proceso = hijo;
  const escribir = (trozo: Buffer) => {
    for (const linea of trozo.toString("utf8").split(/\r?\n/)) {
      const limpia = linea.trim();
      if (!limpia) continue;
      if (/^bajando\s/i.test(limpia)) enviar("estado", "bajando");
      if (/pedido listo/i.test(limpia)) enviar("estado", "escuchando");
      if (/pedido con error/i.test(limpia)) enviar("estado", "error");
      enviar("linea", limpia);
    }
  };
  hijo.stdout?.on("data", escribir);
  hijo.stderr?.on("data", escribir);
  hijo.on("exit", (codigo) => {
    if (proceso === hijo) proceso = null;
    enviar("estado", "detenido");
    enviar("linea", codigo === 0 ? "El programa se detuvo." : `El programa se detuvo (código ${codigo ?? 1}).`);
  });
}

function crearVentana(): void {
  ventana = new BrowserWindow({
    width: 720,
    height: 560,
    minWidth: 560,
    minHeight: 420,
    title: "Bajada SUNAT",
    backgroundColor: "#f4f1ea",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  void ventana.loadFile(path.join(__dirname, "../index.html"));
  ventana.on("close", (evento) => {
    if (!proceso) return;
    evento.preventDefault();
    const respuesta = dialog.showMessageBoxSync(ventana!, {
      type: "question",
      buttons: ["Seguir abierto", "Cerrar"],
      defaultId: 0,
      cancelId: 0,
      title: "Bajada SUNAT",
      message: "Si cierras esta ventana, Planillas no podrá bajar el XML.",
    });
    if (respuesta === 1) {
      detenerEscucha();
      ventana?.destroy();
    }
  });
}

const unica = app.requestSingleInstanceLock();
if (!unica) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!ventana) return;
    if (ventana.isMinimized()) ventana.restore();
    ventana.focus();
  });
  app.whenReady().then(() => {
    aplicarInicio(quiereInicio());
    ipcMain.handle("inicio:leer", () => quiereInicio());
    ipcMain.handle("inicio:fijar", (_evento, abrir: boolean) => {
      aplicarInicio(Boolean(abrir));
      return quiereInicio();
    });
    crearVentana();
    arrancarEscucha();
  });
  app.on("window-all-closed", () => {
    if (proceso) detenerEscucha();
    app.quit();
  });
}
