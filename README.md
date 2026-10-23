# IA Labs · Comunidad

Plataforma comunitaria de laboratorios interactivos y herramientas de estudio para estudiantes del Máster Universitario en Inteligencia Artificial.

Este proyecto es una iniciativa independiente y de código abierto desarrollada por estudiantes. **No es oficial ni está afiliado a la Universidad Internacional de Valencia (VIU).**

---

## Características

- 🧪 **Laboratorio de Simbología:** Diccionario interactivo de notación matemática y de IA, con renderizado KaTeX, lectura en voz alta (`Web Speech API`) y equivalentes en Python.
- 📐 **Laboratorio de Lógica:** Generador de tablas de verdad, comparador de fórmulas, cálculo de formas normales (FND/FNC) y explorador de compuertas $F_1$.
- 🎲 **Laboratorio de Cadenas de Markov:** Cálculo racional exacto (sin errores de coma flotante), verificación de matrices estocásticas, evolución paso a paso, cálculo del vector estacionario $\pi$ y problema inverso.
- 🗂️ **Flashcards (SM-2):** Sistema de repaso espaciado con mazos predefinidos y creación de tarjetas propias con fórmulas matemáticas.
- 📊 **Calculadora de Notas:** Estimación orientativa de calificaciones y mínimos de examen según las guías docentes citadas.
- 🔒 **Privacidad Total:** Sin cookies de rastreo, sin analítica de terceros y con almacenamiento local en el navegador (`localStorage`).

---

## Requisitos y ejecución local

Se requiere **Node.js 22** o superior y **npm**:

```bash
# 1. Clonar el repositorio
git clone https://github.com/AglaDigSol/ia-labs-comunidad.git
cd ia-labs-comunidad

# 2. Instalar dependencias (raíz y herramientas de lint)
npm ci --ignore-scripts
npm --prefix tools/lint ci --ignore-scripts

# 3. Iniciar el servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

### Comprobaciones y validación

```bash
# Comprobación de tipos
npm run typecheck

# Linter (ESLint con typescript-eslint)
npm run lint

# Batería de pruebas unitarias y de integración
npm run test

# Construcción para producción
npm run build
```

---

## Configuración modular

En `src/config.ts` es posible activar o desactivar módulos opcionales según las necesidades de despliegue:

```typescript
export const config = {
  modules: {
    flashcards: true,   // Repaso espaciado SM-2
    calculadora: true,  // Calculadora de notas
  },
} as const;
```

Si un módulo se desactiva, no aparece en la navegación y su código no se descarga en el navegador.

---

## Despliegue en producción

La build genera una SPA estática (`dist/`) lista para servirse con cualquier servidor web o contenedor.

### Opción A: Servidor web (Nginx / Apache / LiteSpeed)

1. Construye el proyecto:
   ```bash
   npm run build
   ```
2. Publica el contenido de la carpeta `dist/` en el directorio raíz del servidor web (`DocumentRoot`).
3. Asegúrate de configurar la redirección SPA al archivo `index.html` y las cabeceras de seguridad recomendadas.

#### Cabeceras recomendadas (`nginx.conf` o `.htaccess`)
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src-elem 'self'; style-src-attr 'unsafe-inline'; font-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Robots-Tag: noindex, nofollow`

### Opción B: Docker

El repositorio incluye un `Dockerfile` multi-etapa optimizado con `nginx:alpine`:

```bash
# Construir la imagen
docker build -t ia-labs-comunidad .

# Ejecutar el contenedor en el puerto 8080
docker run -d -p 8080:80 --name ia-labs ia-labs-comunidad
```

---

## Restringir el acceso (Cloudflare Access)

Para compartir la plataforma de forma privada con compañeros de clase sin gestionar bases de datos ni contraseñas locales, se recomienda utilizar **Cloudflare Access (Zero Trust)**:

1. Accede al panel de **Cloudflare Zero Trust** → **Access** → **Applications**.
2. Haz clic en **Add an Application** y selecciona **Self-hosted**.
3. Introduce el subdominio asignado (por ejemplo, `labs-ai.docentes20.com`).
4. En **Policies**, añade una regla de acceso:
   - **Action:** `Allow`
   - **Rule configuration:** `Include` → `Emails` o `Email domain` (los correos de los compañeros que tendrán acceso).
5. Guarda la configuración. Los usuarios recibirán un código PIN de un solo uso (OTP) en su correo para ingresar. El plan gratuito de Cloudflare Zero Trust incluye hasta 50 usuarios sin coste.

---

## Mantenimiento del repositorio en GitHub

Para mantener la calidad y la integridad del proyecto en la rama principal (`main`):

1. Ve a **Settings** → **Branches** → **Add branch protection rule** para `main`.
2. Activa:
   - **Require a pull request before merging.**
   - **Require review from Code Owners** (atado al archivo `.github/CODEOWNERS`).
   - **Require status checks to pass before merging** (marca los checks del workflow `CI`).
   - Como mantenedora única, puedes marcar o mantener desmarcado **Do not allow bypassing the above settings** según prefieras gestionar emergencias directamente.

---

## Licencias

- **Código:** Licencia [MIT](LICENSE).
- **Contenido (`content/`):** Licencia [Creative Commons Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0)](content/LICENSE).
