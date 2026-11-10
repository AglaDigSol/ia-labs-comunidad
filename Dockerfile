# syntax=docker/dockerfile:1
# 1) Build con Node: dist/ estático (app + calendarios .ics).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
# Ruta base del sitio (por ejemplo /labs/) y feed externo opcional del calendario. CALENDAR_ICS_URL
# solo se usa durante el build: no llega a la imagen final, ni al bundle, ni a dist/.
ARG VITE_BASE=/
ARG CALENDAR_ICS_URL=
ARG CALENDAR_ICS_KEY=
# Pestaña Python opcional: --build-arg LABS_PYTHON=1 publica Pyodide en dist/pyodide/ (unos 110 MB;
# el build descarga los paquetes verificados de jsDelivr, PyPI o la release de GitHub). Vacío: lo que
# diga config.modules.python (apagada).
ARG LABS_PYTHON=
# Enlace «Guías de estudio» de los laboratorios (https). Vacío: sin enlace.
ARG VITE_GUIDES_URL=
RUN VITE_BASE="$VITE_BASE" CALENDAR_ICS_URL="$CALENDAR_ICS_URL" CALENDAR_ICS_KEY="$CALENDAR_ICS_KEY" LABS_PYTHON="$LABS_PYTHON" VITE_GUIDES_URL="$VITE_GUIDES_URL" npm run build

# 2) nginx sin privilegios sirviendo dist/.
FROM nginx:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY deploy/security-headers-wasm.conf /etc/nginx/snippets/security-headers-wasm.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
