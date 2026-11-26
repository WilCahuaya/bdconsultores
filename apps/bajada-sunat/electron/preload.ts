import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("bajada", {
  alIniciar: (): Promise<boolean> => ipcRenderer.invoke("inicio:leer"),
  fijarInicio: (abrir: boolean): Promise<boolean> => ipcRenderer.invoke("inicio:fijar", abrir),
  alLinea: (recibir: (linea: string) => void): (() => void) => {
    const oyente = (_evento: unknown, linea: string) => recibir(linea);
    ipcRenderer.on("linea", oyente);
    return () => ipcRenderer.removeListener("linea", oyente);
  },
  alEstado: (recibir: (estado: string) => void): (() => void) => {
    const oyente = (_evento: unknown, estado: string) => recibir(estado);
    ipcRenderer.on("estado", oyente);
    return () => ipcRenderer.removeListener("estado", oyente);
  },
});
