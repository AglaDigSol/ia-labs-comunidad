# Cómo contribuir

¡Gracias por ayudar! IA Labs · Comunidad lo mantienen estudiantes para estudiantes. Antes de abrir un PR, lee las
reglas de integridad académica: son lo más importante de este documento.

## Integridad académica

La regla de oro es **comprobar y entrenar, no resolver**.

- **No subas enunciados ni soluciones** de actividades, exámenes, tests, foros o entregables de la VIU, ni actuales ni
  pasados. Tampoco «adaptaciones» que permitan reconocerlos.
- **No subas preguntas reales de examen** ni de tests evaluables.
- **No copies material del curso**: diapositivas, apuntes del profesorado, guías docentes o cualquier texto literal.
  Los datos objetivos (pesos de evaluación, fechas) se citan indicando la fuente, sin copiar el texto.
- **Los ejemplos tienen que ser originales.** Si un ejemplo de Markov, de lógica o una tarjeta se parece a una actividad
  evaluable, cámbialo.
- Las herramientas nuevas siguen el modo «Comprueba tu respuesta»: la persona introduce su resultado, la app lo
  verifica y da pistas; la solución completa queda detrás de «Ver la solución completa».
- Nada de datos personales: ni nombres de docentes o compañeros, ni correos, ni enlaces del campus.

Un PR que no cumpla esto se cierra sin fusionar.

## Firma de los commits (DCO)

Cada commit debe llevar una línea `Signed-off-by` ([Developer Certificate of Origin](https://developercertificate.org/)):

```sh
git commit -s -m "Añade el símbolo de la traza"
```

Con esa firma declaras que el contenido es tuyo (o que tienes derecho a aportarlo) y que aceptas publicarlo bajo la
licencia **MIT** (código) y **CC BY 4.0** (todo lo que está en `content/`). La CI rechaza los PR con algún commit sin
firmar. Si se te olvidó: `git rebase --signoff main` y `git push --force-with-lease`.

## Añadir contenido

Todo el contenido vive en `content/` y se valida con esquemas zod en `tests/content.test.ts` y
`tests/calendar.test.ts`. Si el test falla, su mensaje dice qué campo corregir. Cada paquete lleva metadatos genéricos:
materia, tema, nivel, idioma, autoría, licencia (`CC-BY-4.0`) y fuente.

### Un símbolo

1. Abre el fichero del bloque en `content/symbols/` (por ejemplo `logica.ts`).
2. Añade una entrada con `sym({ … })`:
   - `id` en `minusculas-con-guiones`, único;
   - `category`, `session`, `name`, `tex` (TeX de KaTeX, con `` T`…` `` para no duplicar las barras);
   - `reading`: cómo se lee en clase; `spoken`: lo mismo **solo con palabras** (la voz no sabe leer símbolos);
   - opcional: `aliases`, `variants`, `example`, `code` (equivalente en Python/NumPy como texto) y `related`.
3. Ejecuta `npx vitest run tests/content.test.ts`.

Para un bloque nuevo, crea un fichero junto a los demás y regístralo en `content/symbols/index.ts` con sus metadatos.

### Una asignatura (calculadora de notas)

1. Copia `content/courses/01MIAR.ts` con el código de la asignatura.
2. Rellena los componentes: los pesos tienen que sumar 100 % y debe haber exactamente un examen.
3. Cada peso lleva `source`: título de la guía docente, curso académico y fecha de comprobación. **Sin URL del campus.**
4. Añádela a `content/courses/index.ts`.

### Eventos del calendario

Edita `content/calendario/2026-27.ts`. Las horas son hora de pared de España (`"2026-10-28T20:00"`). Usa `grupo` o
`franja` solo para prácticas o exámenes con varias opciones, y sube `revision` si cambias la hora de un evento que ya se
publicó (los calendarios suscritos lo actualizarán).

### Un circuito (álgebra de Boole)

1. Abre `content/boole/circuitos.ts` y añade un objeto con `id`, `title`, `level`, `inputs` (de 2 a 4 variables de una
   letra), `gates` (de 2 a 6 puertas `{ id: "g1", type, inputs }`, con `type` = `or`, `and`, `xor`, `not`, `nor`,
   `nand` o `xnor`), `output` (la puerta que da f) y `table` (la columna f de la tabla de verdad, de `00…0` a `11…1`).
2. Dibújalo tú: nada de circuitos copiados de diapositivas, apuntes ni actividades.
3. Ejecuta `npx vitest run tests/content.test.ts`: comprueba que no hay ciclos, que todo está definido y que `table`
   coincide con lo que calcula el circuito.

### Una plantilla nueva de laboratorio o un módulo

Los módulos se registran en `src/config.ts` (id, ruta, navegación, componente perezoso y contenido que usa). Copia la
estructura de un laboratorio existente en `src/features/labs/`, pon la lógica pura en `shared/` con sus tests y respeta
el modo «Comprueba tu respuesta» (`src/components/practice/SolutionGate.tsx`).

## Estilo de código

- TypeScript estricto, React 19 con componentes de función y Tailwind v4 con los tokens de `src/styles/tokens.css`.
- Imports con extensión explícita (`./x.ts`, `./y.tsx`).
- La lógica pura (sin React ni DOM) va en `shared/`; los datos, en `content/`.
- Textos de la interfaz en español. Los textos de la shell, la navegación y Ajustes están en `src/i18n/es.ts`.
- Accesibilidad: todo usable con teclado, contraste AA, nada de scroll horizontal a 390 px y KaTeX con `htmlAndMathml`.
- Sin dependencias nuevas sin hablarlo antes en un issue. Nada de analítica, CDN ni recursos de terceros.
- Todo acceso a `localStorage` va en try/catch.

## Antes de abrir el PR

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run lint:install && npm run lint
npm run build
```

## Lista de comprobación del PR

- [ ] Todos los commits llevan `Signed-off-by` (DCO).
- [ ] No hay enunciados, soluciones ni preguntas reales de actividades o exámenes, ni material copiado del curso.
- [ ] Los ejemplos son originales.
- [ ] No hay datos personales (nombres, correos, enlaces del campus).
- [ ] Typecheck, tests, lint y build en verde.
- [ ] Si toca la interfaz: funciona con teclado y a 390 px.
- [ ] Si añade contenido: metadatos y fuente rellenos.
