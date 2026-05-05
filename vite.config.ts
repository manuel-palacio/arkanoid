import { defineConfig } from 'vite';

const BUILD_TIME = new Date().toISOString();

export default defineConfig({
  base: './',
  define: {
    // Surfaced via import.meta.env so any module can read the build
    // timestamp; printed once on boot for easy "what's deployed?"
    // verification from a remote DevTools / Safari Web Inspector.
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(BUILD_TIME),
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
        // Explicit hashed names so the nginx /assets/ rule (1-year
        // immutable cache) catches every JS/CSS/font output.
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  html: {
    // Allow %VITE_BUILD_TIME% substitution inside index.html.
    cspNonce: undefined,
  },
});
