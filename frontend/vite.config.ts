import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
