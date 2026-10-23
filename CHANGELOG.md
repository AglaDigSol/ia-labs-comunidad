# Registro de cambios (Changelog)

Todos los cambios notables de este proyecto se documentarán en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [Próximamente] - 0.2.0

### Planificado
- Modo interactivo «Comprueba tu respuesta» extendido con pistas guiadas en todos los laboratorios.
- Sistema ampliado de localización e internacionalización (i18n) con soporte para inglés.
- Nuevos módulos de simulación matemática y física.
- Adaptador de almacenamiento desacoplado (`StorageAdapter`) para sincronización comunitaria opcional.

---

## [0.1.0] - 2026-10-23

### Añadido
- **Modo de Integridad Académica («Comprueba tu respuesta»):**
  - Modo pedagógico interactivo en el Laboratorio de Lógica para clasificar fórmulas (tautología, contingencia o contradicción) con comprobación inmediata y pistas paso a paso.
  - Modo pedagógico interactivo en el Laboratorio de Markov para calcular manualmente la probabilidad del primer paso ($v_1$) con pistas guiadas.
  - Botón «Ver la solución completa» con aviso previo de integridad académica para contrastar resultados tras el desarrollo propio.
- **Laboratorio de Simbología:**
  - Diccionario interactivo de símbolos matemáticos y de inteligencia artificial.
  - Renderizado tipográfico preciso con KaTeX (`htmlAndMathml`).
  - Síntesis de voz accesible en español (`Web Speech API`) para practicar la lectura oral de fórmulas.
  - Equivalencias de notación y sintaxis estándar en Python (NumPy / SciPy).
- **Laboratorio de Lógica Proposicional:**
  - Generador de tablas de verdad con soporte para sintaxis simbólica y ASCII.
  - Comparador de equivalencia lógica entre fórmulas paso a paso.
  - Conversión a Formas Normales Disyuntiva y Conjuntiva (FND y FNC).
  - Explorador interactivo de compuertas y álgebra booleana (F₁).
- **Laboratorio de Cadenas de Markov:**
  - Aritmética racional exacta mediante números fraccionarios (sin errores de redondeo de punto flotante).
  - Validación de matrices estocásticas y distribuciones de probabilidad.
  - Evolución temporal paso a paso ($v_n = v_0 \cdot P^n$) con visualización tabular y gráfica.
  - Resolución exacta del vector estacionario ($\pi P = \pi$) y problema inverso ($u_0 P = v$).
- **Módulo de Flashcards con Repetición Espaciada (SM-2):**
  - Mazos temáticos precargados a partir del diccionario de símbolos.
  - Creación de mazos y tarjetas personalizadas con soporte para fórmulas matemáticas.
  - Algoritmo de planificación SM-2 para optimizar la retención a largo plazo.
- **Calculadora de Notas:**
  - Ponderación de calificaciones conforme a guías docentes citadas.
  - Cálculo de escenarios mínimos para aprobación y mención de honor con verificación de mínimos por bloque.
- **Ajustes y Privacidad:**
  - Persistencia 100% en el navegador (`localStorage`) sin envío de datos a servidores externos.
  - Exportación e importación de copias de seguridad en formato JSON con validación de esquema y límite de 2 MB.
  - Selector de tema visual (Claro, Oscuro y Sistema).
  - Configuración estricta de privacidad sin rastreadores ni analítica de terceros.
- **Licencia y Gobernanza:**
  - Contenido educativo unificado bajo licencia **Creative Commons Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0)**, conforme a decisión expresa de la titular.
  - Código fuente publicado bajo licencia de código abierto **MIT**.
  - Política de contribución mediante DCO (`Signed-off-by: Nombre <email>`) validada en CI.
- **Seguridad y CSP:**
  - Modo `jitless` configurado en Zod para eliminar sondas `eval`/`Function` en navegadores bajo CSP `script-src 'self'`.
  - `build.assetsInlineLimit: 0` en Vite para que las fuentes KaTeX (`woff2`) se emitan como archivos independientes y no como `data:` URI, garantizando compatibilidad total con `font-src 'self'`.
  - Configuración Nginx (`nginx.conf`) con herencia explícita de cabeceras de seguridad en todos los bloques `location`.
  - Monitorización automatizada de dependencias en raíz y `/tools/lint` mediante Dependabot.
