// Pestaña «Python»: editor, salida con gráficos, archivos y entrada para input(). Pyodide solo se pide
// desde aquí: el PyClient (y su worker) se crea al montar esta ruta perezosa, y la descarga empieza
// cuando se pulsa «Cargar Python» (o sola, si ya se cargó antes en este dispositivo).
// Integridad: solo se ejecuta el código del editor al pulsar «Ejecutar código» (o «Ejecutar paso a
// paso», que lo sigue línea a línea con el trazador de tracer.ts); un ?borrador= se abre en el
// editor y nunca se ejecuta solo. Lo que escribe el anfitrión (writeFiles en sus ranuras)
// solo va a la carpeta de trabajo, en memoria: escribir un archivo nunca lo ejecuta.
import {
  CircleCheck,
  CircleDashed,
  ClipboardCheck,
  Download,
  FileUp,
  Footprints,
  HardDriveDownload,
  Info,
  OctagonAlert,
  Play,
  RotateCcw,
  Square,
  Trash2,
  WifiOff,
} from "lucide-react";
import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router";
import { Button, buttonVariants } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.tsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip.tsx";
import { revealPanel, scrollIntoViewIfHidden } from "../../../lib/reveal.ts";
import { readLabItem, writeLabItem } from "../labs-storage.ts";
import { consumeFreshDraft, getDraft, listDrafts, updateDraftCode, type Draft, type DraftOrigin } from "./drafts.ts";
import { baseName, checkHostFile, checkUpload, fmtBytes, mimeFor, UPLOAD_ACCEPT, type FileInfo } from "./files.ts";
import { transformMagics } from "./magics.ts";
import { hintsFor } from "./messages.ts";
import { closureBytes, EXTRA_WHEELS } from "./packages.ts";
import { PYODIDE_CORE, PYODIDE_PACKAGES } from "./pyodide-manifest.ts";
import { createPyWorker, PyClient, type PyEvent, type RunOutcome } from "./py-client.ts";
import {
  fileLimits,
  isolationAvailable,
  pyodideBaseUrl,
  pythonSlots,
  type FileLimits,
  type PythonFilesApi,
  type PythonLabConfig,
  type SkippedFile,
  type WriteFilesResult,
} from "./python-config.ts";
import { Figure, saveBlob } from "./Figure.tsx";
import { templateById, TEMPLATES, type TemplateId } from "./templates.ts";
import { runTrace, TraceView, type TraceOutcome } from "./Tracer.tsx";

const LIMITS = [10, 30, 60, 120] as const;
const DEFAULT_LIMIT = 30;

const COPY_LOAD_ERROR =
  "No se pudo cargar Python. Comprueba la conexión y vuelve a intentarlo. Si el problema sigue, puede que este sitio se haya publicado sin los archivos de Python.";
const COPY_STOPPED = "Ejecución detenida por ti.";
const COPY_RESTARTED = "Python se ha reiniciado; las variables anteriores se han perdido.";
const COPY_EMPTY = "La salida y los gráficos aparecerán aquí al ejecutar el código.";
const DRAFT_VALUE = "borrador:";
const copyDraftBand = (title: string, n: number) =>
  `Borrador de ${title}, celda ${n}. Las celdas anteriores no se han ejecutado: si este código usa variables de otras celdas, ábrelas también.`;
const copyDraftNotice = (o: DraftOrigin) =>
  o.kind === "cell"
    ? `Celda ${o.cell} abierta como borrador nuevo. El cuaderno no cambia`
    : "Archivo abierto como borrador nuevo";
const copyTimeout = (s: number) =>
  `La ejecución superó ${s} s y se detuvo. Si necesitas más tiempo, cambia el límite en «Límite de ejecución».`;

/** Lo que baja «Cargar Python»: el núcleo (con el lock) y numpy. pyodide.mjs va dentro del worker. */
const FIRST_FILES = [...PYODIDE_CORE.map((f) => f.file), ...PYODIDE_PACKAGES.filter((p) => p.name === "numpy").map((p) => p.file)];
const FIRST_BYTES =
  PYODIDE_CORE.reduce((s, f) => s + f.size, 0) + PYODIDE_PACKAGES.filter((p) => p.name === "numpy").reduce((s, p) => s + p.size, 0);
const AFTER_NUMPY = new Set(["numpy"]);
/** Bytes que baja el primer import de un paquete (sin numpy, que ya está); 0 si no se sabe. */
const packageBytes = (name: string) =>
  closureBytes(PYODIDE_PACKAGES, [name], AFTER_NUMPY) || (EXTRA_WHEELS.find((w) => w.name === name)?.size ?? 0);

/**
 * Ranuras del anfitrión; si se pasan, mandan sobre las de configureLabs({ python }). `examPath`: ruta
 * del simulacro de 01MIAR, relativa a esta página (por defecto «simulacro», como en LabsRoutes); con
 * null no se enseña el botón.
 */
