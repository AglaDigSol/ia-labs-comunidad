# Changelog

Todos los cambios relevantes de este proyecto se anotan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [Próximamente] (0.16)

- i18n completo: mover a `src/i18n/` los textos internos de los laboratorios, las flashcards, la calculadora y el
  calendario (hoy están en sus componentes) y añadir inglés.
- Registro de plugins completo para módulos de terceros (hoy `src/config.ts` es un registro sencillo con
  activar/desactivar).
- Sincronización opcional con cuentas sobre la interfaz `StorageAdapter`.

## [0.15.0] - 2026-11-10

### Añadido

- **Enlace «Guías de estudio»** junto al título «Laboratorios»: abre en otra pestaña unas guías que viven fuera de
  la app, así que se añaden o cambian sin publicar una versión nueva. En el sitio propio se fija con
  `VITE_GUIDES_URL` al construir (o `--build-arg VITE_GUIDES_URL=…`); una app anfitriona lo pasa con
  `<LabsRoutes guidesUrl="…" />`. Solo se aceptan direcciones https; vacía, no hay enlace.

## [0.14.1] - 2026-11-10

### Añadido

- **Simbología**: ⊭ (no es consecuencia lógica, con el contraejemplo de ∀ y ∨), la ley de dominación
  (a + 1 = 1, a · 0 = 0, que no es la absorción) y los símbolos de funciones de la Sesión 4: f: A → B (con
  inyectiva, sobreyectiva y biyectiva), la composición g ∘ f, la función inversa f⁻¹ y la imagen inversa f⁻¹(B).

### Cambiado

- Dependencias: katex 0.19.1, lucide-react 1.65.0 y react-router 8.5.1 (también como `peerDependency`: la app
  anfitriona debe usar 8.5.1).

## [0.14.0] - 2026-11-08

Dos revisiones del conjunto, una con ojos de estudiante (móvil, iPad, teclado) y otra con ojos de profesor (lo que se
corrige y cómo se explica).

### Añadido

- **Simbología**: notación de cálculo, combinatoria, probabilidad y álgebra lineal (sumatorio, productorio, integral,
  límite, derivada, factorial, número combinatorio, esperanza, varianza, O grande, Θ, ≈, :=, |x|, ≤/≥, producto
  escalar, norma, rango), con su lectura y su equivalente en Python/NumPy. La búsqueda encuentra los nombres de Python
  (`np.sum`, `math.factorial`, `itertools.combinations`…), con o sin paréntesis.
- **Laboratorios**: orientación en la primera visita (clave `labsIntro`); pestañas en otra fila en pantallas anchas y
  barra con degradado y flechas en las estrechas.
- **Ejercicios**: índice de temas, «Cambiar de tipo» vuelve al tema de donde se vino y «Practicar: <tipo>» como nombre
  accesible.
- **Python**: valor de la última expresión como en Jupyter (DataFrame y Series como texto, nunca HTML); avisos de stderr
  (caché de fuentes de matplotlib, `FutureWarning`) como aviso neutro; aviso y arreglo «Cambiar por comillas rectas»
  para “ ” y ‘ ’.
- **Opción múltiple**: un fallo explica por qué la opción elegida no vale, sin decir cuál es la buena.
- **Combinatoria**: el nivel avanzado de «Problema» siempre tiene varios pasos (complementarios, etapas, bloques), con
  la solución paso a paso. Los problemas avanzados cambian para las semillas de antes.
- **Formalizar**: una «v» suelta se lee como ∨.
- **Conjuntos**: el diagrama de Venn recuerda la expresión y los supuestos (clave `sets`).
- **Navegación**: «Saltar al contenido» y etiquetas en la barra inferior del móvil.
- `ia-labs-comunidad/vite`: el plugin `cspSafeRadix()` para la CSP estricta de una app anfitriona.

### Corregido

- **CSP**: los diálogos y selectores de Radix ya no insertan `<style>` en línea (resuelve la limitación conocida).
- **Complejidad**: «¿de qué orden es?» pide el orden exacto; una cota verdadera pero no ajustada da un aviso propio y
  junto a «Ninguna» no hay cotas mayores.
