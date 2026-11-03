// App anfitriona mínima para la prueba de humo (scripts/e2e-python.ts): monta <LabsRoutes python />
// desde la entrada de la biblioteca, con una ranura en la banda del borrador que escribe archivos de
// prueba con writeFiles. No se publica: la construye la prueba en dist/host/.
import "../../src/zod-config.ts";
import "katex/dist/katex.min.css";
import "../../src/styles/tokens.css";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { configureLabs, createDraft, LabsRoutes, PYODIDE_VERSION, type DraftActionsContext } from "../../src/embed/index.ts";

const enc = (text: string) => new TextEncoder().encode(text).buffer;

function DemoSlot({ files }: DraftActionsContext) {
  const [status, setStatus] = useState("");
  async function load() {
    const r = await files.writeFiles([
      { path: "res/data.csv", data: enc("x,y\n1,2\n3,4\n") },
      { path: "res/programa.py", data: enc("print('hola desde res/programa.py')\n") },
      { path: "img/demo/vacio.bin", data: new Uint8Array(1024) },
      { path: "../fuera.txt", data: enc("no") },
    ]);
    setStatus(`${r.written.length} escritos, ${r.skipped.length} descartados`);
  }
  return (
    <>
      <button type="button" onClick={() => void load()}>
        Cargar los archivos de prueba (res/, img/)
      </button>
      {status && <span role="status">{status}</span>}
    </>
  );
}

configureLabs({
  python: { assetBaseUrl: `/pyodide/${PYODIDE_VERSION}/`, maxTotalBytes: 120 * 1024 * 1024, renderDraftActions: (ctx) => <DemoSlot {...ctx} /> },
});

const id = createDraft({
  origin: { kind: "file", fileName: "e2e.py", source: { kind: "repo", path: "e2e/e2e.py" } },
  code: "print('borrador del anfitrión')",
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/host">
      <Routes>
        <Route path="/laboratorios/*" element={<LabsRoutes python />} />
        <Route path="*" element={<Navigate to={`/laboratorios/python?borrador=${id}`} replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
