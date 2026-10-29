# IA Labs · Comunidad

Laboratorios interactivos para estudiar el Máster en Inteligencia Artificial: simbología matemática, lógica
proposicional y de predicados, cadenas de Markov, álgebras de Boole, calendario de clases con tu zona horaria, flashcards con repaso espaciado y una
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
| Markov | Racionales exactos, validador de matrices estocásticas, evolución vₙ, distribución estacionaria π y problema inverso. | siempre activo |
| Ejercicios | Banco de ejercicios generados al momento, por tema y nivel (básico, medio, avanzado): tablas de verdad, clasificar, equivalencias y FND/FNC; evaluar y negar con cuantificadores; Venn, igualdades, inclusión–exclusión, partes y producto; Σm y ΠM, Karnaugh y simplificar con leyes. Cada ejercicio usa la práctica de su laboratorio, va en la URL (se puede compartir o repetir) y cuenta en el progreso. | siempre activo |
| Calendario | Clases y entregas en hora de España y en la tuya, aviso de cambio de hora y calendario `.ics` suscribible. | `calendario` |
| Flashcards | Repaso espaciado SM-2 con mazos generados desde el diccionario y mazos propios con KaTeX. | `flashcards` |
| Calculadora de notas | Nota ponderada, mínimo de 5,0 por bloque, nota necesaria en el examen y menciones. Orientativa, no oficial. | `calculadora` |

Los módulos opcionales se activan o desactivan en [`src/config.ts`](src/config.ts):

```ts
export const config = {
  modules: { calendario: true, flashcards: true, calculadora: true },
} as const;
```

Si pones uno a `false`, desaparece de la navegación y de las rutas, y su código no llega a descargarse.

### Modo «Comprueba tu respuesta»

