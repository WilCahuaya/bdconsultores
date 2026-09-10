declare module "pdfjs-dist/build/pdf" {
  export const GlobalWorkerOptions: { workerSrc: string };
  export const version: string;
  export function getDocument(src: { data: Uint8Array }): {
    promise: Promise<{
      getPage: (page: number) => Promise<{
        getViewport: (opts: { scale: number }) => { width: number; height: number };
        render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => {
          promise: Promise<void>;
        };
      }>;
    }>;
  };
}
