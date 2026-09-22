import path from "path"
import { execSync } from "node:child_process"
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// TYPE GATE (do not remove — smart-check verifies this plugin exists).
// esbuild strips types without checking them, so a bare `vite build` used to be a way to
// produce a deployable dist/ that had never been type-checked. This plugin makes the check
// part of the build itself: there is no command that emits dist/ without passing `tsc -b`.
// Escape hatch: none by design. Fix the types (or finish the WIP) — don't route around them.
const enforceTypecheck = (): Plugin => ({
  name: 'enforce-typecheck',
  apply: 'build',
  buildStart() {
    // Heap CEILING (not a reservation), deliberately kept BELOW physical RAM. This PC has 12GB
    // and typically runs with under 1GB free, so the old 8192 let a runaway typecheck page the
    // whole machine out — which stalls the health probes and triggers watchdog restarts. At 4096
    // a genuine runaway dies with a clear OOM instead, and a normal build (well under 2GB) is
    // unaffected. Raise it only if you see a real "JavaScript heap out of memory" here.
    execSync('node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc -b', {
      stdio: 'inherit',
      cwd: __dirname,
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), enforceTypecheck()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  css: {
    devSourcemap: false,
  },
  server: {
    host: true,
    hmr: {
      overlay: false
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // Production build optimizations
  build: {
    // Code splitting for better caching
    rollupOptions: {
      output: {
        // Rolldown (vite 8) rejects the object form of `manualChunks` outright — it is
        // function-only there, and itself deprecated in favour of `codeSplitting.groups`.
        // `test` matches MODULE IDS, not package names, which is the trap below.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router-dom)[\\/]/ },
            { name: 'vendor-query', test: /node_modules[\\/]@tanstack[\\/]react-query[\\/]/ },
            // Both spellings deliberately. `radix-ui` is only the barrel that re-exports
            // @radix-ui/react-*; matching the meta-package alone would put the re-export in this
            // chunk and scatter every actual primitive elsewhere.
            { name: 'vendor-ui', test: /node_modules[\\/](radix-ui|@radix-ui)[\\/]/ },
            { name: 'vendor-forms', test: /node_modules[\\/](react-hook-form|@hookform[\\/]resolvers|zod)[\\/]/ },
            { name: 'vendor-date', test: /node_modules[\\/]date-fns[\\/]/ },
          ],
        },
      },
    },
    // Disable sourcemaps in production for smaller bundle
    sourcemap: false,
    // Increase chunk warning limit (default 500KB)
    chunkSizeWarningLimit: 600,
    // Target modern browsers for smaller output
    target: 'es2020',
  },
})