Los laboratorios están pensados para **comprobar y entrenar, no para resolver**. Donde la app calcula un resultado
(tabla de verdad, clasificación, equivalencia, evolución de Markov, π, u₀, axiomas B1–B5, simplificaciones, la función de
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
`calendario-<materia>.ics` y `calendario.json`. El resultado es una carpeta estática (unos 2,2 MB, con las fuentes de
KaTeX) que se sirve con cualquier servidor web.

## Desplegar en un subdominio propio

Ejemplo: `labs.tu-dominio.com`.

1. Crea el subdominio en tu DNS y apúntalo a tu servidor.
2. Activa HTTPS (Let's Encrypt o el proxy de Cloudflare). HSTS se envía siempre: no sirvas el sitio por HTTP.
3. Sube el contenido de `dist/` a la raíz del subdominio, o usa la imagen Docker.

### Opción A: `dist/` estático detrás de nginx

Copia [`deploy/nginx.conf`](deploy/nginx.conf) y [`deploy/security-headers.conf`](deploy/security-headers.conf) a tu
servidor, cambia `root` y `listen` (y añade tu bloque TLS). Incluye el fallback SPA, caché inmutable en `/assets/`, los
`.ics` como `text/calendar` con caché de 1 h y todas las cabeceras.

### Opción B: `dist/` estático en Apache

Sube `dist/` y copia [`deploy/htaccess.example`](deploy/htaccess.example) como `.htaccess` en la misma carpeta. Si el
sitio va en una subcarpeta, añade `RewriteBase /labs/` y construye con `VITE_BASE=/labs/`.

### Opción C: Docker

```sh
docker build -t ia-labs-comunidad .
docker run -d --name ia-labs -p 8080:8080 --restart unless-stopped ia-labs-comunidad
```

El `Dockerfile` es multi-stage: compila con Node y sirve `dist/` con `nginx:alpine` en el puerto 8080. Pon delante tu
proxy con TLS (nginx, Caddy, Traefik o Cloudflare Tunnel). Para una subcarpeta usa `--build-arg VITE_BASE=/labs/`.

### Cabeceras recomendadas

`deploy/nginx.conf` ya las envía:

| Cabecera | Valor |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self'; style-src-elem 'self'; style-src-attr 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |
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
- No se usa COEP.

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

Los laboratorios (Simbología, Lógica, Predicados, Conjuntos, Álgebra de Boole y Markov), el banco de ejercicios y sus motores se pueden integrar en otra app de React. No hay paquete
en npm: se instala el tarball de una etiqueta publicada y el paquete trae el código TypeScript, que compilan el Vite y
el `tsc` de la app anfitriona.

```json
"dependencies": {
  "ia-labs-comunidad": "https://codeload.github.com/AglaDigSol/ia-labs-comunidad/tar.gz/refs/tags/v0.7.0"
}
```

`npm ci --ignore-scripts` funciona con esa línea (el paquete no tiene scripts de instalación).

**Dependencias compartidas.** `react`, `react-dom` y `react-router` son `peerDependencies` con versión exacta
(19.3.1, 19.3.1 y 8.5.0): la app anfitriona las pone en sus `dependencies` y así solo hay una copia de React. Radix,
KaTeX, zod, lucide-react, clsx, class-variance-authority y tailwind-merge son dependencias normales con versión exacta;
si la app usa las mismas versiones, npm las comparte.

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

const PythonPage = lazy(() => import("./python/PythonPage.tsx"));

<Routes>
  <Route
    path="/laboratorios/*"
    element={
      <LabsRoutes
        extraTabs={[{ id: "python", label: "Python", path: "python", element: <PythonPage /> }]}
        renderHeaderAction={(tab) => (tab ? <MiBoton titulo={tab.label} /> : null)}
      />
    }
  />
</Routes>;
```

- `extraTabs`: pestañas propias, en ese orden, después de los seis laboratorios y de «Ejercicios». `element` puede ser perezoso: hay un
  `Suspense` alrededor. Una pestaña con el id o la ruta de un laboratorio se ignora.
- `renderHeaderAction(tab)`: acción opcional junto al título «Laboratorios»; recibe la pestaña activa
  (`{ id, label }`) o `null`.
- `configureLabs({ storage })`: recibe un `StorageAdapter` (`load`, `save`, `subscribe`), la misma interfaz que usa el
  almacén de la app. `createLocalStorageLabsAdapter({ markov, logicFormat, boole, exercises })` guarda en localStorage con las
  claves que elijas, por ejemplo las que ya usaba tu app; las que no pases usan `DEFAULT_LABS_KEYS`.
- También se exportan `SymbolsPage`, `LogicLabPage`, `PredicatesLabPage`, `SetsLabPage`, `MarkovLabPage`, `BooleLabPage` y
  `ExercisesPage` por separado, y los motores: banco de ejercicios (`EXERCISE_TYPES`, `exerciseType`, cada tipo con
  `generate(semilla, nivel)`, `createRng`, `seedToText`/`seedFromText`), símbolos (`ALL_SYMBOLS`, `symbolById`, `searchSymbols`, tipos y esquemas), lógica (analizador,
  tabla de verdad, formas canónicas, comparación, F₁, notación), lógica de predicados (`parsePredicate`,
  `predToPlain`, `predToTex`, `analyzeVariables`, `evaluatePred`, `evaluationSteps`, `witnesses`,
  `findPredDifference`, `checkNegationStep`, `pushNegation` y `PREDICADOS_PACK`), álgebra de Boole (`parseBoole`, `checkAllAxioms`, `hasse`,
  `checkStep`, `applicableLaws`, `minimizeBoole`, circuitos con `validateNetlist`, `evaluateCircuit`,
  `circuitToExpression`, `circuitFromExpression`, `toNand`, `toNor` y `layoutCircuit`, y Fₙ con `enumerateFn`,
  `fnStructure`, `fnName` y `listFn`…), Markov (matrices, evolución, sistemas, validación), racionales exactos y
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

La prueba [`tests/embed.test.tsx`](tests/embed.test.tsx) y el consumidor de
[`tests/consumer/`](tests/consumer/consumer.tsx) (que la CI compila importando solo de `"ia-labs-comunidad"`) muestran
el uso completo.

## Privacidad

- Sin cookies, sin analítica, sin rastreadores y sin CDN: fuentes del sistema, KaTeX y librerías se sirven desde el
  propio sitio.
- Sin claves de API en el frontend.
- Los datos se guardan en `localStorage` de tu navegador, con try/catch: si el navegador lo bloquea, la app sigue
  funcionando en memoria.
- «Importar mis datos» acepta como máximo 2 MB (se comprueba antes de leer), valida la copia con zod (incluida su
  `version`) y descarta las claves desconocidas. Nunca usa `eval` ni `innerHTML` con lo importado.

## Contenido y licencias

- Código: [MIT](LICENSE).
- Contenido de [`content/`](content) (símbolos, notación, ejercicios y circuitos de Boole, dominios y ejercicios de predicados, pesos de evaluación, calendario): [CC BY 4.0](content/LICENSE).
- Cada paquete de contenido declara materia, tema, nivel, idioma, autoría, licencia y fuente, y se valida con zod en los
  tests. Los pesos y las fechas se citan de las guías docentes como dato, sin copiar texto.
- No se incluye material docente de la VIU (diapositivas, guías, enunciados ni soluciones).

¿Quieres añadir un símbolo, una asignatura o un evento? Lee [CONTRIBUTING.md](CONTRIBUTING.md).

## Mantenimiento

Los cambios entran por pull request, con revisión y los checks de CI en verde (ver [CONTRIBUTING.md](CONTRIBUTING.md)).
Las tareas de mantenimiento del repositorio están en [MAINTAINING.md](MAINTAINING.md).