export type PythonLabPageProps = Pick<PythonLabConfig, "renderDraftActions" | "renderFilesActions"> & { examPath?: string | null };

const byPath = (a: FileInfo, b: FileInfo) => a.name.localeCompare(b.name, "es");

/** Los bytes que pasa el anfitrión, copiados (así puede reutilizar o transferir los suyos). */
function copyBytes(data: unknown): ArrayBuffer | null {
  if (Object.prototype.toString.call(data) === "[object ArrayBuffer]") return (data as ArrayBuffer).slice(0);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice().buffer;
  return null;
}

/** Un fallo en la ranura del anfitrión no tumba la pestaña: la ranura desaparece. */
class SlotBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Llama a la ranura dentro de su propio componente, para que SlotBoundary recoja sus errores. */
function HostSlot({ render }: { render: () => ReactNode }) {
  return <>{render()}</>;
}

/** Un límite para el texto de «Archivos»: «20 MB» si es un número redondo de MB. */
const fmtLimit = (n: number) => (n % (1024 * 1024) === 0 ? `${n / (1024 * 1024)} MB` : fmtBytes(n));

export const fmtMB = (bytes: number) => `${(bytes / 1_000_000).toFixed(1).replace(".", ",")} MB`;

type Phase =
  | { k: "idle" }
  | { k: "download"; done: number; total: number }
  | { k: "preparing" }
  | { k: "ready" }
  | { k: "offline" }
  | { k: "error" };

type OutItem =
  | { k: "stdout" | "stderr" | "info"; text: string }
  | { k: "hint"; text: string }
  | { k: "error"; line: number | null; text: string }
  | { k: "crit"; text: string }
  | { k: "fig"; b64: string; n: number };

/** Lo que la pestaña guarda en el almacén de los laboratorios (clave "python"). */
type Prefs = { template: TemplateId; codes: Partial<Record<TemplateId, string>>; limit: number; loaded: boolean; stdin: string };

function readPrefs(): Prefs {
  const fallback: Prefs = { template: "blank", codes: {}, limit: DEFAULT_LIMIT, loaded: false, stdin: "" };
  try {
    const raw = readLabItem("python");
    if (!raw) return fallback;
    const v = JSON.parse(raw) as Record<string, unknown>;
    const codes: Prefs["codes"] = {};
    if (v.codes && typeof v.codes === "object") {
      for (const [id, code] of Object.entries(v.codes as Record<string, unknown>)) {
        if (templateById(id) && typeof code === "string") codes[id as TemplateId] = code;
      }
    }
    return {
      template: typeof v.template === "string" && templateById(v.template) ? (v.template as TemplateId) : "blank",
      codes,
      limit: (LIMITS as readonly number[]).includes(v.limit as number) ? (v.limit as number) : DEFAULT_LIMIT,
      loaded: v.loaded === true,
      stdin: typeof v.stdin === "string" ? v.stdin : "",
    };
  } catch {
    return fallback;
  }
}

const seconds = (ms: number) => (ms / 1000).toFixed(1).replace(".", ",");
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/** Las líneas de «Entrada para input()», sin la vacía que deja un salto final. */
export function stdinLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/**
 * Descarga el núcleo de Pyodide y numpy con progreso. Quedan en la caché HTTP del navegador (el sitio
 * los sirve con caché larga), así que el worker los encuentra ahí al arrancar.
 */
export async function prefetchPyodide(opts: {
  baseUrl: string;
  signal: AbortSignal;
  onProgress: (done: number, total: number) => void;
}): Promise<void> {
  let done = 0;
  const total = FIRST_BYTES;
  for (const file of FIRST_FILES) {
    const res = await fetch(new URL(file, opts.baseUrl), { signal: opts.signal });
    if (!res.ok || !res.body) throw new Error(`${file}: ${res.status}`);
    const reader = res.body.getReader();
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      done += value.byteLength;
      opts.onProgress(Math.min(done, total), total);
    }
  }
}