- **Conjuntos**: las relaciones se deciden con universo no vacío, y «solo fuera de A, B y C».
- **Lógica**: → y ↔ encadenados siempre entre paréntesis al escribirlos; tabla paso a paso legible en el móvil.
- **Combinatoria**: las pistas de «¿Qué modelo es?» ya no dan el nombre; un número de otro modelo se explica.
- **Python**: lo que el enunciado pide redondear se comprueba; «Precio con IVA» sin medios céntimos exactos; «¿Qué
  imprime?» nunca sale sin salida; `dividir(a, b)` explica el cociente con negativos; coma decimal en las comprobaciones
  de figuras; el paso a paso y la salida se llevan a la vista.
- **Simulacros**: la penalización solo resta en las de opción múltiple; en el de 01MIAR, las celdas sin contestar ya no
  listan cada requisito como «no cumplida».
- **Cálculo**: sin `1x` ni `−1x`; avisos de regla con su artículo; (x − 2)′ = 1 vale como derivadas elementales; ejemplo
  de función en los campos, no «p → q».
- **Álgebra**: «diagonalizable en ℝ» en las afirmaciones sobre matrices reales.
- **Probabilidad**: subíndices en TeX en el árbol y hojas más legibles en el móvil; «De estos».
- **Simbología**: buscar ≠ o ∉ ya no devuelve = o ∈.
- **Respuestas numéricas**: teclado con signo menos y «/» en el iPad; sin «Atajos de teclado» en pantallas táctiles;
  Notas sin autofoco y su fórmula en dos líneas.

## [0.13.0] - 2026-11-08

Dos sugerencias del grupo: rellenar las tablas de verdad sin tanto clic y dibujar que un conjunto está dentro de otro.

### Añadido

- **Rellenar con el teclado** las tablas de verdad («Paso a paso» y «Solo el resultado», también en «Ejercicios»), las
  instancias de predicados y «Cambiar su valor» del mapa de Karnaugh: `V`/`T`/`1` verdadero, `F`/`0` falso, `X`/`-`
  indiferencia (solo en Karnaugh), `Retroceso`/`Supr` vacía; flechas, `Inicio`/`Fin` y `Re Pág`/`Av Pág` (8 filas).
  Al escribir, el foco baja a la fila siguiente («Avanzar al escribir», encendido por defecto). Una sola parada del
  tabulador por tabla, `role="grid"` y el aviso «Atajos: V/F (o 1/0) para responder, flechas para moverte, Supr para
  borrar.» con el desplegable «Atajos de teclado». El ratón y el móvil, igual que antes; sin «rellenar todo».
- En el diagrama de Venn, `V`/`1` marca una región y `F`/`0`/`Supr` la desmarca.
- **Relaciones entre conjuntos** (`shared/sets/relations.ts`): ⊆, ⊂ o ⊊, ⊇, ⊃ o ⊋, =, ≠ y ⊈, con alternativas ASCII
  (`<=`, `<`, `>=`, `>`, `!=`, `subseteq`, `subset`…) y cadenas como ∅ ≠ A ⊆ B; se deciden por regiones del diagrama
  (siempre cierta, nunca cierta o depende) con contraejemplo.
- **«Supuestos» en el diagrama de Venn**: relaciones que se dan por ciertas (A ⊆ B, A ∩ C = ∅…); las regiones vacías
  por hipótesis llevan rayado cruzado, un ∅ y su nombre, y no cuentan al comprobar. Con dos conjuntos, «Dibujar
  anidados» (A dentro de B o B dentro de A), «Dibujar separados» (disjuntos) o un solo círculo (A = B), con los mismos
  nombres de región y el mismo teclado.
- **«Relaciones»** en «Comprobar una igualdad»: una relación (de práctica o escrita) con supuestos opcionales; tras
  responder, el contraejemplo dibujado. A × B ⊆ A ∪ B, como ejercicio fijo con su explicación.
- ⊆, ⊂, ⊇, = y ≠ en el teclado de símbolos de Conjuntos, y «Cómo escribir relaciones».
- Ejercicio **«Relaciones entre conjuntos»** en «Ejercicios → Conjuntos» (tres niveles, cuatro opciones a)–d): cuál es
  siempre cierta o siempre falsa con unos supuestos) y en el bloque «Conjuntos y funciones» del simulacro de 02MIAR.
- 15 relaciones de práctica en `content/conjuntos` (CC BY 4.0).
- Clave nueva de los laboratorios `gridAdvance` (`ia-labs.grid-advance` por defecto), incluida en «Exportar mis datos».
- API: el motor de relaciones (`parseSetRelation`, `parseSetHypotheses`, `checkRelation`, `analyzeHypotheses`,
  `nestedShape`…) se exporta con los demás de conjuntos.

