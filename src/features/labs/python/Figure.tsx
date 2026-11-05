// Gráfico de matplotlib (PNG en base64, como lo devuelve el worker) dibujado en un canvas: la CSP del
// sitio no deja usar data: ni blob: en <img>. Lo usan la pestaña Python y los ejercicios con gráficos.
import { Download } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "../../../components/ui/button.tsx";

export function base64ToBlob(b64: string, type = "image/png"): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Descarga un Blob con un enlace temporal (la CSP no permite blob: en img-src, pero sí descargarlo). */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** `label`: el nombre accesible del canvas (por defecto, «Gráfico n de la ejecución»). */
export function Figure({ b64, n, label }: { b64: string; n: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || typeof createImageBitmap !== "function") return;
    let cancelled = false;
    createImageBitmap(base64ToBlob(b64))
      .then((bmp) => {
        if (cancelled) return;
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        canvas.getContext("2d")?.drawImage(bmp, 0, 0);
        bmp.close();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [b64]);
  return (
    <figure className="flex flex-col items-start gap-2">
      <div className="rounded-md border border-border bg-[#ffffff] p-2">
        <canvas ref={ref} role="img" aria-label={label ?? `Gráfico ${n} de la ejecución`} className="block h-auto max-w-full" />
      </div>
      <Button variant="secondary" onClick={() => saveBlob(base64ToBlob(b64), `grafico-${n}.png`)}>
        <Download size={16} strokeWidth={1.75} aria-hidden="true" />
        Descargar PNG
      </Button>
    </figure>
  );
}