export function PythonLabPage(props: PythonLabPageProps = {}) {
  const examPath = props.examPath === undefined ? "simulacro" : props.examPath;
  const [prefs] = useState(readPrefs);
  const prefsRef = useRef<Prefs>(prefs);
  const [phase, setPhase] = useState<Phase>(() => (prefs.loaded ? { k: "preparing" } : { k: "idle" }));
  const [versions, setVersions] = useState<{ python: string; numpy?: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const borradorParam = searchParams.get("borrador");
  const [templateId, setTemplateId] = useState<TemplateId>(prefs.template);
  // «Abrir en Python»: ?borrador={id} elige un borrador de este dispositivo; un id desconocido deja la última plantilla.
  const [drafts, setDrafts] = useState<Draft[]>(listDrafts);
  const [draftId, setDraftId] = useState<string | null>(() => (borradorParam && getDraft(borradorParam) ? borradorParam : null));
  const [code, setCode] = useState(() => {
    const d = borradorParam ? getDraft(borradorParam) : null;
    return d ? d.code : (prefs.codes[prefs.template] ?? templateById(prefs.template)!.code);
  });
  const [limit, setLimit] = useState(prefs.limit);
  const [stdin, setStdin] = useState(prefs.stdin);
  const [out, setOut] = useState<OutItem[]>([]);
  const [files, setFilesState] = useState<FileInfo[]>([]);
  const filesRef = useRef<FileInfo[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [runningSince, setRunningSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pkg, setPkg] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [dlAnnounce, setDlAnnounce] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // Último paso a paso, con el código que se trazó (si el editor cambia, deja de mostrarse).
  const [traced, setTraced] = useState<{ code: string; outcome: TraceOutcome } | null>(null);
  // El paso a paso y la salida pueden abrirse por debajo de la pantalla (iPad en horizontal, móvil):
  // al pulsar el botón se llevan a la vista; el paso a paso además recibe el foco en su título.
  const traceRef = useRef<HTMLDivElement | null>(null);
  const outputRef2 = useRef<HTMLDivElement | null>(null);
  const revealTrace = useRef(false);
  useEffect(() => {
    if (!traced || !revealTrace.current) return;
    revealTrace.current = false;
    revealPanel(traceRef.current, traceRef.current?.querySelector<HTMLElement>("h2, [role=alert]"));
  }, [traced]);

  const clientRef = useRef<PyClient | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const caretRef = useRef<number | null>(null);
  const escRef = useRef(false);
  const halfRef = useRef(false);
  const outputRef = useRef("");

  /** La lista «Archivos», ordenada; también para files.list() de las ranuras. */
  const setFiles = useCallback((list: FileInfo[]) => {
    const sorted = [...list].sort(byPath);
    filesRef.current = sorted;
    setFilesState(sorted);
  }, []);

  // API de archivos para las ranuras del anfitrión. Estable mientras la pestaña está montada.
  const filesApi = useMemo<PythonFilesApi>(() => {
    const limits: FileLimits = fileLimits();
    return {
      limits,
      list: () => [...filesRef.current],
      async writeFiles(input) {
        const client = clientRef.current;
        const written: FileInfo[] = [];
        const skipped: SkippedFile[] = [];
        let list = filesRef.current;
        for (const f of Array.isArray(input) ? input : []) {
          const path = typeof f?.path === "string" ? f.path : String(f?.path);
          const data = copyBytes(f?.data);
          if (!client || !data) {
            skipped.push({ path, reason: "name", message: `«${path.slice(0, 80)}» no tiene contenido que escribir.` });
            continue;
          }
          const check = checkHostFile(client.uploadedFiles(), { path: f.path, size: data.byteLength }, limits);
          if (!check.ok) {
            skipped.push({ path, reason: check.reason, message: check.message });
            continue;
          }
          client.upload(check.name, data);
          written.push({ name: check.name, size: data.byteLength });
          list = [...list.filter((x) => x.name !== check.name), { name: check.name, size: data.byteLength }];
        }
        if (aliveRef.current && written.length > 0) setFiles(list);
        return { written, skipped } satisfies WriteFilesResult;
      },
    };
  }, [setFiles]);

  const configured = pythonSlots();
  const renderDraftActions = props.renderDraftActions ?? configured.renderDraftActions;
  const renderFilesActions = props.renderFilesActions ?? configured.renderFilesActions;

  const template = templateById(templateId)!;
  const draft = draftId ? (drafts.find((d) => d.id === draftId) ?? null) : null;
  const ready = phase.k === "ready";
  const running = runningSince !== null;

  const savePrefs = (patch: Partial<Prefs>) => {
    prefsRef.current = { ...prefsRef.current, ...patch };
    writeLabItem("python", JSON.stringify(prefsRef.current));
  };

  const onLoadEvent = useCallback((e: PyEvent) => {
    if (e.type === "ready") setVersions({ python: e.python, numpy: e.numpy });
  }, []);

  const startClient = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    setPhase({ k: "preparing" });
    try {
      await client.load(onLoadEvent);
      if (!aliveRef.current) return;
      prefsRef.current = { ...prefsRef.current, loaded: true };
      writeLabItem("python", JSON.stringify(prefsRef.current));
      setPhase({ k: "ready" });
    } catch {
      if (aliveRef.current) setPhase({ k: isOffline() ? "offline" : "error" });
    }
  }, [onLoadEvent]);

  useEffect(() => {
    aliveRef.current = true;
    clientRef.current = new PyClient({ createWorker: createPyWorker, isolated: isolationAvailable(), indexURL: pyodideBaseUrl() });
    if (prefsRef.current.loaded) void startClient();
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, [startClient]);

  // Un borrador abierto desde un cuaderno o un .py: se elige y se avisa una vez (fresh). Nunca se ejecuta.
  useEffect(() => {
    if (!borradorParam) return;
    const d = getDraft(borradorParam);
    if (!d) return;
    setDrafts(listDrafts());
    setDraftId(d.id);
    setCode(d.code);
    const origin = consumeFreshDraft(d.id);
    if (origin) setNotice(copyDraftNotice(origin));
  }, [borradorParam]);

  // Reloj de «Ejecutando… mm:ss».
  useEffect(() => {
    if (runningSince === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [runningSince]);

  async function loadPython() {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    halfRef.current = false;
    setDlAnnounce("");
    setPhase({ k: "download", done: 0, total: FIRST_BYTES });
    try {
      await prefetchPyodide({
        baseUrl: pyodideBaseUrl(),
        signal: ctrl.signal,
        onProgress: (done, total) => {
          if (!aliveRef.current) return;
          setPhase({ k: "download", done, total });
          if (!halfRef.current && done >= total / 2) {
            halfRef.current = true;
            setDlAnnounce("Descarga de Python al 50 %");
          }
        },
      });
      if (!aliveRef.current) return;
      setDlAnnounce("Descarga de Python terminada");
      await startClient();
    } catch {
      if (!aliveRef.current) return;
      if (ctrl.signal.aborted) setPhase({ k: "idle" });
      else setPhase({ k: isOffline() ? "offline" : "error" });
    }
  }

  function retry() {
    const old = clientRef.current;
    const uploads = old?.uploadsSnapshot() ?? [];
    old?.dispose();
    const client = new PyClient({ createWorker: createPyWorker, isolated: isolationAvailable(), indexURL: pyodideBaseUrl() });
    for (const [name, data] of uploads) client.upload(name, data);
    clientRef.current = client;
    if (prefsRef.current.loaded) void startClient();
    else void loadPython();
  }

  function append(item: OutItem) {
    if (item.k === "stdout" || item.k === "stderr") outputRef.current += item.text;
    setOut((prev) => {
      const last = prev[prev.length - 1];
      if (last && (item.k === "stdout" || item.k === "stderr") && last.k === item.k) {
        return [...prev.slice(0, -1), { k: item.k, text: last.text + item.text }];
      }
      return [...prev, item];
    });
  }

  function onRunEvent(e: PyEvent) {
    if (e.type === "stdout" || e.type === "stderr") append({ k: e.type, text: e.text });
    else if (e.type === "package") {
      const bytes = packageBytes(e.name);
      if (e.phase === "start") {
        setPkg(e.name);
        // Por debajo de 0,1 MB el tamaño no dice nada («0,0 MB»): solo el nombre.
        append({ k: "info", text: bytes >= 50_000 ? `Cargando ${e.name} (${fmtMB(bytes)})…` : `Cargando ${e.name}…` });
      } else {
        setPkg(null);
        append({ k: "info", text: `${e.name} listo` });
      }
    }
  }

  function showOutcome(o: RunOutcome) {
    switch (o.kind) {
      case "done":
        o.figures.forEach((b64, i) => append({ k: "fig", b64, n: i + 1 }));
        for (const text of hintsFor({ output: outputRef.current })) append({ k: "hint", text });
        setFiles(o.files);
        setLastMs(o.ms);
        setAnnounce(`Ejecución terminada en ${seconds(o.ms)} s`);
        return;
      case "error":
        for (const text of hintsFor({ error: o.message, output: outputRef.current })) append({ k: "hint", text });
        append({ k: "error", line: o.line, text: o.message });
        if (o.files) setFiles(o.files);
        setLastMs(o.ms);
        setAnnounce(o.line !== null ? `Ejecución con error en la línea ${o.line}` : "Ejecución con error");
        return;
      case "stopped":
        append({ k: "info", text: COPY_STOPPED });
        if (o.restarted) {
          append({ k: "info", text: COPY_RESTARTED });
          setFiles(clientRef.current?.uploadedFiles() ?? []);
        }
        setAnnounce("Ejecución detenida");
        return;
      case "timeout":
        append({ k: "crit", text: copyTimeout(o.seconds) });
        setFiles(clientRef.current?.uploadedFiles() ?? []);
        setAnnounce(`Ejecución detenida al superar ${o.seconds} s`);
        return;
    }
  }

  async function runCode() {
    const client = clientRef.current;
    if (!client || !ready || running) return;
    setOut([]);
    outputRef.current = "";
    setLastMs(null);
    setAnnounce("");
    scrollIntoViewIfHidden(outputRef2.current);
    const magics = transformMagics(code);
    if (!magics.ok) {
      append({ k: "error", line: magics.line, text: magics.message });
      setAnnounce(`Ejecución con error en la línea ${magics.line}`);
      return;
    }
    const started = Date.now();
    setNow(started);
    setRunningSince(started);
    try {
      const outcome = await client.run(magics.code, limit * 1000, onRunEvent, stdinLines(stdin));
      if (aliveRef.current) showOutcome(outcome);
    } catch (e) {
      if (aliveRef.current) append({ k: "error", line: null, text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (aliveRef.current) {
        setRunningSince(null);
        setPkg(null);
      }
    }
  }

  async function traceCode() {
    const client = clientRef.current;
    if (!client || !ready || running) return;
    setAnnounce("");
    const magics = transformMagics(code);
    revealTrace.current = true;
    if (!magics.ok || magics.code !== code) {
      setTraced({ code, outcome: { ok: false, message: "El paso a paso no admite órdenes mágicas (%time, %timeit…): quítalas para seguir el código." } });
      return;
    }
    const started = Date.now();
    setNow(started);
    setRunningSince(started);
    try {
      const outcome = await runTrace(client, code, stdinLines(stdin));
      if (!aliveRef.current) return;
      setTraced({ code, outcome });
      setAnnounce(outcome.ok ? `Paso a paso listo: ${outcome.trace.pasos.length} pasos` : "No se ha podido hacer el paso a paso");
      if (!outcome.ok) setFiles(client.uploadedFiles());
    } finally {
      if (aliveRef.current) {
        setRunningSince(null);
        setPkg(null);
      }
    }
  }

  function stopRun() {
    void clientRef.current?.stop();
  }

  function changeCode(next: string) {
    setCode(next);
    if (draftId) {
      updateDraftCode(draftId, next);
      return;
    }
    const codes = { ...prefsRef.current.codes };
    if (next === template.code) delete codes[templateId];
    else codes[templateId] = next;
    savePrefs({ codes });
  }

  function changeTemplate(value: string) {
    if (value.startsWith(DRAFT_VALUE)) {
      const d = getDraft(value.slice(DRAFT_VALUE.length));
      if (!d) return;
      setDraftId(d.id);
      setCode(d.code);
      setSearchParams({ borrador: d.id }, { replace: true });
      return;
    }
    const t = templateById(value);
    if (!t) return;
    if (draftId) {
      setDraftId(null);
      setNotice(null);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("borrador");
          return next;
        },
        { replace: true },
      );
    }
    setTemplateId(t.id);
    savePrefs({ template: t.id });
    setCode(prefsRef.current.codes[t.id] ?? t.code);
  }

  function resetTemplate() {
    setCode(template.code);
    const codes = { ...prefsRef.current.codes };
    delete codes[templateId];
    savePrefs({ codes });
    setConfirmReset(false);
  }

  async function onPickFiles(e: ChangeEvent<HTMLInputElement>) {
    const client = clientRef.current;
    const picked = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!client || picked.length === 0) return;
    setFileError(null);
    let list = filesRef.current;
    const errors: string[] = [];
    for (const f of picked) {
      const check = checkUpload(client.uploadedFiles(), f);
      if (!check.ok) {
        errors.push(check.message);
        continue;
      }
      client.upload(check.name, await f.arrayBuffer());
      list = [...list.filter((x) => x.name !== check.name), { name: check.name, size: f.size }];
    }
    setFiles(list);
    if (errors.length > 0) setFileError(errors.join(" "));
  }

  async function downloadFile(name: string) {
    const data = await clientRef.current?.readFile(name);
    if (!data) {
      setFileError(`«${name}» ya no está en la carpeta de trabajo.`);
      return;
    }
    saveBlob(new Blob([data], { type: mimeFor(name) }), baseName(name));
  }

  function deleteFile(name: string) {
    clientRef.current?.removeFile(name);
    setFiles(filesRef.current.filter((f) => f.name !== name));
    setFileError(null);
  }

  function clearFiles() {
    clientRef.current?.clearFiles();
    setFiles([]);
    setFileError(null);
  }

  useLayoutEffect(() => {
    const pos = caretRef.current;
    const ta = textareaRef.current;
    if (pos === null || !ta) return;
    caretRef.current = null;
    ta.setSelectionRange(pos, pos);
  }, [code]);

  function onEditorKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      escRef.current = false;
      void runCode();
      return;
    }
    if (e.key === "Escape") {
      escRef.current = true;
      return;
    }
    if (e.key === "Tab" && !e.shiftKey && !escRef.current && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      caretRef.current = start + 4;
      changeCode(`${code.slice(0, start)}    ${code.slice(end)}`);
      return;
    }
    escRef.current = false; // Esc y después Tab: el Tab hace lo de siempre y sale del editor
  }

  const lineCount = code.split("\n").length;

  const chip = (() => {
    if (running) {
      if (pkg) return <Chip tone="info">Cargando {pkg}</Chip>;
      return <Chip tone="info">Ejecutando… {mmss(now - runningSince!)}</Chip>;
    }
    switch (phase.k) {
      case "idle":
        return (
          <Chip tone="outline">
            <CircleDashed size={16} strokeWidth={1.75} aria-hidden="true" />
            Python sin cargar
          </Chip>
        );
      case "download":
        return <Chip tone="info">Descargando Python</Chip>;
      case "preparing":
        return <Chip tone="info">Preparando Python…</Chip>;
      case "ready":
        return (
          <Chip tone="ok" title={versions ? `Python ${versions.python}${versions.numpy ? ` · numpy ${versions.numpy}` : ""}` : undefined}>
            <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
            Python listo
          </Chip>
        );
      case "offline":
        return (
          <Chip tone="warn">
            <WifiOff size={16} strokeWidth={1.75} aria-hidden="true" />
            No disponible sin conexión
          </Chip>
        );
      case "error":
        return (
          <Chip tone="crit">
            <OctagonAlert size={16} strokeWidth={1.75} aria-hidden="true" />
            Error al cargar
          </Chip>
        );
    }
  })();

  const runButton = (
    <Button
      variant={ready ? "primary" : "secondary"}
      onClick={() => void runCode()}
      disabled={!ready || running}
      aria-describedby={ready ? undefined : "py-run-hint"}
      className="touch-manipulation"
    >
      <Play size={16} strokeWidth={1.75} aria-hidden="true" />
      Ejecutar código
    </Button>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
              Python
            </h1>
            <p className="text-muted">
              Python 3.12 en tu navegador, sin instalar nada: numpy, pandas, matplotlib, seaborn, scikit-learn y más. Tu
              código y tus archivos no salen de este dispositivo. Las plantillas son ejercicios genéricos para practicar; no
              resuelven ninguna actividad evaluable.
            </p>
            {examPath !== null ? (
              <div>
                <Link to={examPath} relative="path" className={buttonVariants({ variant: "secondary" })}>
                  <ClipboardCheck size={16} aria-hidden="true" />
                  Simulacro de examen (01MIAR)
                </Link>
              </div>
            ) : null}
          </div>
          {chip}
        </div>

        <div className="flex flex-wrap items-end gap-2" role="toolbar" aria-label="Herramientas de Python">
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-semibold text-muted">Plantilla</span>
            <Select value={draft ? DRAFT_VALUE + draft.id : templateId} onValueChange={changeTemplate}>
              <SelectTrigger aria-label="Plantilla" className="min-w-[13rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
                {drafts.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Borradores</SelectLabel>
                      {drafts.map((d) => (
                        <SelectItem key={d.id} value={DRAFT_VALUE + d.id}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          {ready ? (
            runButton
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex rounded-md">
                  {runButton}
                </span>
              </TooltipTrigger>
              <TooltipContent>Carga Python primero</TooltipContent>
            </Tooltip>
          )}
          <Button
            id="py-trace-button"
            onClick={() => void traceCode()}
            disabled={!ready || running}
            aria-describedby={ready ? undefined : "py-run-hint"}
            className="touch-manipulation"
          >
            <Footprints size={16} strokeWidth={1.75} aria-hidden="true" />
            Ejecutar paso a paso
          </Button>
          <span id="py-run-hint" className="sr-only">
            Carga Python primero
          </span>
          <Button variant="secondary" onClick={stopRun} disabled={!running} className="touch-manipulation">
            <Square size={16} strokeWidth={1.75} aria-hidden="true" />
            Detener
          </Button>
          <Button
            variant="ghost"
            className="touch-manipulation"
            disabled={draft !== null}
            onClick={() => {
              if (!draft && code !== template.code) setConfirmReset(true);
            }}
          >
            <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
            Restablecer plantilla
          </Button>
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-semibold text-muted">Límite de ejecución</span>
            <Select
              value={String(limit)}
              onValueChange={(v) => {
                const n = Number(v);
                setLimit(n);
                savePrefs({ limit: n });
              }}
            >
              <SelectTrigger aria-label="Límite de ejecución" className="min-w-[7rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMITS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s} s
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {notice && (
          <p role="status" className="flex items-start gap-2 rounded-md border border-border bg-info-bg px-3 py-2 text-[14px] text-info">
            <Info size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{notice}</span>
          </p>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-2 lg:col-span-7">
            {draft && (draft.origin.kind === "cell" || renderDraftActions) && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-sunken px-3 py-2">
                {draft.origin.kind === "cell" && (
                  <p className="text-[14px] font-semibold text-muted">{copyDraftBand(draft.origin.notebookTitle, draft.origin.cell)}</p>
                )}
                {renderDraftActions && (
                  <div className="flex flex-wrap items-center gap-2">
                    <SlotBoundary key={draft.id}>
                      <HostSlot render={() => renderDraftActions({ draft, files: filesApi })} />
                    </SlotBoundary>
                  </div>
                )}
              </div>
            )}
            <div className="flex overflow-hidden rounded-lg border border-border bg-sunken focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
              <div
                ref={gutterRef}
                aria-hidden="true"
                className="mono select-none overflow-hidden border-r border-border px-2 py-3 text-right text-[16px] leading-[1.5] text-muted"
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                aria-label="Código Python"
                value={code}
                onChange={(e) => changeCode(e.target.value)}
                onKeyDown={onEditorKey}
                onScroll={(e) => {
                  if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                wrap="off"
                className="mono min-h-[320px] w-full resize-y whitespace-pre bg-transparent px-3 py-3 text-[16px] leading-[1.5] text-fg outline-none lg:min-h-[480px]"
              />
            </div>
            <p className="text-[14px] text-muted">
              Tus cambios se guardan en este dispositivo. Admite %time, %timeit, %%time, %%timeit y %matplotlib inline.
            </p>

            <details className="rounded-md border border-border px-3 py-2">
              <summary className="cursor-pointer text-[14px] font-semibold">Entrada para input()</summary>
              <div className="flex flex-col gap-1 pt-2">
                <label htmlFor="py-stdin" className="text-[14px] text-muted">
                  Cada input() lee la siguiente línea. Escríbelas antes de ejecutar.
                </label>
                <textarea
                  id="py-stdin"
                  value={stdin}
                  onChange={(e) => {
                    setStdin(e.target.value);
                    savePrefs({ stdin: e.target.value });
                  }}
                  spellCheck={false}
                  rows={3}
                  className="mono w-full resize-y rounded-md border border-border bg-sunken px-3 py-2 text-[16px] leading-[1.5]"
                />
              </div>
            </details>

            <FilesPanel
              files={files}
              error={fileError}
              limits={filesApi.limits}
              actions={
                renderFilesActions ? (
                  <SlotBoundary>
                    <HostSlot render={() => renderFilesActions({ draft, files: filesApi })} />
                  </SlotBoundary>
                ) : null
              }
              onPick={() => fileInputRef.current?.click()}
              onDownload={(n) => void downloadFile(n)}
              onDelete={deleteFile}
              onClear={clearFiles}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={UPLOAD_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              data-testid="py-file-input"
              onChange={(e) => void onPickFiles(e)}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2 lg:col-span-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[14px] font-semibold">Salida</span>
                {lastMs !== null && <span className="mono text-[14px] text-muted">Terminado en {seconds(lastMs)} s</span>}
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setOut([]);
                  setLastMs(null);
                }}
              >
                Limpiar salida
              </Button>
            </div>
            <div
              ref={outputRef2}
              role="log"
              aria-live="off"
              aria-label="Salida"
              className="flex min-h-[240px] flex-col gap-2 overflow-auto rounded-lg border border-border bg-base p-3"
            >
              <OutputBody phase={phase} out={out} onLoad={() => void loadPython()} onAbort={() => abortRef.current?.abort()} onRetry={retry} />
            </div>
            <div className="sr-only" aria-live="polite" role="status">
              {announce && <span className="sr-only">{announce}</span>}
              {dlAnnounce && <span className="sr-only">{dlAnnounce}</span>}
            </div>
          </div>
        </div>

        <div ref={traceRef} className="scroll-mt-28 lg:scroll-mt-4" data-trace-panel="">
          {traced && traced.code === code ? (
            traced.outcome.ok ? (
              <TraceView
                code={traced.code}
                trace={traced.outcome.trace}
                onClose={() => {
                  setTraced(null);
                  // El foco vuelve al botón que lo abrió.
                  document.getElementById("py-trace-button")?.focus();
                }}
              />
            ) : (
              <p role="alert" className="flex items-start gap-2 text-[14px] text-crit">
                <OctagonAlert size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{traced.outcome.message}</span>
              </p>
            )
          ) : null}
        </div>

        <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
          <DialogContent>
            <DialogTitle>Restablecer plantilla</DialogTitle>
            <DialogDescription>Restablecer «{template.label}»: perderás los cambios que hiciste en el editor.</DialogDescription>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                Conservar cambios
              </Button>
              <Button variant="destructive" onClick={resetTemplate}>
                Restablecer plantilla
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>
    </TooltipProvider>
  );
}

function FilesPanel({
  files,
  error,
  limits,
  actions,
  onPick,
  onDownload,
  onDelete,
  onClear,
}: {
  files: FileInfo[];
  error: string | null;
  limits: FileLimits;
  actions: ReactNode;
  onPick: () => void;
  onDownload: (name: string) => void;
  onDelete: (name: string) => void;
  onClear: () => void;
}) {
  return (
    <section aria-labelledby="py-files-title" className="flex flex-col gap-2 rounded-md border border-border px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="py-files-title" className="text-[14px] font-semibold">
          Archivos
        </h2>
        <div className="flex flex-wrap gap-2">
          {actions}
          <Button variant="secondary" onClick={onPick} className="touch-manipulation">
            <FileUp size={16} strokeWidth={1.75} aria-hidden="true" />
            Subir archivo
          </Button>
          <Button variant="ghost" onClick={onClear} disabled={files.length === 0} className="touch-manipulation">
            <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
            Vaciar archivos
          </Button>
        </div>
      </div>
      <p className="text-[14px] text-muted">
        CSV, TXT, JSON o imágenes, hasta {fmtLimit(limits.maxFileBytes)} cada uno y {fmtLimit(limits.maxTotalBytes)} en total.
        Se abren con su nombre (o su ruta, si están en una carpeta), por ejemplo open(&quot;datos.txt&quot;) o
        pd.read_csv(&quot;datos.csv&quot;). No salen del navegador.
      </p>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-[14px] text-crit">
          <OctagonAlert size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {files.length > 0 && (
        <ul aria-label="Archivos de la carpeta de trabajo" className="flex flex-col divide-y divide-border">
          {files.map((f) => (
            <li key={f.name} className="flex items-center justify-between gap-2 py-1">
              <span className="mono min-w-0 truncate text-[14px]">
                {f.name} <span className="text-muted">· {fmtBytes(f.size)}</span>
              </span>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" onClick={() => onDownload(f.name)} aria-label={`Descargar ${f.name}`}>
                  <Download size={16} strokeWidth={1.75} aria-hidden="true" />
                  Descargar
                </Button>
                <Button variant="ghost" onClick={() => onDelete(f.name)} aria-label={`Borrar ${f.name}`}>
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                  Borrar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OutputBody({
  phase,
  out,
  onLoad,
  onAbort,
  onRetry,
}: {
  phase: Phase;
  out: OutItem[];
  onLoad: () => void;
  onAbort: () => void;
  onRetry: () => void;
}) {
  if (phase.k === "idle") {
    return (
      <div className="flex flex-col items-start gap-3">
        <h2 className="flex items-center gap-2 font-display text-[20px] font-semibold leading-[1.2]">
          <HardDriveDownload size={20} strokeWidth={1.75} aria-hidden="true" />
          Python aún no está en este dispositivo
        </h2>
        <p>
          La primera vez se descargan unos {fmtMB(FIRST_BYTES)} (Python y numpy) desde este sitio; después quedan en la caché
          del navegador. pandas ({fmtMB(packageBytes("pandas"))}), matplotlib ({fmtMB(packageBytes("matplotlib"))}) y el resto
          de paquetes se descargan solo cuando los importes.
        </p>
        <Button variant="primary" onClick={onLoad} className="touch-manipulation">
          <HardDriveDownload size={16} strokeWidth={1.75} aria-hidden="true" />
          Cargar Python
        </Button>
      </div>
    );
  }
  if (phase.k === "download") {
    const text = `${fmtMB(phase.done)} de ${fmtMB(phase.total)}`;
    const pct = phase.total > 0 ? Math.min(100, Math.round((phase.done / phase.total) * 100)) : 0;
    return (
      <div className="flex flex-col gap-2">
        <div
          role="progressbar"
          aria-label="Descarga de Python"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={text}
          className="h-2 w-full overflow-hidden rounded-full bg-sunken"
        >
          <div className="h-full bg-fg motion-safe:transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <span className="mono text-[14px]">{text}</span>
        <Button variant="ghost" onClick={onAbort} className="self-start">
          Detener descarga
        </Button>
      </div>
    );
  }
  if (phase.k === "preparing") return <p className="text-[14px] text-muted">Iniciando el intérprete y numpy…</p>;
  if (phase.k === "error" || phase.k === "offline") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="flex items-start gap-2 text-crit">
          <OctagonAlert size={16} strokeWidth={1.75} aria-hidden="true" className="mt-1 shrink-0" />
          <span>{COPY_LOAD_ERROR}</span>
        </p>
        <Button variant="secondary" onClick={onRetry}>
          Reintentar carga
        </Button>
      </div>
    );
  }
  if (out.length === 0) return <p className="text-[14px] text-muted">{COPY_EMPTY}</p>;
  return (
    <>
      {out.map((item, i) => {
        switch (item.k) {
          case "stdout":
            return (
              <pre key={i} className="mono whitespace-pre-wrap break-words text-[14px] text-fg">
                {item.text.replace(/\n$/, "")}
              </pre>
            );
          case "stderr":
            return (
              <pre key={i} className="mono whitespace-pre-wrap break-words text-[14px] text-crit">
                {item.text.replace(/\n$/, "")}
              </pre>
            );
          case "info":
            return (
              <p key={i} className="text-[14px] text-muted">
                {item.text}
              </p>
            );
          case "hint":
            return (
              <p key={i} className="flex items-start gap-2 rounded-md bg-warn-bg px-3 py-2 text-[14px] text-warn">
                <Info size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{item.text}</span>
              </p>
            );
          case "crit":
            return (
              <p key={i} className="flex items-start gap-2 text-[14px] text-crit">
                <OctagonAlert size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{item.text}</span>
              </p>
            );
          case "error":
            return (
              <div key={i} className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-crit">
                  <OctagonAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                  {item.line !== null ? `Error en la línea ${item.line}` : "Error"}
                </span>
                <pre className="mono whitespace-pre-wrap break-words text-[14px] text-crit">{item.text}</pre>
              </div>
            );
          case "fig":
            return <Figure key={i} b64={item.b64} n={item.n} />;
        }
      })}
    </>
  );
}