### Cambiado

- Escribir una relación donde va una expresión (por ejemplo, A ⊆ B en «Escribir la mía») ya no dice «No reconozco
  «⊆»»: explica que «A ⊆ B es una relación (verdadera o falsa), no un conjunto» y dónde se usan las relaciones.

## [0.12.0] - 2026-11-05

### Añadido

- **Simulacro de examen (01MIAR)** en `…/python/simulacro` (con el módulo Python; botón en la pestaña Python y tarjeta
  en «Ejercicios → Python (01MIAR)»): el final de «Python para la IA» como cuaderno.
  - Cuatro ejercicios cortos de 1,25 puntos y un proyecto de datos de 5 puntos por pasos (ventas o incidencias,
    alternados con la semilla), con celdas «Tu solución AQUÍ» y «Test Use Case» a la vista.
  - Kernel compartido como en Jupyter («Ejecutar celda», «Ejecutar todo», «Reiniciar kernel»), tablas de pandas como
    tabla de texto, figuras y reloj de 2 h que sobrevive a recargar, con entrega automática a 0.
  - Al entregar se corrige con pruebas ocultas: proporcional y redondeado a 0,25, y un error arrastrado no cuenta dos
    veces. Se ve lo que hizo tu código, tus figuras, la solución tras «Ver la solución completa» y «Practicar este
    tipo».
  - «Descargar como .ipynb» (nbformat 4.5, en blanco o con tus respuestas) y «Descargar los datos (.csv)».
- **Ejercicios de Python de 01MIAR, temas 6 a 13** (y dos de examen de los temas 3 y 4): Encuentra el bug, En una
  línea, Clases y objetos, Python avanzado, NumPy: matrices y máscaras, Sistemas con NumPy, pandas (fechas y cadenas,
  agrupar y pivotar, combinar, valores perdidos, limpiar y convertir), Gráficos con requisitos y Generadores, con tres
  niveles y el chip de su tema.
- Conjuntos de datos sintéticos y deterministas (`shared/pydata`): ventas sucias, incidencias con su tabla de países,
  sensores con huecos y tablas pequeñas, con los hechos de cada paso de la limpieza.
- El banco de pruebas compara tablas de pandas, series y arrays con tolerancia y dice por qué no coinciden (siempre con
  lo tuyo); comprueba generadores, «en una línea», firmas y clases; y mira la figura de matplotlib y seaborn (número de
  gráficos, figsize, tipo, alturas de las barras para `estimator="sum"`, puntos, líneas, leyenda, títulos y ejes), que
  además se enseña.
- Clave nueva de los laboratorios `pyexam` (`ia-labs.pyexam.v1` por defecto), incluida en «Exportar mis datos».
- API: `PyExamPage` y `shared/pyexam` (`buildPyExam`, `pyExamNotebookJson`, `scoreShort`, `scoreStep`…), los tipos
  `PyCheck` y `PyCompareOptions`; props `examPath` en `PythonLabPage` y `pyExamPath` en `ExercisesPage`.

### Cambiado

- El banco de pruebas de Python ya no sigue línea a línea el código de las bibliotecas (pandas va mucho más rápido) y
  carga los paquetes del ejercicio antes de comprobar.
- CI: Python 3.12 con numpy 2.0.2, pandas 2.2.3, matplotlib 3.8.4 y seaborn 0.13.2 antes de vitest; las pruebas con
  python3 ya no se saltan.

### Corregido

- La cabecera fija del simulacro de 02MIAR queda pegada a la de la app en el móvil.
- El paso a paso ya no vuelve al paso 1 si se pulsa «Siguiente paso» justo al abrirlo.

## [0.11.0] - 2026-11-04

### Añadido

- **Simulacro de examen (02MIAR)** en «Ejercicios» (`…/ejercicios/simulacro`, sin pestaña nueva): completo (20
  preguntas · 2 h), rápido (10 · 1 h) o por temas, con preguntas generadas por el banco (44 tipos): opción múltiple
  a)–d) con una correcta y respuestas numéricas con coma y redondeo a dos decimales, como en el examen.
  - Reloj que no se para y sobrevive a recargar, avisos accesibles cada 15 minutos y a los 5, entrega automática a 0,
    navegador con preguntas marcadas para revisar y penalización opcional (−1/3 por fallo).
  - Resultados con nota, desglose por temas, la solución de cada pregunta y «Practicar este tipo»; historial,
    impresión, y configuración y semilla en la URL.
