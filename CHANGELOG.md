# Changelog

Todos los cambios relevantes de este proyecto se anotan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [Próximamente] (0.7)

- Modo «Comprueba tu respuesta» también para las formas normales (FND/FNC): hoy quedan dentro de «Ver la solución
  completa», sin ejercicio propio.
- i18n completo: mover a `src/i18n/` los textos internos de los laboratorios, las flashcards, la calculadora y el
  calendario (hoy están en sus componentes) y añadir inglés.
- Registro de plugins completo para módulos de terceros (hoy `src/config.ts` es un registro sencillo con
  activar/desactivar).
- Sincronización opcional con cuentas sobre la interfaz `StorageAdapter`.
- Evitar los `<style>` que insertan los diálogos y selectores de Radix, para no generar avisos de CSP.

## [0.6.0] - 2026-10-29

### Añadido

- **Lógica · «Comprueba tu respuesta» paso a paso**: la tabla de verdad se resuelve una columna cada vez, de dentro
  hacia fuera, con las subfórmulas en el mismo orden que la tabla de la solución.
  - Es el modo por defecto cuando la fórmula tiene subfórmulas intermedias. El selector «Paso a paso» / «Solo el
    resultado» conserva el ejercicio de antes (columna final y clasificación), que sigue siendo el único para las
    fórmulas sin pasos intermedios (p, ¬p, p ∧ q).
  - «Comprobar paso» marca en rojo, con una X y una etiqueta accesible, las casillas que están mal, sin mostrar nunca
    el valor correcto. Cuando toda la columna está bien, se bloquea, se anuncia «Paso k correcto» y «Siguiente paso:
    …» añade la columna siguiente y le pasa el foco. Encima de la tabla se lee «Paso k de n».
  - Las cabeceras de las columnas que combina el paso actual (variables o pasos anteriores) se resaltan, y las pistas
    de cada paso nombran primero el operador y sus operandos («Esta columna aplica → a p y q: mira esas dos
    columnas») y después la regla del operador, nunca los valores.
  - Al completar la última columna se elige la clasificación. «Empezar de nuevo» reinicia el ejercicio, y cambiar de
    fórmula también.

### Cambiado

- `toPlain` y `toTex` ponen paréntesis «de libro»: un operador binario dentro de otro binario distinto va siempre
  entre paréntesis, aunque la precedencia no los exija. Ahora se lee (p → q) ↔ (q → p) en lugar de p → q ↔ q → p,
  (p ∧ q) ∨ r en lugar de p ∧ q ∨ r y p ∨ (q ∧ r) en lugar de p ∨ q ∧ r. Con el mismo operador se mantiene la
  asociatividad (p ∧ q ∧ r, p → q → r) y ¬ no cambia. Afecta a la fórmula normalizada, a las cabeceras de la tabla, a
  las pistas y a cualquier texto de la biblioteca que use esas funciones; el analizador sigue leyendo igual todo lo
  que se imprime.

## [0.5.0] - 2026-10-27

### Añadido

- **Álgebra de Boole · Puertas y circuitos** (sección nueva del laboratorio, `?s=circuitos`):
  - **Circuito → función** («Comprueba tu respuesta»): la app dibuja uno de 8 circuitos originales de 2 a 6 puertas y
    escribes la función f(x, y, z…) con ⊕, ⊙, ′ y, si quieres, ⊻. Se comprueba por tabla de verdad y, si no coincide,
    se explica la primera fila en la que difieren, con una pista opcional que da el valor de cada cable en esa fila.
    Los cables intermedios llevan etiquetas A, B, C… que puedes usar en tu respuesta o comprobar una a una. La lectura
    del circuito y su forma mínima quedan detrás de «Ver la solución completa».
  - **Función → circuito** (visualizador): escribes una expresión y la app dibuja el circuito que sale de su árbol. Con
    «Solo NAND» o «Solo NOR» lo redibuja con una sola puerta universal y comprueba por tabla de verdad que calcula lo
    mismo.
  - **Las siete puertas**: OR, AND, XOR, NOT, NOR, NAND y XNOR con su símbolo ANSI (SVG propio que sigue al tema), su
    función en la notación de clase (XOR como ⊻ y XNOR como (⊻)′, también desarrolladas) y su tabla.
  - Los circuitos se dibujan por capas, con puntos de paso para los cables largos y un canal por señal entre columnas;
    si no caben, se desplazan dentro de su recuadro. Cada SVG lleva `role="img"` y un `aria-label` que lo describe como
    expresión.
- **Álgebra de Boole · Funciones Fₙ** (`?s=funciones`):
  - F₁ con los nombres de `content/notation` (Id, f, g, h): rellenas las tablas de ⊕ y ⊙ y la fila de ′ y la app las
    corrige; las tablas completas quedan detrás del aviso.
  - F₂: práctica «escribe una expresión» para un vector de verdad al azar (con la primera fila distinta si falla), la
    lista de las 16 funciones con su suma de productos mínima y su nombre habitual (constantes, proyecciones,
    complementos, OR, AND, XOR, XNOR, NAND, NOR, implicaciones y sus negaciones), y un botón que abre F₂ en el
    verificador.
  - Estructura predefinida **F₂** en «¿Es un álgebra de Boole?»: los 16 vectores de verdad con ⊕, ⊙ y ′ punto a punto
    (isomorfa a {0, 1}⁴), con su diagrama de Hasse de 16 elementos.
