// Avisos en español para los errores típicos de Python en el navegador. No sustituyen la traza: se
// muestran encima de ella, para que se entienda qué ha pasado y qué hacer.

export const COPY_NO_INTERNET = "Este entorno no accede a internet: descarga el archivo y súbelo con «Subir archivo»";

const COLAB = "Usa Google Colab o un entorno local con Python 3.12";

/** Bibliotecas que no existen para Pyodide (necesitan binarios nativos o GPU). Clave: módulo raíz. */
const UNAVAILABLE: Record<string, string> = {
  tensorflow: `TensorFlow no funciona en el navegador. ${COLAB}`,
  tensorflow_datasets: `TensorFlow Datasets necesita TensorFlow, que no funciona en el navegador. ${COLAB}`,
  tensorflow_hub: `TensorFlow Hub necesita TensorFlow, que no funciona en el navegador. ${COLAB}`,
  tf_keras: `Keras necesita TensorFlow, que no funciona en el navegador. ${COLAB}`,
  keras: `Keras necesita TensorFlow (o PyTorch o JAX), que no funcionan en el navegador. ${COLAB}`,
  torch: `PyTorch no funciona en el navegador. ${COLAB}`,
  torchvision: `torchvision necesita PyTorch, que no funciona en el navegador. ${COLAB}`,
  torchaudio: `torchaudio necesita PyTorch, que no funciona en el navegador. ${COLAB}`,
  pytomography: `PyTomography necesita PyTorch, que no funciona en el navegador. ${COLAB}`,
  jax: `JAX no funciona en el navegador. ${COLAB}`,
  jaxlib: `JAX no funciona en el navegador. ${COLAB}`,
  flax: `Flax necesita JAX, que no funciona en el navegador. ${COLAB}`,
  transformers: `Transformers (Hugging Face) necesita PyTorch o TensorFlow, que no funcionan en el navegador. ${COLAB}`,
  cupy: `CuPy necesita una GPU NVIDIA y no funciona en el navegador. ${COLAB}`,
  pycuda: `PyCUDA necesita una GPU NVIDIA y no funciona en el navegador. ${COLAB}`,
};

/** Lo que sí trae el entorno, para el aviso genérico. */
const INCLUDED =
  "numpy, pandas, matplotlib, seaborn, scipy, scikit-learn, statsmodels, nltk, OpenCV (cv2), Pillow, BeautifulSoup, lxml, wordcloud, pytest y la biblioteca estándar";

const MODULE_NOT_FOUND = /ModuleNotFoundError: No module named '([A-Za-z0-9_.]+)'/;

/** Aviso para un ModuleNotFoundError, o null si el error es otro. */
export function moduleHint(message: string): string | null {
  const m = MODULE_NOT_FOUND.exec(message);
  if (!m) return null;
  const root = m[1]!.split(".")[0]!;
  return (
    UNAVAILABLE[root] ??
    `El paquete «${root}» no está incluido en este entorno. Incluidos: ${INCLUDED}. Para otros paquetes, usa Google Colab o un entorno local con Python 3.12.`
  );
}

// Errores de red de urllib, requests, pyodide.http y nltk.download. En el navegador no hay sockets y la
// política de seguridad del sitio solo deja pedir archivos a su propio origen.
const NETWORK = [
  /URLError|urlopen error/,
  /requests\.exceptions\.(ConnectionError|ConnectTimeout|SSLError)|NewConnectionError|MaxRetryError/,
  /socket\.gaierror|getaddrinfo|Name or service not known|Errno 23|Errno 50|Errno 101|Errno 113|Network is unreachable|Host is unreachable/,
  /Failed to fetch|NetworkError when attempting to fetch|Content Security Policy|Failed to execute 'send' on 'XMLHttpRequest'/,
  /\[nltk_data\] Error loading/,
  /Resource \S+ not found\.\s+Please use the NLTK Downloader/,
];

/** ¿El texto (traza o salida) es de un intento de acceder a internet? */
export function isNetworkError(text: string): boolean {
  return NETWORK.some((re) => re.test(text));
}

export const COPY_STDIN_EMPTY =
  "input() lee las líneas de «Entrada para input()» y no quedan más. Escríbelas antes de ejecutar, una por línea.";

/**
 * Avisos para una ejecución: a partir del error (si lo hubo) y de lo que el programa escribió. Como
 * mucho uno de cada tipo y en este orden: biblioteca no disponible, red, input().
 */
export function hintsFor(input: { error?: string | null; output?: string }): string[] {
  const error = input.error ?? "";
  const all = `${error}\n${input.output ?? ""}`;
  const hints: string[] = [];
  const mod = moduleHint(error);
  if (mod) hints.push(mod);
  if (isNetworkError(all)) hints.push(COPY_NO_INTERNET);
  if (/EOFError: EOF when reading a line/.test(error)) hints.push(COPY_STDIN_EMPTY);
  return hints;
}

export const COPY_FONT_CACHE = "matplotlib está preparando su caché de fuentes: solo pasa la primera vez y tarda unos segundos.";

/**
 * Qué es un trozo de stderr: el aviso de la caché de fuentes de matplotlib (un aviso neutro), un
 * aviso de Python (FutureWarning, UserWarning…: no es un error, el programa sigue) o stderr de verdad.
 */
export function classifyStderr(text: string): "font-cache" | "warning" | "stderr" {
  if (/Matplotlib is building the font cache/i.test(text)) return "font-cache";
  if (/^\S.*:\d+: [A-Za-z]*Warning: /m.test(text) || /^[A-Za-z]*Warning: /m.test(text)) return "warning";
  return "stderr";
}
