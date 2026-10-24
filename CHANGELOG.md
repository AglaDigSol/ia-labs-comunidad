# Changelog

Todos los cambios relevantes de este proyecto se anotan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [Próximamente] (0.2)

- Modo «Comprueba tu respuesta» también para las formas normales (FND/FNC): hoy quedan dentro de «Ver la solución
  completa», sin ejercicio propio.
- i18n completo: mover a `src/i18n/` los textos internos de los laboratorios, las flashcards, la calculadora y el
  calendario (hoy están en sus componentes) y añadir inglés.
- Registro de plugins completo para módulos de terceros (hoy `src/config.ts` es un registro sencillo con
  activar/desactivar).
- Sincronización opcional con cuentas sobre la interfaz `StorageAdapter`.
- Evitar los `<style>` que insertan los diálogos y selectores de Radix, para no generar avisos de CSP.

## [0.1.0] - 2026-10-24

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

[Próximamente]: https://github.com/AglaDigSol/ia-labs-comunidad/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/AglaDigSol/ia-labs-comunidad/releases/tag/v0.1.0
