/// <reference types="vite/client" />

/** The two sibling sites. Declared so they are properties rather than index lookups. */
interface ImportMetaEnv {
  readonly VITE_CHOICE_URL?: string;
  readonly VITE_GLOBAL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
