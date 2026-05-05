import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const BUILD_TIME = new Date().toISOString();

// Short git SHA — used as the deployed-version identifier. We use
// execFileSync (no shell) so there is no command-injection vector even
// in principle. In a CI environment without git, fall back to a
// timestamp-derived token so polling still works.
let BUILD_HASH: string;
try {
  BUILD_HASH = execFileSync('git', ['rev-parse', '--short', 'HEAD'])
    .toString()
    .trim();
} catch {
  BUILD_HASH = `t${Date.now().toString(36)}`;
}

// Write public/version.json so VersionPoller can fetch it at runtime.
// Done at config-load time so both `vite dev` and `vite build` see it.
try {
  mkdirSync('public', { recursive: true });
  writeFileSync(
    'public/version.json',
    `${JSON.stringify({ v: BUILD_HASH, t: BUILD_TIME })}\n`,
  );
} catch {
  /* ignore — the runtime check fails-soft if version.json is missing */
}

export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(BUILD_TIME),
    __BUILD_HASH__: JSON.stringify(BUILD_HASH),
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
