/// <reference types="vite/client" />

/**
 * Short git SHA injected at build time by vite.config.ts via the
 * `define` option. Used by the VersionPoller to compare the loaded
 * bundle against the currently deployed /version.json.
 */
declare const __BUILD_HASH__: string;

interface ImportMetaEnv {
  readonly VITE_BUILD_TIME: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
