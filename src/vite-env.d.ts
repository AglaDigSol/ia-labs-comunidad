/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dirección https de las guías de estudio; vacía o sin definir, no hay enlace. */
  readonly VITE_GUIDES_URL?: string;
  /** Dirección https de la tarjeta «Comunidad» del inicio; vacía o sin definir, no hay tarjeta. */
  readonly VITE_COMMUNITY_URL?: string;
}
