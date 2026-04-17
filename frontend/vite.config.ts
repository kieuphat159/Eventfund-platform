import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util', 'crypto', 'events'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],

  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      process: 'process/browser',
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      buffer: 'buffer',
    },
  },

  optimizeDeps: {
    include: [
      '@web3auth/modal',
      'viem',
      'permissionless',
      'readable-stream',
      'stream-browserify',
      'crypto-browserify',
      'ox',
    ],
  },

  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],
})
