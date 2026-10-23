# Guía de contribución · IA Labs · Comunidad

Gracias por colaborar con este proyecto de estudiantes. Antes de enviar una propuesta o cambio, por favor revisa estas directrices.

---

## 1. Integridad académica y propiedad intelectual

Este proyecto es una iniciativa comunitaria de estudio independiente y **no oficial**. Está terminantemente prohibido subir o incluir:

- Enunciados o soluciones de actividades evaluables, entregables, foros calificados o exámenes (actuales o pasados).
- Material protegido con derechos de autor de la universidad o de docentes (diapositivas, manuales, transcripciones).
- Enlaces directos a recursos privados del campus virtual.

Todos los ejemplos, fórmulas y problemas precargados deben ser de **elaboración propia** o proceder de fuentes y libros de dominio público debidamente citados.

---

## 2. Developer Certificate of Origin (DCO)

Para garantizar la autoría del código y la compatibilidad de licencias, este proyecto exige el **DCO (Developer Certificate of Origin 1.1)**.

Cada commit debe incluir una firma `Signed-off-by` válida:

```bash
git commit -s -m "feat(modulo): descripción del cambio"
```

El pipeline de integración continua (CI) rechazará automáticamente cualquier Pull Request cuyos commits carezcan de esta firma.

---

## 3. Licencias

- **Código:** Todo el código fuente del proyecto se distribuye bajo la licencia **MIT**.
- **Contenido (`content/`):** Todo el contenido de símbolos, notación y asignaturas se publica bajo licencia **Creative Commons Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0)**. Cualquier adición a `content/` debe declarar explícitamente sus metadatos con `ContentMetaSchema`.

---

## 4. Textos e idiomas (i18n)

- El idioma principal de la interfaz es el español (`src/i18n/es.ts`).
- Los textos visibles de la aplicación deben centralizarse en los archivos de traducción para permitir su futura localización.
- No utilices lenguaje comercial, engañoso ni referencias a marcas ajenas.

---

## 5. Proceso de Pull Request

1. Crea una rama descriptiva para tu cambio: `git checkout -b feature/nombre-del-cambio`.
2. Asegúrate de que las comprobaciones locales pasen antes de enviar el PR:
   ```bash
   npm run typecheck
   npm run test
   npm run build
   ```
3. Utiliza la plantilla de Pull Request y marca la casilla de confirmación del DCO y de integridad académica.
