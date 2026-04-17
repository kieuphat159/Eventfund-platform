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
    include: ['@web3auth/modal', '@web3auth/base', 'viem', 'permissionless', 'randombytes'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },

  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      plugins: [
        {
          name: 'inject-exports',
          transform(code: string, id: string) {
            if (id.includes('web3auth') || id.includes('randombytes')) {
              return {
                code: `var exports = typeof exports !== "undefined" ? exports : {};\n${code}`,
                map: null,
              }
            }
          },
        },
      ],
    },
  },

  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],
})