- **Combinatoria** (pestaña nueva, entre «Conjuntos» y «Álgebra de Boole»): «¿Qué fórmula es?» con guía para decidir
  (¿importa el orden?, ¿se repiten?, ¿se usan todos?), modelo (Pₙ, PR, V, VR, C, CR) y número comprobados;
  «Calculadora guiada»; «Funciones y cardinales» (puede / necesariamente inyectiva, sobreyectiva, biyectiva o
  invertible; A ⊊ B); «Complejidad» (O grande de pseudocódigo y de costes, con la trampa de la constante dentro de la
  O) y verdadero o falso sobre P, NP y NP-completo.
- **Probabilidad** (pestaña nueva, entre «Cálculo» y «Markov»): árbol de probabilidad total y Bayes que se rellena
  casilla a casilla, tabla de contingencia 2×2, condicionada con un dado, independencia, explorador de distribuciones
  discretas (Bernoulli, binomial, geométrica, Poisson y uniforme) con práctica por historias, juegos con dados o
  monedas trucados, penalización por fallo en un test, E[XY] con independientes y simulación con semilla. Las
  respuestas se corrigen como en el examen: fracción exacta o redondeadas a dos decimales con coma.
- **Cálculo**: sección «Límites y continuidad» (funciones a trozos, L'Hôpital, dominio y bisección); «Regla de la
  cadena» (también con la matriz jacobiana) y «Críticos tipo test»; «Por partes» en «Integrales»; «¿Adónde converge?»
  en «Descenso de gradiente».
- **Álgebra lineal**: sección «Propiedades y teoría» (propiedades del determinante, verdadero o falso sobre matrices y
  vectores, normas y sistemas tipo test) y, en «Tensores», el vocabulario del curso: rango (número de índices, `ndim`)
  y dimensión (lo que mide cada índice, `shape`), que no es el rango de una matriz.
- **Ejercicios**: temas «Combinatoria y complejidad» y «Probabilidad»; trece tipos de teoría de cálculo y álgebra
  lineal; «Formalizar un enunciado», «Negar en lenguaje natural» y «Predicados sobre conjuntos numéricos».
- Respuestas numéricas como en el examen: coma decimal, sin separador de miles y redondeo a dos decimales cuando se
  pide, con avisos si se escribe un punto o se trunca.
- Componente reutilizable de preguntas de opción múltiple (`ChoiceOptions`, `ChoicePractice`) y `NumericField`.
- Clave nueva de los laboratorios `exam` (`ia-labs.exam.v1` por defecto), incluida en «Exportar mis datos».
- API: `CombinatoricsLabPage`, `ProbabilityLabPage`, `ExamSimulatorPage`, los motores `shared/discrete`,
  `shared/probability` y `shared/exam`, y los contenidos `COMB_PACK` y `PROB_PACK` (CC BY 4.0). `ExercisesPage` acepta
  `examPath`.

### Cambiado

- Orden de las pestañas: Simbología, Lógica, Predicados, Conjuntos, Combinatoria, Álgebra de Boole, Álgebra lineal,
  Cálculo, Probabilidad, Markov y Ejercicios (y Python, si está encendida). `combinatoria` y `probabilidad` quedan
  reservados como identificadores.

## [0.10.0] - 2026-11-03

### Añadido

- **Cálculo** (pestaña nueva, entre «Álgebra lineal» y «Markov»):
  - Derivadas paso a paso: escribes cada línea, con (u)′ para lo que aún no has derivado, y eliges la regla (suma,
    factor constante, producto, cociente, potencia, cadena o derivadas elementales, u «Operar y simplificar»). Cada
    línea se comprueba en muchos puntos y se avisa si la regla no encaja o si aplicas varias a la vez; las pistas
    dicen qué regla toca a cada derivada pendiente, nunca el resultado. También «Solo el resultado».
  - Recta tangente y gráfica: f y f′ dibujadas, el punto (x₀, f(x₀)) y tu recta encima; se piden f(x₀), la pendiente
    y la ecuación.
  - Integrales: primitivas comprobadas derivándolas (vale cualquier forma, con + C o sin ella), integrales
    definidas (exactas o con tres decimales) y rectángulos de Riemann (izquierda, derecha y punto medio).
  - Varias variables: derivadas parciales y gradiente en un punto sobre las curvas de nivel con flechas del
    gradiente, y puntos críticos clasificados con la hessiana (mínimo, máximo, silla), dibujados con su forma.
  - Descenso de gradiente: simulador en una y dos variables (α, punto de partida, iteraciones; simple, con momento
    o Adam) con la cuadrática, el valle alargado, Rosenbrock, varios mínimos y el punto de silla, la tabla de las
    primeras iteraciones y qué ha pasado (converge, oscila, diverge); y los primeros pasos a mano, con las ideas
    clave al acertar.
  - Las funciones se escriben como en clase: 2x, 3(x + 1), x y, sen x, e^x, ln x, sqrt(x), |x|, x² o x**2; debajo se
    ve cómo se han leído, y los errores dicen dónde.
- **Ejercicios · «Cálculo»**: siete tipos y tres niveles (derivada por reglas, recta tangente, primitiva, integral
  definida, parciales y gradiente, puntos críticos con la hessiana y pasos de descenso de gradiente), con números
  cómodos.
- API: `CalculusLabPage`, el motor `shared/calculus` (`parseCalcExpr`, `derivative`, `gradient`, `hessian`,
  `checkDerivStep`, `derivationSteps`, `calcEquivalent`, `checkAntiderivative`, `definiteIntegral`, `riemannSum`,
  `criticalPoints`, `runDescent`, `exactDescentSteps`…), `CALC_EXERCISES` y `CALC_PACK` (CC BY 4.0).

### Cambiado

- Orden de las pestañas: Simbología, Lógica, Predicados, Conjuntos, Álgebra de Boole, Álgebra lineal, Cálculo,
  Markov, Ejercicios y, si está encendida, Python. `calculo` queda reservado como identificador.

## [0.9.0] - 2026-11-03

### Añadido

- **Álgebra lineal** (pestaña nueva, entre «Álgebra de Boole» y «Markov»):
  - Gauss-Jordan paso a paso: eliges cada operación elemental (Fᵢ ↔ Fⱼ, Fᵢ ← k·Fᵢ, Fᵢ ← Fᵢ + k·Fⱼ) o escribes la
    matriz siguiente, y se comprueba antes de seguir; luego clasificas el sistema con Rouché–Frobenius y escribes su
    solución, también paramétrica.
  - Producto, determinante, rango e inversa celda a celda; independencia lineal y bases; autovalores y autovectores
    (Av = λv, se acepta cualquier múltiplo).
  - Transformaciones del plano dibujadas, con sus direcciones propias y el determinante como área, y «¿Qué matriz
    es?».
  - Formas de tensores con las reglas de NumPy (emisión, @, sum, reshape y .T), con la explicación por eje.
  - Todo con fracciones exactas; las soluciones, tras «Ver la solución completa».
- **Ejercicios · «Álgebra lineal»**: ocho tipos y tres niveles (Gauss-Jordan, determinante, producto, inversa,
  sistemas, independencia, autovalores y formas de tensores), con números cómodos y autovalores enteros.
- **Ejercicios · «Python (01MIAR)»** (solo con la pestaña Python encendida): nueve tipos y tres niveles con 33
  plantillas (tipos y operadores, cadenas, colecciones, control, comprensiones, funciones, recursión y lambdas,
  ficheros y CSV) y «¿Qué imprime?».
  - Se corrigen en el navegador con Pyodide: «Caso k: correcto / incorrecto» con la llamada y lo que hizo tu código,
    nunca el valor esperado; requisitos comprobados con `ast`; pistas graduadas sin código; la solución, tras «Ver la
    solución completa».
  - En el tema 5 los archivos de cada caso se escriben con la API de archivos.
- **Pestaña Python · «Ejecutar paso a paso»** (como Python Tutor): la línea actual, la pila de llamadas con sus
  variables y alias («misma lista que x»), lo que devuelve cada función y la salida hasta ese paso; límites de 2000
  pasos, 10 000 caracteres y 5 s. También tras fallar un «¿Qué imprime?».
- API: `LinearAlgebraLabPage`, el motor `shared/linalg` (`parseMatrix`, `rref`, `matrixInverse`, `analyzeSystem`,
  `eigenvalues`, `broadcastShapes`, `tensorOpResult`…), `LINALG_EXERCISES`, `LINALG_PACK` (CC BY 4.0),
  `PYTHON_EXERCISES`, `PY_CODE_TYPES`, `PY_OUTPUT` y `PY_TEMAS`. `ExercisesPage` admite `python`, y
  `exerciseType`, `exercisesOfTopic`, `exerciseTopics` y `mixedType` reciben los módulos encendidos. `PyClient.run`
  admite `{ capture, imports }`.

### Cambiado

- Orden de las pestañas: Simbología, Lógica, Predicados, Conjuntos, Álgebra de Boole, Álgebra lineal, Markov,
  Ejercicios y, si está encendida, Python. `algebra-lineal` queda reservado como identificador.
- Sin Python, los ejercicios de Python no van en el build (check-python lo comprueba).

## [0.8.1] - 2026-11-03

### Añadido

- Python: una app anfitriona puede escribir archivos en la carpeta de trabajo, con carpetas (`res/datos.csv`,
  `img/tema/x.png`) y de cualquier tipo (`.py`, `.txt`, modelos binarios…), para que `pd.read_csv("res/datos.csv")`,
  `open(…)` o `exec(open("res/programa.py").read())` funcionen. Viven solo en memoria, se vuelven a escribir tras un
  reinicio de Python y «Vaciar archivos» los borra; escribir un archivo nunca lo ejecuta.
  - Ranuras: `renderDraftActions` (en la banda del borrador abierto, también en los de archivo) y
    `renderFilesActions` (en la cabecera de «Archivos», con o sin borrador), por `configureLabs({ python })` o como
    props de `PythonLabPage`, que mandan. Reciben `{ draft, files: { writeFiles, limits, list } }`.
  - `writeFiles([{ path, data }])` devuelve `{ written, skipped }`; cada descartado lleva su motivo (`name`, `size`,
    `total` o `count`) y un mensaje en español. Las rutas se rechazan, sin arreglarlas, si son absolutas, salen de la
    carpeta (`..`), tienen partes vacías, `.`, barras invertidas, caracteres de control, punto inicial o son
    demasiado largas o profundas (`safeFilePath`).
  - Límites configurables: `configureLabs({ python: { maxTotalBytes, maxFileBytes, maxFiles } })`, por defecto
    50 MB, 20 MB y 30 archivos (`MAX_TOTAL_BYTES`, `MAX_FILE_BYTES`, `MAX_FILES`) y como mucho 200 MB, 50 MB y 500
    (`CAP_*`); `fileLimits()` da los efectivos. Cuentan los archivos subidos y los del anfitrión juntos.
- Borradores: `origin.source` opcional (`{ kind, path }`, por ejemplo `{ kind: "repo", path: "notebooks/tema1.ipynb" }`)
  para que la app anfitriona sepa de qué archivo viene; llega a las ranuras. Los borradores anteriores siguen valiendo.
- «Archivos»: la lista muestra también lo que hay en carpetas (`res/datos.csv`), descarga los archivos anidados con
  su nombre y tiene «Borrar» en cada uno. El texto dice los límites efectivos.
- `scripts/e2e-python.ts` prueba además una app anfitriona mínima (`tests/e2e-host/`) que escribe archivos desde la
  ranura del borrador y los lee con pandas, también tras reiniciar Python.

### Cambiado

- `PYODIDE_VERSION` y `PYODIDE_PYTHON` viven en `version.ts`: la configuración, que entra con `configureLabs` en el
  chunk de entrada de la app anfitriona, ya no arrastra la lista de wheels extra (unos 2 KB), que se queda en el chunk
  perezoso de la pestaña. `scripts/check-python.ts` falla si un wheel extra aparece en el grafo de entrada.

## [0.8.0] - 2026-11-02

### Añadido

- **Python** (pestaña opcional, tras «Ejercicios», apagada por defecto): Python 3.12.7 en el navegador con Pyodide
  0.27.7, en un worker. Se enciende con `LABS_PYTHON=1 npm run build`, `--build-arg LABS_PYTHON=1` en Docker o
  `python: true` en `config.modules`; apagada no hay pestaña, ni ruta, ni chunk, ni archivos de Pyodide en `dist/`.
  - Editor con plantillas genéricas de 01MIAR (tipos de datos, control de flujo, funciones, generadores, ficheros,
    NumPy básico, vectorización, Min-Max, limpieza con pandas, pandas con tu CSV, gráficos con seaborn y
    PerceptronSimple), límite de ejecución y «Detener» (interrumpe con aislamiento entre orígenes; si no, reinicia).
  - Gráficos de matplotlib debajo de la salida, con «Descargar PNG».
  - Paquetes bajo demanda: los de Pyodide (numpy, pandas, matplotlib, scipy, scikit-learn, statsmodels, OpenCV,
    nltk, Pillow, BeautifulSoup, lxml, wordcloud, pytest…) al importarlos, y seaborn, folium, branca e ipytest con
    micropip desde el propio sitio. `import cv2` es lo único que descarga OpenCV.
  - Archivos: «Subir archivo» (CSV, TSV, TXT, JSON, MD e imágenes; 20 MB cada uno y 50 MB en total) a la carpeta de
    trabajo, para `open("datos.txt")` o `pd.read_csv("datos.csv")`; descarga de lo que escribe el código y «Vaciar
    archivos». Nada sale del navegador.
  - Órdenes mágicas `%time`, `%timeit`, `%%time`, `%%timeit` y `%matplotlib inline`; las demás dan un error que las
    nombra. «Entrada para input()».
  - Avisos en español: sin internet («Este entorno no accede a internet: descarga el archivo y súbelo con «Subir
    archivo»»), TensorFlow, Keras, PyTorch, JAX o PyTomography («… no funciona en el navegador. Usa Google Colab o un
    entorno local con Python 3.12») y paquetes no incluidos.
  - Borradores de «Abrir en Python» (`?borrador=`) para apps anfitrionas: se abren en el editor y nunca se ejecutan
    solos.
- Build: `scripts/vendor-pyodide.ts` publica Pyodide en `dist/pyodide/0.27.7/` (unos 110 MB) con tamaño y SHA-256
  comprobados contra el manifiesto, `pyodide-lock.json` y los wheels fijados de PyPI; si algo no cuadra o no hay red,
  el build falla. `scripts/check-python.ts` comprueba que Pyodide no entra en el chunk de entrada.
  `scripts/e2e-python.ts` (fuera de la CI) lo prueba en Chromium con las cabeceras de despliegue.
- Despliegue: el worker de Python recibe su propia CSP con `'wasm-unsafe-eval'` (`deploy/security-headers-wasm.conf`
  y `FilesMatch` en Apache); la del documento no cambia. `/pyodide/` con `application/wasm` y caché inmutable.
- API pública: `LabsRoutes` acepta `python`; `configureLabs({ python: { assetBaseUrl, draftsKey,
  crossOriginIsolated } })`; `PythonLabPage`, `PYTHON_LAB`, `createDraft`, `getDraft`, `listDrafts`, `draftLabel`,
  `PYODIDE_VERSION`, `PYODIDE_CORE`, `PYODIDE_PACKAGES` y `EXTRA_WHEELS`. Nueva clave `python` en
  `DEFAULT_LABS_KEYS` (`ia-labs.python.v1`).

### Cambiado

- Con la pestaña Python encendida, `python` queda reservado como id y como ruta: una pestaña extra de una app
  anfitriona con ese id o esa ruta se descarta. Apagada, sigue funcionando como en 0.7.
- Dependencia nueva: `pyodide` 0.27.7 (la última con Python 3.12; Dependabot no la sube).

### Corregido

- Una ruta desconocida dentro de Laboratorios (`/laboratorios/zzz`) redirige a Simbología una sola vez, en lugar de
  alargar la URL sin fin.
- Los selectores con muchas opciones se desplazan dentro de la lista en lugar de salirse de la pantalla.

## [0.7.0] - 2026-10-29

### Añadido

- **Predicados** (pestaña nueva, tras «Lógica»): lógica de predicados de primer orden.
  - «Evaluar en un dominio»: dominio finito (hasta 5 elementos) con la extensión de cada predicado en casillas
    (columnas para P(x), rejilla x × y para R(x, y)), variables libres y ligadas, y «Comprueba tu respuesta» paso a
    paso por instancias, de dentro hacia fuera, con testigo o contraejemplo para ∀ falsa y ∃ verdadera.
  - «Negar paso a paso»: ¬∀, ¬∃, De Morgan, ¬(p → q), ¬(p ↔ q) y doble negación, una ley por línea, comprobada por
    equivalencia en el dominio y sobre el árbol; termina con ¬ solo delante de átomos. Las pistas nombran la ley.
  - «Traducir»: frases con glosario comparadas con una traducción de referencia en dominios de 1 a 4 elementos.
- **Conjuntos** (pestaña nueva, tras «Predicados»):
  - Diagrama de Venn de 2 o 3 conjuntos: sombreas las regiones de una expresión (∪, ∩, ∖, Δ, Aᶜ, ∅, U) y
    «Comprobar» señala las regiones mal sin revelar la respuesta; cada región es accesible con teclado y se nombra
    como «A ∩ Bᶜ ∩ C». Modo «Con elementos» para calcular el conjunto resultado.
  - Igualdades: demostración paso a paso con una ley por línea, comprobada por regiones y por reescritura, y «¿Son
    iguales?», con la región contraejemplo después de responder.
  - Cardinales e inclusión–exclusión con problemas de enunciado de elaboración propia (dos y tres conjuntos).
  - Conjunto de partes y producto cartesiano, corregidos como conjuntos, sin importar el orden.
- **Álgebra de Boole · «Karnaugh y formas canónicas»**: ejercicios propios de 2, 3 y 4 variables, o una expresión, un
  vector de verdad (con X) o un mapa en blanco.
  - «Σm y ΠM»: escribes las listas de mintérminos y maxtérminos y, si quieres, las formas canónicas; «Comprobar» dice
    qué índices sobran y cuántos faltan, sin decir cuáles.
  - «Mapa de Karnaugh»: ejes en código Gray; agrupas los 1 (suma de productos) o los 0 (producto de sumas) en
    rectángulos de 1, 2, 4, 8 o 16 celdas que pueden dar la vuelta. «Comprobar» avisa si falta algo por cubrir o si
    hay una agrupación más simple, sin enseñarla. Navegable con flechas, con etiquetas por celda y grupos
    distinguidos por número y estilo de borde.
- **Ejercicios** (pestaña nueva, la última del área): banco de ejercicios generados al momento por tema y nivel
  (básico, medio, avanzado), con catorce tipos: tabla de verdad paso a paso, clasificar, ¿son equivalentes?, FND y
  FNC; evaluar en un dominio y negar paso a paso; sombrear en el diagrama de Venn, ¿son iguales?, demostrar una
  igualdad, inclusión–exclusión y partes y producto; Σm y ΠM, mapa de Karnaugh y simplificar con leyes.
  - Cada ejercicio usa la práctica de su laboratorio (corrige sin dar la respuesta; la solución, tras «Ver la
    solución completa»), va en la URL (`?t=&n=&s=`) para compartirlo o repetirlo, y hay «Siguiente ejercicio»,
    «Mezclar» por tema y contador de la sesión.
  - Progreso por tipo y nivel en la clave `exercises` de `DEFAULT_LABS_KEYS` (`ia-labs.exercises.v1`), también en
    «Exportar mis datos».
- API pública: `PredicatesLabPage`, `SetsLabPage`, `ExercisesPage`, los motores de `shared/predicates`,
  `shared/sets`, `shared/boole/canonical.ts`, `shared/boole/karnaugh.ts` y `shared/exercises`, y los contenidos
  `PREDICADOS_PACK`, `SETS_PACK` y `KARNAUGH_PACK` (CC BY 4.0).

### Cambiado

- Orden de las pestañas, como en clase: Simbología, Lógica, Predicados, Conjuntos, Álgebra de Boole, Markov y
  Ejercicios. Las pestañas extra de una app anfitriona van después; `predicados`, `conjuntos` y `ejercicios` quedan
  reservados como identificadores.
- `minimalSOP` y `minimalPOS` aceptan indiferencias (X); `implicantProduct` e `implicantSum` pasan a ser públicas.
- El borrador del laboratorio de Boole pasa a la versión 3; los de las versiones 1 y 2 se siguen leyendo.
- Las prácticas de los laboratorios aceptan un enunciado dado y avisan al resolverse (`onSolved`); los laboratorios
  no cambian.

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

[Próximamente]: https://github.com/AglaDigSol/ia-labs-comunidad/compare/v0.15.0...HEAD
[0.15.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.15.0
[0.14.1]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.14.1
[0.14.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.14.0
[0.13.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.13.0
[0.12.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.12.0
[0.11.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.11.0
[0.10.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.10.0
[0.9.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.9.0
[0.8.1]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.8.1
[0.8.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.8.0
[0.7.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.7.0
[0.6.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.6.0
[0.5.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.5.0
[0.4.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.4.0
[0.3.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.3.0
[0.2.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.2.0
