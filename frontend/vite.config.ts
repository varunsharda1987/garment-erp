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
        manualChunks: {
          // Core React dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Query and state management
          'vendor-query': ['@tanstack/react-query'],
          // UI components (Radix)
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
          ],
          // Form handling
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // Date handling
          'vendor-date': ['date-fns'],
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
