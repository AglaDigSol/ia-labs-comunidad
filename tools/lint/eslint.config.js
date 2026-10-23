// ESLint (flat config) con typescript-eslint. Vive en tools/lint porque typescript-eslint necesita la
// API JavaScript de TypeScript ≤ 6.0 y la app usa TypeScript 7. Se ejecuta con `npm run lint` en la raíz.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";


export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "tools/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        console: "readonly",
      },
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      "no-undef": "off",
    },
  },
  {
    files: ["public/**/*.js"],
    languageOptions: { sourceType: "script", globals: { window: "readonly", document: "readonly", localStorage: "readonly", matchMedia: "readonly" } },
  },
);
