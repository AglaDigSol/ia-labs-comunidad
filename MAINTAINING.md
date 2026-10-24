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