- Motores en `shared/boole/circuit.ts` (netlist y `validateNetlist` sin ciclos, con todo definido y una salida;
  `evaluateCircuit`, `circuitToExpression`, `circuitToPlain`/`circuitToTex` con ⊻, `circuitFromExpression`, `toNand`,
  `toNor`, `circuitLayers` y `layoutCircuit`) y `shared/boole/fn.ts` (`enumerateFn`, `fnOr`, `fnAnd`, `fnComp`,
  `fnExpression`, `fnName`, `listFn` y `fnStructure`), con sus tests, exportados también desde la entrada de la
  biblioteca junto con `CIRCUIT_PACK`.
- Contenido `content/boole/circuitos.ts` (CC BY 4.0, elaboración propia) con un esquema zod de netlist
  (`CircuitPackSchema`) que comprueba también que no hay ciclos y que la tabla de verdad de cada circuito coincide.
- `parseBoole(input, { xor: true })` acepta ⊻ (y ^) y lo desarrolla como a ⊙ b′ ⊕ a′ ⊙ b. Sin opciones se comporta
  como antes.

### Cambiado

- El selector de secciones del laboratorio de Boole tiene cuatro opciones y se reparte en dos filas en pantallas
  estrechas.
- El borrador de Boole (misma clave, `ia-labs.boole.v1`) pasa a la versión 2 del esquema: guarda también el circuito
  elegido, la expresión y el modo del visualizador y la función de F₂ que se practica. Los borradores de la versión 1
  se siguen leyendo y se completan con los valores por defecto.
- `PRESET_IDS` incluye `f2`, así que `BoolePack.presets` necesita su descripción.

### Corregido

- «Simplificar paso a paso»: «He terminado» ya no felicita si la expresión tiene el mínimo de literales pero aún
  sobra algo trivial (x ⊙ y ⊕ 0, x ⊙ 1, x ⊕ 1, x ⊙ 0, x ⊕ x, (x′)′ o 0′). Ahora contesta, por ejemplo, «Casi: aún
  puedes quitar el 0 con B3 (identidad): a ⊕ 0 = a.».

## [0.4.0] - 2026-10-27

### Añadido

- **Laboratorio «Álgebra de Boole»** (pestaña nueva tras Markov, en la app y en `LabsRoutes`), con la notación de
  clase: ⊕ suma, ⊙ producto y ′ complemento. También acepta +, ·, ∨, ∧, ¬, ~ y el producto por yuxtaposición (xy).
  - **¿Es un álgebra de Boole?** Estructuras finitas (B, ⊕, ⊙, ′, 0, 1) de hasta 16 elementos: {0, 1}, P(A) con
    |A| ≤ 3, {0, 1}ⁿ con n ≤ 3, divisores de n (6, 8, 12 y 30) con mcm, mcd y n/x, el producto de dos de ellas y una
    personalizada de hasta 4 elementos con tablas editables. Muestra las tablas de ⊕, ⊙ y ′ y el diagrama de Hasse
    del orden a ≤ b ⇔ a ⊕ b = b en SVG accesible. Modo «Comprueba tu respuesta» para B1–B5: marcas si cada axioma se
    cumple y, si no, das un contraejemplo; pistas progresivas tras un intento fallido y la solución completa (con el
    primer contraejemplo de cada axioma) detrás del aviso de integridad.
  - **Simplificar paso a paso.** Derivaciones línea a línea a partir de 13 expresiones originales o de una propia:
    cada paso se comprueba por tabla de verdad (con una fila donde difieren si no es equivalente) y se contrasta con
    la ley elegida (B1–B5, idempotencia, dominación, absorción, doble complemento, De Morgan y consenso) mediante
    reescritura sobre el árbol módulo conmutatividad y asociatividad. «Pista» lista las leyes aplicables y «He
    terminado» compara con la forma mínima (Quine–McCluskey) sin enseñarla.
- Motores puros en `shared/boole/` (`algebra.ts`, `expr.ts`, `laws.ts`, `rewrite.ts`, `minimize.ts`, `presets.ts`,
  `schema.ts`) con sus tests, exportados también desde la entrada de la biblioteca junto con `BooleLabPage` y
  `BOOLE_PACK`.
- Contenido `content/boole/practica.ts` (CC BY 4.0, elaboración propia) validado con zod.
- `parseFormula(input, options)` acepta `{ oplus: "or", juxtaposition: true }`. Sin opciones se comporta igual que
  antes: el laboratorio de lógica sigue leyendo ⊕ como ⊻.
- Clave `boole` en `DEFAULT_LABS_KEYS` (`ia-labs.boole.v1`) y opción `boole` en `createLocalStorageLabsAdapter`; si
  no se pasa, se usa la clave por defecto. El borrador viaja también en «Exportar mis datos».
- Símbolo nuevo en el diccionario: el orden ≤ de un álgebra de Boole.

