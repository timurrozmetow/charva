/// <reference types="vite/client" />

/**
 * The two environment variables this app reads.
 *
 * Typed rather than left to `any` so a misspelt name is a compile error: both are URLs the two
 * halves link to, and a wrong one produces a chooser whose buttons go nowhere — which nothing
 * else in the build would catch.
 */
interface ImportMetaEnv {
  readonly VITE_GLOBAL_URL?: string;
  readonly VITE_UMRAH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
