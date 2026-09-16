/**
 * Declared rather than inferred: the helper is plain JavaScript, because a Vite config loads it
 * through esbuild before any TypeScript build has run, and an untyped import is an `any` that
 * the strict lint rules correctly refuse.
 */
export declare function uiSourceAlias(): { find: RegExp; replacement: string }[];