### Cambiado

- La ficha «Axiomas del álgebra de Boole (B1–B5)» usa la numeración de clase: conmutativas, asociativas, identidad,
  distributivas y complementación.
- `FormulaField` y `SymbolKeypad` aceptan notación y teclas propias (por defecto, las de lógica).
- `LABS` incluye `boole`: una pestaña extra con id o ruta `boole` se ignora.

### Corregido

- CSP: zod ya no lanza su sonda `new Function` al cargar (se anotaba como `securitypolicyviolation` en todas las
  páginas). `z.config({ jitless: true })` pasa a `src/zod-config.ts`, importado el primero y declarado en
  `"sideEffects"`.

### Próximamente

- Álgebra de Boole: puertas y circuitos, y el espacio Fₙ.

## [0.3.0] - 2026-10-27

### Añadido

- **Uso como dependencia**: entrada de biblioteca `src/embed/index.ts` y mapa `exports` en `package.json` (`.`,
  `./shared/*`, `./content/*`, `./tokens.css`). Se instala desde el tarball de la etiqueta. Ver «Usar como
  dependencia» en el README.
- `LabsRoutes` acepta `extraTabs` (pestañas propias de la app anfitriona tras los tres laboratorios),
  `renderHeaderAction` y `basePath`. Las pestañas se resuelven respecto a la ruta donde está montada el área.
- `configureLabs({ storage })`: el borrador de Markov y el formato de las tablas de verdad pasan por un
  `StorageAdapter` que puede inyectar la app anfitriona (por defecto, localStorage con las mismas claves de siempre).
  `createLocalStorageLabsAdapter` permite elegir las claves.
- Se exportan las páginas (`SymbolsPage`, `LogicLabPage`, `MarkovLabPage`) y los motores de símbolos, lógica, Markov,
  racionales y SM-2.
- Prueba de consumidor (`tests/embed.test.tsx`) y paso de CI que compila un consumidor mínimo importando solo de
  `"ia-labs-comunidad"`.

### Cambiado

- `react`, `react-dom` y `react-router` pasan a `peerDependencies` (versión exacta) para que la app anfitriona tenga
  una sola copia de React; siguen en `devDependencies` para la app independiente.
- `package.json` declara `"sideEffects": ["*.css"]` para que el bundler descarte lo que no se usa.

## [0.2.0] - 2026-10-24

Primera versión publicada con las decisiones finales. Sustituye a las preliminares 0.1.0 y 0.1.1 del 23/10, que
usaban CC BY-SA y una frase de acceso: ambas desaparecen.

### Añadido

- Laboratorio de **Simbología**: diccionario con búsqueda, fichas KaTeX, «lectura en clase» con voz (Web Speech API) y
  equivalente en Python/NumPy como texto.
- Laboratorio de **Lógica**: tabla de verdad, comparar fórmulas, FND/FNC y explorador del espacio F₁.
- Laboratorio de **Markov**: racionales exactos, validador de matrices estocásticas, evolución, distribución
  estacionaria π y problema inverso.
- Modo **«Comprueba tu respuesta»** por defecto en tablas de verdad, comparación de fórmulas y Markov (vₙ, π, u₀), con
  pistas paso a paso; la solución completa queda detrás de «Ver la solución completa».
- Módulo opcional **Calendario**: lo próximo con cuenta atrás, lista por semanas con filtros, hora de España y tuya,
  aviso de cambio de hora, `.ics` suscribible (RFC 5545) y feed externo opcional en build (`CALENDAR_ICS_URL`).
- Módulo opcional **Flashcards** SM-2 con mazos del diccionario y mazos propios con KaTeX.
- Módulo opcional **Calculadora de notas** con mínimo de 5,0 por bloque y menciones, pesos con fuente citada y aviso
  «Orientativa, no oficial».
- `content/` con esquema genérico (materia, tema, nivel, idioma, autoría, licencia, fuente) validado con zod.
- Ajustes con tema claro/oscuro y «Exportar / Importar mis datos» (JSON versionado, máximo 2 MB).
- Persistencia local detrás de `StorageAdapter` (implementación con `localStorage`).
- Despliegue: `dist/` estático, Dockerfile (Node + `nginx:alpine`), `nginx.conf` con CSP estricta, HSTS,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Robots-Tag` y `.ics` como `text/calendar`; ejemplo para Apache.
- `noindex` en tres capas (meta, cabecera y `robots.txt`).
- CI: typecheck, tests, build, ESLint, `npm audit`, gitleaks, lychee y DCO. Dependabot mensual y agrupado.
- Enlace del calendario con clave (`CALENDAR_ICS_KEY`, solo en build): `calendario-<clave>.ics` para poder dejar pasar
  únicamente esos ficheros en el servidor; la app lee los nombres de `calendario.json`.

### Corregido

- Calendario: cada zona horaria muestra su propio día, y las ventanas de varios días (tests) muestran inicio y fin.

[Próximamente]: https://github.com/AglaDigSol/ia-labs-comunidad/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.6.0
[0.5.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.5.0
[0.4.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.4.0
[0.3.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.3.0
[0.2.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.2.0
