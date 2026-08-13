/// <reference types="vite/client" />

/** The two sites this one links out to. Typed so a misspelt name is a compile error. */
interface ImportMetaEnv {
  readonly VITE_CHOICE_URL?: string;
  readonly VITE_UMRAH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
