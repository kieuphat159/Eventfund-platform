import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'
import type { Plugin as EsbuildPlugin } from 'esbuild'


/**
 * Root cause of "process2.nextTick is not a function":
 *
 * @web3auth/ws-embed requires readable-stream@^4.7.0 (nested dep).
 * readable-stream@4.x calls process.nextTick directly in source.
 * esbuild pre-bundles @web3auth/modal → ws-embed → readable-stream@4.x,
 * and renames the local `process` binding to `process2`.
 *
 * vite-plugin-node-polyfills injects process/browser via esbuildOptions.inject,
 * so process2 = process/browser which DOES have nextTick.
 * But our custom esbuildOptions block was overriding that inject — losing it.
 *
 * Fix strategy:
 * 1. Don't override esbuildOptions (let nodePolyfills manage it)
 * 2. Use a Vite plugin with config hook to append our esbuild plugin
 *    into the existing esbuildOptions.plugins array AFTER nodePolyfills sets it
 * 3. The esbuild plugin redirects ws-embed's readable-stream → top-level v3
 *    which is already covered by the process/browser inject
 */
const topLevelReadableStream = path.resolve(__dirname, 'node_modules/readable-stream')
/** esbuild plugin: redirect ws-embed's nested readable-stream → top-level v3 */
const redirectReadableStreamEsbuild: EsbuildPlugin = {
  name: 'redirect-readable-stream',
  setup(build) {
    build.onResolve({ filter: /^readable-stream$/ }, (args) => {
      if (args.importer && args.importer.includes('@web3auth/ws-embed')) {
        return { path: path.join(topLevelReadableStream, 'readable-browser.js') }
      }
      return null
    })
  },
}
/**
 * Vite plugin that appends our esbuild redirect plugin into optimizeDeps
 * AFTER all other plugins (including nodePolyfills) have run their config hooks.
 * Uses enforce:'post' + configResolved to safely merge without overriding.
 */
function appendEsbuildRedirectPlugin(): Plugin {
  return {
    name: 'append-esbuild-redirect',
    enforce: 'post',
    config() {
      return {
        optimizeDeps: {
          esbuildOptions: {
            plugins: [redirectReadableStreamEsbuild],
          },
        },
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util', 'crypto', 'events', 'string_decoder'],
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
    appendEsbuildRedirectPlugin(),
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

  build: {
    sourcemap: false,
  },

  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],
})