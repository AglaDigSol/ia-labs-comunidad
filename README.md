# IA Labs · Comunidad

Laboratorios interactivos para estudiar el Máster en Inteligencia Artificial: simbología matemática, lógica
proposicional y de predicados, cadenas de Markov, álgebras de Boole, álgebra lineal y tensores, cálculo y descenso de gradiente, probabilidad y distribuciones, calendario de clases con tu zona horaria, flashcards con repaso espaciado y una
calculadora de notas.

> **Proyecto comunitario de estudiantes del Máster en IA. No oficial ni afiliado a la Universidad Internacional de Valencia (VIU).**

La app funciona entera en el navegador: no hay servidor, ni cuentas, ni cookies, ni analítica. Lo que guardas
(flashcards, notas, preferencias) vive en el `localStorage` de tu navegador y puedes llevártelo con
«Ajustes → Exportar mis datos».

## Qué incluye

| Módulo | Qué hace | Interruptor |
| --- | --- | --- |
| Simbología | Diccionario de símbolos con búsqueda, fichas KaTeX, «lectura en clase» con voz (Web Speech) y el equivalente en Python/NumPy como texto. | siempre activo |
| Lógica | Tablas de verdad (también paso a paso, una subfórmula cada vez), comparar dos fórmulas, FND/FNC y el espacio F₁. | siempre activo |
| Predicados | Evaluar fórmulas con ∀ y ∃ en un dominio finito (extensiones con casillas, paso a paso por instancias, testigos y contraejemplos), negar paso a paso con las leyes de la negación, comprobado en cada línea, y traducir frases a fórmulas. | siempre activo |
| Conjuntos | Diagramas de Venn de 2 y 3 conjuntos (sombrear la expresión o calcularla con elementos), igualdades demostradas paso a paso con una ley por línea y «¿Son iguales?» con contraejemplo, problemas de inclusión–exclusión y conjunto de partes y producto cartesiano. | siempre activo |
| Álgebra de Boole | ¿Es un álgebra de Boole? (axiomas B1–B5 sobre estructuras finitas, tablas y diagrama de Hasse), simplificación paso a paso con leyes, comprobada en cada línea, puertas y circuitos (circuito → función, función → circuito con solo NAND o solo NOR, y las siete puertas) los espacios F₁ y F₂, y mapas de Karnaugh de 2 a 4 variables con las formas Σm y ΠM. ⊕ es la suma, no el XOR (que se escribe ⊻). | siempre activo |
| Álgebra lineal | Gauss-Jordan paso a paso (eliges cada operación elemental o escribes la matriz siguiente, y se comprueba antes de seguir; luego clasificas el sistema con Rouché–Frobenius y escribes su solución, también paramétrica), producto, determinante, rango e inversa celda a celda, independencia lineal y bases, autovalores y autovectores (comprobados con Av = λv), transformaciones del plano dibujadas con sus direcciones propias y formas de tensores con las reglas de NumPy (emisión, `@`, `sum(axis)`, `reshape`, `.T`). Con fracciones exactas. | siempre activo |
| Cálculo | Derivadas paso a paso (escribes cada línea y eliges la regla: suma, factor constante, producto, cociente, potencia, cadena o derivadas elementales; cada línea se comprueba en muchos puntos y se avisa si la regla no encaja), o solo el resultado; recta tangente con f y f′ dibujadas y tu recta encima; primitivas (comprobadas derivándolas, con + C) e integrales definidas con sumas de Riemann; derivadas parciales, gradiente y curvas de nivel con flechas, y puntos críticos clasificados con la hessiana; descenso de gradiente en una y dos variables (α, punto de partida, iteraciones, momento y Adam; Rosenbrock, valle alargado, varios mínimos y punto de silla) y los primeros pasos a mano. | siempre activo |
| Probabilidad | Árbol de probabilidad total y Bayes que rellenas casilla a casilla (ramas que faltan, productos, P(C) y P(Aᵢ \| C)), tabla de contingencia 2×2 con P(A \| B), P(B \| A) e independencia, condicionada con un dado (opciones a–d), independencia con P(A), P(B) y un dato más (selecciona la o las correctas), distribuciones discretas (Bernoulli, binomial, geométrica, Poisson y uniforme: diagrama de barras con la función de distribución, tabla, media y varianza, y práctica con historias: qué distribución es, P(X = k), P(X ≥ k), E[X] y Var(X)), tabla de un juego con dados o monedas (equilibrados o trucados) y su esperanza, penalización justa por fallo en un test, E[XY] con independientes y simulación con semilla de la frecuencia relativa. Fracciones exactas; las respuestas se aceptan como fracción o redondeadas a dos decimales con coma, como en el examen. | siempre activo |
| Markov | Racionales exactos, validador de matrices estocásticas, evolución vₙ, distribución estacionaria π y problema inverso. | siempre activo |
| Ejercicios | Banco de ejercicios generados al momento, por tema y nivel (básico, medio, avanzado): tablas de verdad, clasificar, equivalencias y FND/FNC; evaluar y negar con cuantificadores; Venn, igualdades, inclusión–exclusión, partes y producto; Σm y ΠM, Karnaugh y simplificar con leyes; Gauss-Jordan, determinante, producto, inversa, sistemas, independencia, autovalores y formas de tensores; derivadas por reglas, recta tangente, primitivas, integrales definidas, gradiente, puntos críticos con la hessiana y pasos de descenso de gradiente; probabilidad total y Bayes (también contada con porcentajes), condicionada con un dado, condicionada e independencia, binomial, geométrica, esperanza de un juego con un dado trucado, penalización en un test y E[XY] con independientes. Cada ejercicio usa la práctica de su laboratorio, va en la URL (se puede compartir o repetir) y cuenta en el progreso. Con Python encendido, también ejercicios de Python de 01MIAR (temas 1 a 5) corregidos en el navegador y «¿Qué imprime?» (ver [Ejercicios de Python](#ejercicios-de-python)). | siempre activo |
| Calendario | Clases y entregas en hora de España y en la tuya, aviso de cambio de hora y calendario `.ics` suscribible. | `calendario` |
| Flashcards | Repaso espaciado SM-2 con mazos generados desde el diccionario y mazos propios con KaTeX. | `flashcards` |
| Calculadora de notas | Nota ponderada, mínimo de 5,0 por bloque, nota necesaria en el examen y menciones. Orientativa, no oficial. | `calculadora` |
| Python (opcional) | Pestaña de Laboratorios, tras «Ejercicios»: Python 3.12 en el navegador con Pyodide (numpy, pandas, matplotlib, seaborn, scikit-learn…), plantillas de 01MIAR, archivos propios, `%timeit`, borradores y «Ejecutar paso a paso». Ver [Python (opcional)](#python-opcional). | `python` (apagado) |

Los módulos opcionales se activan o desactivan en [`src/config.ts`](src/config.ts):

```ts
export const config = {
  modules: { calendario: true, flashcards: true, calculadora: true, python: false },
} as const;
```

Si pones uno a `false`, desaparece de la navegación y de las rutas, y su código no llega a descargarse. `python` viene
apagado y también se enciende sin tocar el código, al construir: `LABS_PYTHON=1 npm run build`.

### Modo «Comprueba tu respuesta»

Los laboratorios están pensados para **comprobar y entrenar, no para resolver**. Donde la app calcula un resultado
(tabla de verdad, clasificación, equivalencia, evolución de Markov, π, u₀, axiomas B1–B5, simplificaciones, pasos de Gauss-Jordan, determinantes, inversas, autovalores, derivadas, primitivas, integrales, gradientes, puntos críticos, pasos de descenso de gradiente, la función de
un circuito, las tablas de F₁ o una expresión para una función de F₂), la vista por defecto te pide tu resultado,
lo corrige y te da pistas paso a paso. La solución completa queda detrás de «Ver la solución completa», con un aviso
de integridad. El explorador de F₁ ya funcionaba así (rellenas la tabla y pulsas «Comprobar»). La tabla de verdad
se puede hacer paso a paso: cada columna intermedia se comprueba y se bloquea antes de añadir la siguiente. Los
visualizadores, como «Función → circuito», enseñan el resultado directamente porque no hay nada que adivinar.

## Ejecutar en local

Necesitas Node.js 22.18 o superior.

```sh
npm ci --ignore-scripts
npm run dev          # http://localhost:5173
npm test             # vitest
npm run typecheck
npm run lint:install && npm run lint
npm run build        # genera dist/
```

## Generar `dist/`

```sh
npm ci --ignore-scripts
npm run build                      # VITE_BASE=/ por defecto
VITE_BASE=/labs/ npm run build     # si el sitio va en una subcarpeta
```

`npm run build` hace `vite build` y después `node scripts/build-ics.ts dist`, que añade `calendario.ics`,
`calendario-<materia>.ics` y `calendario.json`; `scripts/vendor-pyodide.ts`, que solo hace algo con Python encendido; y
`scripts/check-python.ts`, que comprueba que Pyodide no está en el chunk de entrada (y que no hay nada de Python si está
apagado). El resultado es una carpeta estática (unos 2,7 MB, con las fuentes de KaTeX; unos 113 MB con Python) que se
sirve con cualquier servidor web.

## Python (opcional)

La pestaña «Python» ejecuta Python 3.12.7 en el navegador con [Pyodide](https://pyodide.org) 0.27.7, en un worker: el
código, los archivos que subes y lo que escribe el programa no salen de tu dispositivo. Viene **apagada**, porque
publica unos 110 MB de paquetes junto al sitio.

### Encenderla

```sh
LABS_PYTHON=1 npm run build                                         # o python: true en src/config.ts
docker build --build-arg LABS_PYTHON=1 -t ia-labs-comunidad .       # Docker
```

`LABS_PYTHON=0` la apaga aunque `src/config.ts` diga `true`. Apagada no hay pestaña, ni ruta (un enlace viejo lleva a
Simbología), ni chunk, ni worker, ni `dist/pyodide/`, ni el tema «Python (01MIAR)» de «Ejercicios» (sus enunciados
tampoco van en el build).

Encendida, el build escribe `dist/pyodide/0.27.7/`: el núcleo, copiado de `node_modules/pyodide` (fijado por
`package-lock.json`); los paquetes de la distribución oficial (numpy, pandas, matplotlib, scipy, scikit-learn, Pillow,
nltk, BeautifulSoup, OpenCV, pytest, regex, lxml, statsmodels, wordcloud, micropip y todas sus dependencias), y
seaborn, folium, branca e ipytest, que Pyodide no trae, desde PyPI. Cada archivo se comprueba (tamaño y SHA-256) contra
[`pyodide-manifest.ts`](src/features/labs/python/pyodide-manifest.ts), el `pyodide-lock.json` del paquete y
[`packages.ts`](src/features/labs/python/packages.ts); si algo no cuadra, o no hay red, el build falla con un mensaje en
español. Los paquetes se descargan de jsDelivr (`PYODIDE_BASE_URL` para otro espejo) y, si no responde, de la release
oficial de GitHub (unos 390 MB; `PYODIDE_TARBALL=<ruta>` usa una ya descargada). Quedan en `.cache/pyodide/` (fuera de
git) para los siguientes builds. Detrás de un proxy, Node 22 necesita `NODE_USE_ENV_PROXY=1`. En `npm run dev` con
`LABS_PYTHON=1`, Vite sirve `/pyodide/` desde esa caché.

### Qué se descarga cada usuario

Nada hasta que abre la pestaña y pulsa «Cargar Python». Después, solo lo que su código importa (los tamaños incluyen las
dependencias que aún no tenga; el navegador los guarda en caché):

| Al pulsar «Cargar Python» / al importar | MB |
| --- | --- |
| Python (núcleo, 13,7 MB) y numpy (3,1 MB) | 16,8 |
| `pandas` | 6,5 |
| `matplotlib` | 9,9 |
| `seaborn` (con pandas y matplotlib) | 15,9 |
| `scipy` | 19,6 |
| `sklearn` (con scipy) | 26,1 |
| `statsmodels` (con scipy y pandas) | 57,3 |
| `cv2` (OpenCV) | 11,4 |
| `nltk` | 2,0 |

### Qué se puede hacer

- Plantillas: tipos de datos, control de flujo, funciones, generadores, ficheros, NumPy básico, vectorización, Min-Max,
  limpieza con pandas, pandas con tu CSV, gráficos con seaborn y PerceptronSimple. Son ejercicios genéricos para
  practicar; ninguna resuelve una actividad evaluable. La app solo ejecuta el código del editor al pulsar
  «Ejecutar código».
- Archivos: «Subir archivo» (CSV, TSV, TXT, JSON, MD e imágenes; 20 MB cada uno y 50 MB en total) los deja en la
  carpeta de trabajo, así que `open("datos.txt")` o `pd.read_csv("datos.csv")` funcionan sin ruta. Lo que escribe el
  código aparece en «Archivos» (también lo que está en carpetas, como `res/datos.csv`) para descargarlo o borrarlo.
- Órdenes mágicas: `%time`, `%timeit` (con `-n` y `-r`), `%%time` y `%%timeit` en la primera línea, y
  `%matplotlib inline` (sin efecto: los gráficos salen debajo). Las demás (`%pip`, `!ls`, `%%capture`…) dan un error que
  las nombra.
- `input()` lee las líneas de «Entrada para input()», escritas antes de ejecutar.
- «Detener» interrumpe Python si el sitio está aislado entre orígenes (ver cabeceras); si no, lo reinicia (se pierden
  las variables, no los archivos subidos ni los que escribió la app anfitriona).
- «Ejecutar paso a paso» sigue el código del editor línea a línea, como Python Tutor: la línea que se va a ejecutar,
  la pila de llamadas con las variables de cada función (si dos nombres son el mismo objeto, lo dice: «misma lista que
  x»), lo que devuelve cada función y lo impreso hasta ese paso. Se recorre con «Principio», «Anterior», «Siguiente»,
  «Final» o el deslizador, y el paso se anuncia al lector de pantalla. Solo traza tu código (no el de las bibliotecas),
  hasta 2000 pasos, 10 000 caracteres de salida y 5 s; al llegar a un límite se para y lo dice. No admite órdenes
  mágicas.

### Ejercicios de Python

Con la pestaña encendida, «Ejercicios» tiene un tema más, **Python (01MIAR)**, con nueve tipos y tres niveles cada
uno. Cada ejercicio se genera con semilla (los datos de las pruebas cambian con «Siguiente ejercicio») y se corrige en
el navegador, con el mismo Python de la pestaña (que se descarga al pulsar «Comprobar» o «Cargar Python» si aún no está
en el dispositivo):

| Tipo | Tema | Qué se practica |
| --- | --- | --- |
| Variables, operadores y tipos | 1–2 | `//` y `%`, conversiones de unidades, IVA y descuentos, `int`/`float`/`str`, `bool` y años bisiestos |
| Cadenas: rebanadas y métodos | 2 | invertir y capicúas, contar vocales, iniciales, rebanadas, palabras y acrónimos |
| Listas, tuplas, diccionarios y conjuntos | 2 | contar apariciones, el más frecuente, agrupar, operaciones de conjuntos, tuplas y copias (mutabilidad) |
| if, for y while | 3 | `if`/`elif`/`else`, sumas con `range`, cifras con `while`, Collatz, `break` y `continue`, imprimir tablas |
| enumerate, zip y comprensiones | 3 | posiciones, numerar, emparejar, diferencias, comprensiones de listas y de diccionarios |
| Parámetros y valores devueltos | 4 | valores por defecto (y el mutable), `*args`, `**kwargs` y varios valores devueltos |
| Recursión, lambdas y sorted | 4 | funciones recursivas, `sorted` con `key`, funciones como valores y fábricas de funciones |
| Ficheros de texto y CSV | 5 | `with open`, contar líneas y palabras, escribir archivos y el módulo `csv` |
| ¿Qué imprime? | 1–4 | leer un fragmento corto y escribir exactamente su salida |

- **Ejercicio de código.** Escribes la función en el editor y pulsas «Comprobar». Cada caso se ejecuta en un espacio
  de nombres nuevo, con 2 s como mucho, y se compara con una solución de referencia: «Caso 2: incorrecto» enseña la
  llamada (por ejemplo, `es_bisiesto(1900)`) y lo que hizo tu código (`Tu resultado: True`, tu salida, tu archivo o el
  error con su línea), **nunca el valor esperado**. Algunos piden un requisito («usa una comprensión», «sin `if`»,
  «recursiva»), que se comprueba leyendo el código. En el tema 5, los archivos de cada caso se escriben en la carpeta
  de trabajo con la misma API de archivos de la pestaña y se borran al terminar.
- **«Dame una pista»** da pistas graduadas, de la idea al detalle, sin código. La solución de referencia solo se ve
  detrás de «Ver la solución completa».
- **«¿Qué imprime?»** no enseña la salida: al comprobar dice si coincide (sin contar los espacios del final) y, si
  no, la primera línea distinta y el botón «Ver paso a paso».
- Los enunciados son originales (no proceden de los cuadernos de la asignatura) y entrenan los temas, no resuelven la
  práctica ni el examen.

### Límites

- **Sin internet.** `urllib`, `requests`, `pyodide.http` o `nltk.download` no pueden salir del sitio (la CSP solo deja
  conectar con el propio origen). La app lo explica: descarga el archivo y súbelo con «Subir archivo».
- **Sin TensorFlow, Keras, PyTorch, JAX ni PyTomography**: no existen para el navegador. Para eso, Google Colab o un
  entorno local con Python 3.12.
- Un paquete que no está en la lista da `ModuleNotFoundError` con un aviso; no se instala nada desde PyPI en el
  navegador.
- La memoria es la de una pestaña del navegador (WebAssembly de 32 bits: unos 2 GB como mucho).

### Cabeceras

La CSP del documento no cambia (`script-src 'self'`). Pyodide compila WebAssembly dentro del worker, y un worker tiene
la CSP de la respuesta de su script: solo `assets/py.worker-*.js` recibe `script-src 'self' 'wasm-unsafe-eval'`
([`deploy/security-headers-wasm.conf`](deploy/security-headers-wasm.conf) en nginx, `FilesMatch` en Apache).
`'wasm-unsafe-eval'` permite compilar WebAssembly, no `eval` de JavaScript, y `connect-src 'self'` se mantiene. Además,
`/pyodide/` se sirve con `application/wasm` para los `.wasm` y caché inmutable (la carpeta lleva la versión).

COEP es opcional: con `Cross-Origin-Embedder-Policy: require-corp` en las dos cabeceras (`security-headers.conf` y
`security-headers-wasm.conf`), y el `Cross-Origin-Opener-Policy: same-origin` que ya se envía, el sitio queda aislado
y «Detener» interrumpe sin reiniciar. Sin COEP todo funciona igual.

Para probarlo de punta a punta: `node scripts/e2e-python.ts` (no va en la CI; necesita Playwright instalado aparte)
construye con `LABS_PYTHON=1`, sirve `dist/` con las cabeceras de `deploy/` y ejecuta código real en Chromium sin
interfaz.

## Desplegar en un subdominio propio

Ejemplo: `labs.tu-dominio.com`.

1. Crea el subdominio en tu DNS y apúntalo a tu servidor.
2. Activa HTTPS (Let's Encrypt o el proxy de Cloudflare). HSTS se envía siempre: no sirvas el sitio por HTTP.
3. Sube el contenido de `dist/` a la raíz del subdominio, o usa la imagen Docker.

### Opción A: `dist/` estático detrás de nginx

Copia [`deploy/nginx.conf`](deploy/nginx.conf), [`deploy/security-headers.conf`](deploy/security-headers.conf) y
[`deploy/security-headers-wasm.conf`](deploy/security-headers-wasm.conf) (la del worker de Python) a tu servidor,
cambia `root` y `listen` (y añade tu bloque TLS). Incluye el fallback SPA, caché inmutable en `/assets/` y
`/pyodide/`, los `.ics` como `text/calendar` con caché de 1 h y todas las cabeceras.

### Opción B: `dist/` estático en Apache

Sube `dist/` y copia [`deploy/htaccess.example`](deploy/htaccess.example) como `.htaccess` en la misma carpeta. Si el
sitio va en una subcarpeta, añade `RewriteBase /labs/` y construye con `VITE_BASE=/labs/`.

### Opción C: Docker

```sh
docker build -t ia-labs-comunidad .
docker run -d --name ia-labs -p 8080:8080 --restart unless-stopped ia-labs-comunidad
```

El `Dockerfile` es multi-stage: compila con Node y sirve `dist/` con `nginx:alpine` en el puerto 8080. Pon delante tu
proxy con TLS (nginx, Caddy, Traefik o Cloudflare Tunnel). Para una subcarpeta usa `--build-arg VITE_BASE=/labs/`; para
la pestaña Python, `--build-arg LABS_PYTHON=1`.

### Cabeceras recomendadas

`deploy/nginx.conf` ya las envía:

| Cabecera | Valor |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self'; style-src-elem 'self'; style-src-attr 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |
| `Content-Security-Policy` del worker de Python (`assets/py.worker-*.js`) | la misma, con `script-src 'self' 'wasm-unsafe-eval'` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | cámara, micrófono, geolocalización, pagos y sensores desactivados |
| `X-Robots-Tag` | `noindex, nofollow` |

Sobre la CSP:

- No hay scripts inline: el tema se aplica con `public/theme-init.js`, un fichero externo.
- `style-src-attr 'unsafe-inline'` es necesario porque KaTeX dibuja las fórmulas con atributos `style` y React aplica
  props de estilo. No permite elementos `<style>` ni scripts.
- Limitación conocida: algunos componentes de Radix (diálogos y selectores) intentan insertar un `<style>` pequeño
  (bloqueo de scroll del fondo y ocultar la barra de scroll). La CSP lo bloquea y el navegador lo anota en la consola;
  la app funciona igual, solo que la página de fondo puede desplazarse con un diálogo abierto.
- No se usa COEP (es opcional con la pestaña Python: ver [Cabeceras](#cabeceras) de Python).
- Los gráficos de matplotlib se dibujan en un `<canvas>`, así que `img-src` sigue sin `data:` ni `blob:`.

El sitio no aparece en buscadores: `<meta name="robots" content="noindex, nofollow">`, la cabecera `X-Robots-Tag` y
`robots.txt` con `Disallow: /`.

## Calendario suscribible

La app ofrece «Suscribirme» con la URL absoluta de `calendario.ics` (o de una materia), instrucciones para Google
Calendar, Apple y Outlook, y «Descargar .ics» para una importación puntual. Los `.ics` siguen RFC 5545: `VTIMEZONE`
Europe/Madrid, `TZID`, `UID` estables (`<id>@ia-labs-comunidad`), `DTSTAMP` y `SEQUENCE`. No llevan URL, descripciones
ni asistentes.

### Feed externo opcional (`CALENDAR_ICS_URL`)

Puedes fusionar un feed iCalendar externo con el calendario de `content/`. Es una variable **solo de build**:

```sh
CALENDAR_ICS_URL="https://…" npm run build
docker build --build-arg CALENDAR_ICS_URL="https://…" -t ia-labs-comunidad .
```

- Se toman solo los eventos cuyo título contiene un código de materia conocido. Se descartan `DESCRIPTION`, `URL`,
  `LOCATION`, `ATTENDEE` y `ORGANIZER`.
- Si un evento del feed coincide en materia y día con uno de `content/` a ±15 min, gana la hora del feed.
- La URL nunca llega al navegador, al bundle, a `dist/` ni a git. Si la descarga falla, el build sigue solo con
  `content/` y lo avisa en consola sin mostrar la URL.

> **Advertencia:** si usas tu feed personal del campus, todo el que abra el sitio verá los eventos de ese feed (aunque no
> tu token). No uses un feed con datos personales.

Para refrescarlo hay que reconstruir el sitio. Ejemplo de cron en el servidor (cada día a las 06:15). Si usas
`CALENDAR_ICS_KEY`, pásala en cada build: con otra clave cambian los enlaces de suscripción.

```cron
15 6 * * * cd /ruta/al/repo && git pull -q && CALENDAR_ICS_URL="$(cat /ruta/privada/feed-url)" CALENDAR_ICS_KEY="$(cat /ruta/privada/ics-key)" npm ci --ignore-scripts && npm run build && rsync -a --delete dist/ /ruta/del/sitio/
```

## Restringir el acceso

El sitio no tiene contraseña propia. Para que solo entren tus compañeros, pon **Cloudflare Access** delante del
subdominio (gratis hasta 50 usuarios):

1. En el panel de Cloudflare, abre **Zero Trust → Access → Applications → Add an application → Self-hosted**.
2. Dominio de la aplicación: tu subdominio (por ejemplo `labs.tu-dominio.com`).
3. Crea una política **Allow** con la regla *Emails* (la lista de correos de tus compañeros) o *Emails ending in* (el
   dominio del correo del máster).
4. En **Authentication**, usa *One-time PIN*: cada persona recibe un código de un solo uso en su correo.
5. **Excepción para el calendario (enlace con clave):** Google Calendar descarga las suscripciones desde sus
   servidores y no puede pasar por Access ni por ningún control propio del servidor. No abras `/calendario*` a todo el
   mundo: compila con una clave larga, por ejemplo `CALENDAR_ICS_KEY=$(openssl rand -hex 24) npm run build`. Los
   ficheros se llamarán `calendario-<clave>.ics` y `calendario-<clave>-<materia>.ics`, y ya no existirá
   `calendario.ics`. Después:
   - en Cloudflare Access, crea una aplicación *Self-hosted* con política **Bypass** solo para esas rutas exactas;
   - si el servidor tiene además su propio control de acceso (por ejemplo, un script que comprueba el pase de Access en
     cada petición), añade una excepción **solo para esos nombres exactos**.

   La app muestra esos enlaces en «Suscribirme» únicamente a quien ya ha entrado, porque los lee de `calendario.json`,
   que sigue protegido. Si la clave se filtra, genera otra y vuelve a compilar: los enlaces antiguos dejan de existir y
   cada compañero vuelve a suscribirse. Si no quieres ninguna excepción, «Descargar .ics» funciona igual.

## Usar como dependencia

Los laboratorios (Simbología, Lógica, Predicados, Conjuntos, Álgebra de Boole, Álgebra lineal, Cálculo, Probabilidad y Markov), el banco de ejercicios, la pestaña Python opcional y sus motores se pueden integrar en otra app de React. No hay paquete
en npm: se instala el tarball de una etiqueta publicada y el paquete trae el código TypeScript, que compilan el Vite y
el `tsc` de la app anfitriona.

```json
"dependencies": {
  "ia-labs-comunidad": "https://codeload.github.com/AglaDigSol/ia-labs-comunidad/tar.gz/refs/tags/v0.10.0"
}
```

`npm ci --ignore-scripts` funciona con esa línea (el paquete no tiene scripts de instalación).

**Dependencias compartidas.** `react`, `react-dom` y `react-router` son `peerDependencies` con versión exacta
(19.3.1, 19.3.1 y 8.5.0): la app anfitriona las pone en sus `dependencies` y así solo hay una copia de React. Radix,
KaTeX, zod, lucide-react, clsx, class-variance-authority y tailwind-merge son dependencias normales con versión exacta;
si la app usa las mismas versiones, npm las comparte. `pyodide` (0.27.7) también: si la app tiene otra versión, npm
instala la del paquete aparte y la pestaña usa la suya.

**Requisitos de compilación.** TypeScript con `"moduleResolution": "bundler"`, `"jsx": "react-jsx"` y
`"allowImportingTsExtensions": true` (los imports llevan la extensión `.ts`/`.tsx`), y Vite con
`@vitejs/plugin-react`.

**Rutas y pestañas.** `LabsRoutes` se monta dentro del router de la app, en una ruta con comodín. Los enlaces de las
pestañas se resuelven respecto a esa ruta, así que no hace falta pasar `basePath` (existe por si se monta fuera de una
ruta con comodín).

```tsx
import { lazy } from "react";
import { Route, Routes } from "react-router";
import { configureLabs, LabsRoutes, MemoryAdapter } from "ia-labs-comunidad";

// Opcional: dónde guardan su estado los laboratorios (borradores de Markov y Boole, formato de las tablas y progreso de los ejercicios).
// Por defecto, localStorage. MemoryAdapter = no se guarda nada; o cualquier StorageAdapter propio.
configureLabs({ storage: new MemoryAdapter() });

const Apuntes = lazy(() => import("./apuntes/ApuntesPage.tsx"));

<Routes>
  <Route
    path="/laboratorios/*"
    element={
      <LabsRoutes
        python
        extraTabs={[{ id: "apuntes", label: "Apuntes", path: "apuntes", element: <Apuntes /> }]}
        renderHeaderAction={(tab) => (tab ? <MiBoton titulo={tab.label} /> : null)}
      />
    }
  />
</Routes>;
```

- `extraTabs`: pestañas propias, en ese orden, después de los nueve laboratorios, de «Ejercicios» y de «Python» (si está
  encendida). `element` puede ser perezoso: hay un `Suspense` alrededor. Una pestaña con el id o la ruta de un
  laboratorio se ignora; con `python`, también una con el id o la ruta `python`.
- `python`: enciende la pestaña Python (por defecto, apagada). Ver «Pestaña Python en una app anfitriona», abajo.
- `renderHeaderAction(tab)`: acción opcional junto al título «Laboratorios»; recibe la pestaña activa
  (`{ id, label }`) o `null`.
- `configureLabs({ storage })`: recibe un `StorageAdapter` (`load`, `save`, `subscribe`), la misma interfaz que usa el
  almacén de la app. `createLocalStorageLabsAdapter({ markov, logicFormat, boole, exercises, python })` guarda en localStorage con las
  claves que elijas, por ejemplo las que ya usaba tu app; las que no pases usan `DEFAULT_LABS_KEYS`.
- También se exportan `SymbolsPage`, `LogicLabPage`, `PredicatesLabPage`, `SetsLabPage`, `MarkovLabPage`, `BooleLabPage`, `LinearAlgebraLabPage`, `CalculusLabPage`, `ProbabilityLabPage`,
  `ExercisesPage` y `PythonLabPage` por separado, y los motores: banco de ejercicios (`EXERCISE_TYPES`, `exerciseType`, cada tipo con
  `generate(semilla, nivel)`, `createRng`, `seedToText`/`seedFromText`), símbolos (`ALL_SYMBOLS`, `symbolById`, `searchSymbols`, tipos y esquemas), lógica (analizador,
  tabla de verdad, formas canónicas, comparación, F₁, notación), lógica de predicados (`parsePredicate`,
  `predToPlain`, `predToTex`, `analyzeVariables`, `evaluatePred`, `evaluationSteps`, `witnesses`,
  `findPredDifference`, `checkNegationStep`, `pushNegation` y `PREDICADOS_PACK`), álgebra de Boole (`parseBoole`, `checkAllAxioms`, `hasse`,
  `checkStep`, `applicableLaws`, `minimizeBoole`, circuitos con `validateNetlist`, `evaluateCircuit`,
  `circuitToExpression`, `circuitFromExpression`, `toNand`, `toNor` y `layoutCircuit`, y Fₙ con `enumerateFn`,
  `fnStructure`, `fnName` y `listFn`…), álgebra lineal (`parseMatrix`, `matrixProduct`, `matrixDeterminant`, `rref`,
  `applyRowOp`, `checkTypedStep`, `matrixInverse`, `analyzeSystem`, `checkParametric`, `nullSpace`, `checkBasis`,
  `charPolynomial`, `eigenvalues`, `isEigenpair`, `transformMatrix`, `broadcastShapes`, `tensorOpResult` y `LINALG_PACK`), cálculo (`parseCalcExpr`, `calcToTex`,
  `derivative`, `derivativeTidy`, `gradient`, `hessian`, `checkDerivStep`, `derivationSteps`, `calcEquivalent`,
  `checkAntiderivative`, `definiteIntegral`, `riemannSum`, `criticalPoints`, `classifyHessian`, `runDescent`,
  `exactDescentSteps` y `CALC_PACK`; los nombres que chocarían con otros motores llevan el prefijo `calc`),
  probabilidad (`parseProbAnswer`, `gradeAnswer`, `checkProbAnswer`, espacios y sucesos con `dieSpace`, `spanishDeck`,
  `probOf` y `condProbOf`, `solveTree`, `solveContingency`, `pairFacts`, `pmf`, `cdf`, `probAtLeast`, `distMean`,
  `distVariance`, `rvMean`, `rvVariance`, `penaltyForTarget`, `normalCdf`, `simulateFrequency` y `PROB_PACK`),
  Markov (matrices, evolución, sistemas, validación), racionales exactos y
  repaso espaciado SM-2 (`review`, barajas, `dueSummary`, esquemas). Con `"sideEffects"` declarado, lo que no se usa
  no entra en el bundle.
- Subrutas: `ia-labs-comunidad/shared/*` y `ia-labs-comunidad/content/*` para importar un módulo concreto, y
  `ia-labs-comunidad/tokens.css` para una app sin tokens de diseño propios.

**Estilos.** Los componentes usan clases de Tailwind v4 y los tokens de color de `src/styles/tokens.css` (`bg-base`,
`text-muted`, `border-accent`…). La app anfitriona tiene que pedir a Tailwind que lea el código del paquete,
añadiendo a su CSS de entrada (el que hace `@import "tailwindcss"`) una línea `@source` con la ruta relativa desde ese
fichero hasta `node_modules`. Si el CSS está en `src/styles/tokens.css`:

```css
@import "tailwindcss";
@source "../../node_modules/ia-labs-comunidad/src";
```

Si la app no define los mismos tokens, puede importar `ia-labs-comunidad/tokens.css` como CSS de entrada (ya incluye
`@import "tailwindcss"`) y añadirle la misma línea `@source`. Las fórmulas necesitan además
`import "katex/dist/katex.min.css";`.

**Pestaña Python en una app anfitriona.** Con `<LabsRoutes python />` la pestaña va tras «Ejercicios» (o
`PythonLabPage` en otra ruta). La app sirve los archivos de Pyodide y los configura:

```ts
import { configureLabs, createDraft, PYODIDE_VERSION } from "ia-labs-comunidad";

configureLabs({
  storage, // el editor guarda en la clave "python" del almacén
  python: {
    assetBaseUrl: `/pyodide/${PYODIDE_VERSION}/`, // por defecto, <base del sitio>pyodide/0.27.7/
    draftsKey: "mi-app.py.drafts", // por defecto, "ia-labs.py.drafts"
    crossOriginIsolated: "auto", // o true/false si la app sabe si envía COEP
  },
});

// «Abrir en Python»: un borrador nuevo que la pestaña abre en el editor (nunca lo ejecuta sola).
const id = createDraft({ origin: { kind: "cell", notebookTitle: "Tensores", cell: 12 }, code });
navigate(`/laboratorios/python?borrador=${id}`);
```

- En `assetBaseUrl` tienen que estar los archivos de `PYODIDE_CORE`, `PYODIDE_PACKAGES` y `EXTRA_WHEELS` (se exportan
  con su tamaño y su SHA-256) y un `pyodide-lock.json`: el del paquete `pyodide` o, mejor, recortado a esos paquetes
  (así un `import` de otro da `ModuleNotFoundError`). `node scripts/vendor-pyodide.ts` del repositorio genera esa
  carpeta.
- El worker sale como chunk propio del Vite de la app (`new Worker(new URL("./py.worker.ts", import.meta.url))`). Su
  respuesta necesita la CSP con `'wasm-unsafe-eval'` si la app usa una CSP estricta, y `worker: { format: "es" }` en
  `vite.config.ts`. En `npm run dev`, añade `optimizeDeps: { exclude: ["ia-labs-comunidad", "pyodide"] }`.
- Con la pestaña encendida, una `extraTabs` con id o ruta `python` se descarta: hay que quitarla.
- `<LabsRoutes python />` enciende también el tema «Python (01MIAR)» de «Ejercicios» (o `<ExercisesPage python />`
  si se monta aparte). Sin esa prop, sus tipos no aparecen, ni en la lista ni por su id en la URL. Usan el mismo
  `assetBaseUrl`. Los generadores se exportan como `PYTHON_EXERCISES` (y `exerciseType(id, { python: true })`).

**Archivos de la app anfitriona.** La app puede escribir sus propios archivos en la carpeta de trabajo de Python (por
ejemplo, los datos que usa un cuaderno), desde una ranura de la pestaña. Las ranuras son funciones en
`configureLabs({ python })` o props de `PythonLabPage` (las props mandan):

```tsx
import { configureLabs, createDraft, type DraftActionsContext } from "ia-labs-comunidad";

async function cargarDatos({ draft, files }: DraftActionsContext) {
  // draft.origin.source: lo que pasó la app en createDraft, p. ej. { kind: "repo", path: "notebooks/tema1.ipynb" }
  const csv = await (await fetch("/datos/res/data.csv")).arrayBuffer();
  const { written, skipped } = await files.writeFiles([{ path: "res/data.csv", data: csv }]);
  // skipped: [{ path, reason: "name" | "size" | "total" | "count", message }]
}

configureLabs({
  python: {
    maxTotalBytes: 120 * 1024 * 1024, // por defecto 50 MB; como mucho 200 MB
    maxFileBytes: 30 * 1024 * 1024, // por defecto 20 MB; como mucho 50 MB
    maxFiles: 100, // por defecto 30; como mucho 500
    renderDraftActions: (ctx) => <button onClick={() => void cargarDatos(ctx)}>Cargar los datos</button>,
  },
});

createDraft({ origin: { kind: "cell", notebookTitle: "Tema 1", cell: 4, source: { kind: "repo", path: "notebooks/tema1.ipynb" } }, code });
```

- `renderDraftActions(ctx)` se muestra en la banda del borrador abierto (`?borrador=`), con `ctx.draft`;
  `renderFilesActions(ctx)`, en la cabecera de «Archivos», con `ctx.draft` o `null`. Si una ranura lanza un error,
  desaparece y la pestaña sigue.
- `ctx.files.writeFiles(files: Array<{ path: string; data: ArrayBuffer | ArrayBufferView }>)` devuelve
  `Promise<{ written: FileInfo[]; skipped: SkippedFile[] }>`. Las rutas son relativas, con carpetas, y de cualquier
  extensión (`.py`, `.txt`, `.prototxt`, modelos binarios…); se rechazan sin arreglarlas si son absolutas, usan `..`
  o `.`, tienen partes vacías, `\`, caracteres de control, `<>:"|?*`, punto inicial o espacios en los extremos de una
  parte, más de 8 niveles, partes de más de 120 caracteres o más de 400 en total (`safeFilePath` hace la misma
  comprobación). Una ruta que ya existe se sustituye; una no puede ser archivo y carpeta a la vez.
- `ctx.files.limits` (y `fileLimits()`) dan los límites efectivos, que cuentan juntos los archivos subidos y los del
  anfitrión; `ctx.files.list()`, lo que muestra ahora «Archivos» (`[{ name: "res/data.csv", size }]`).
- Los bytes se copian y quedan solo en memoria (nunca en localStorage, IndexedDB ni la caché): si Python aún no está
  cargado se escriben al cargarlo, tras un reinicio se vuelven a escribir, «Vaciar archivos» los borra y al salir de
  la pestaña se pierden. Escribir un archivo nunca ejecuta nada.
- `origin.source` (`{ kind, path }`, de 32 y 500 caracteres como mucho y sin caracteres de control) es opcional; uno
  no válido se descarta y el borrador se crea igual.

La prueba [`tests/embed.test.tsx`](tests/embed.test.tsx) y el consumidor de
[`tests/consumer/`](tests/consumer/consumer.tsx) (que la CI compila importando solo de `"ia-labs-comunidad"`) muestran
el uso completo.

## Privacidad

- Sin cookies, sin analítica, sin rastreadores y sin CDN: fuentes del sistema, KaTeX, librerías y Pyodide se sirven
  desde el propio sitio. La pestaña Python no tiene acceso a internet y lo que subes a ella no sale del navegador.
- Sin claves de API en el frontend.
- Los datos se guardan en `localStorage` de tu navegador, con try/catch: si el navegador lo bloquea, la app sigue
  funcionando en memoria.
- «Importar mis datos» acepta como máximo 2 MB (se comprueba antes de leer), valida la copia con zod (incluida su
  `version`) y descarta las claves desconocidas. Nunca usa `eval` ni `innerHTML` con lo importado.

## Contenido y licencias

- Código: [MIT](LICENSE).
- Contenido de [`content/`](content) (símbolos, notación, ejercicios y circuitos de Boole, dominios y ejercicios de predicados, ejemplos de álgebra lineal, funciones de cálculo, problemas de probabilidad, pesos de evaluación, calendario): [CC BY 4.0](content/LICENSE).
- Cada paquete de contenido declara materia, tema, nivel, idioma, autoría, licencia y fuente, y se valida con zod en los
  tests. Los pesos y las fechas se citan de las guías docentes como dato, sin copiar texto.
- No se incluye material docente de la VIU (diapositivas, guías, enunciados ni soluciones).

¿Quieres añadir un símbolo, una asignatura o un evento? Lee [CONTRIBUTING.md](CONTRIBUTING.md).

## Mantenimiento

Los cambios entran por pull request, con revisión y los checks de CI en verde (ver [CONTRIBUTING.md](CONTRIBUTING.md)).
Las tareas de mantenimiento del repositorio están en [MAINTAINING.md](MAINTAINING.md).
