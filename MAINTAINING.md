# Mantenimiento

Notas para quien administra el repositorio.

## Proteger `main` en GitHub

En **Settings → Branches → Add branch ruleset** (o *Add rule*) para `main`:

1. **Require a pull request before merging**, con 1 aprobación y **Require review from Code Owners** (el fichero
   [`.github/CODEOWNERS`](.github/CODEOWNERS) asigna la revisión).
2. **Require status checks to pass**: marca los jobs de CI (`build-test`, `lint`, `audit`, `gitleaks`, `links` y `dco`).
3. **Block force pushes** y **Restrict deletions**.

## Dependencias

Dependabot ([`.github/dependabot.yml`](.github/dependabot.yml)) propone cada mes un PR agrupado para npm y otro para
GitHub Actions. Las versiones están fijadas con exactitud; ESLint vive aparte en `tools/lint/` porque typescript-eslint
necesita la API de TypeScript ≤ 6.0 y la app usa TypeScript 7.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) ejecuta en cada push y PR: typecheck, tests y build; lint;
`npm audit --omit=dev --audit-level=high`; gitleaks sobre todo el historial; comprobación de enlaces de los `.md` con
lychee; y, en los PR, que todos los commits lleven `Signed-off-by` (DCO).

## Versiones

Para publicar una versión, sube `version` en `package.json` (y en `package-lock.json`) y añade su sección
`## [x.y.z] - fecha` en `CHANGELOG.md` dentro del mismo PR. Cuando la CI termina en verde en `main`,
[`.github/workflows/release.yml`](.github/workflows/release.yml) crea la etiqueta `vx.y.z` y la release con esa sección
del CHANGELOG. Si la etiqueta ya existe no hace nada: nunca mueve una etiqueta publicada.

### API de la biblioteca

Otras apps instalan este repositorio como dependencia desde el tarball de una etiqueta (ver «Usar como dependencia» en
el README) e importan de [`src/embed/index.ts`](src/embed/index.ts) y de las subrutas de `exports`. Mientras el
proyecto esté en 0.x, un cambio incompatible en esa API (quitar o renombrar una exportación, cambiar las props de
`LabsRoutes` o la firma de `configureLabs`, mover un fichero publicado en `shared/*` o `content/*`, o cambiar las
versiones de las `peerDependencies`) exige subir la versión **menor** (0.3.x → 0.4.0) y anotarlo en el CHANGELOG; los
cambios compatibles pueden ir en un parche. `npm run typecheck:consumer` y `tests/embed.test.tsx` fallan si la API
pública se rompe sin querer.
