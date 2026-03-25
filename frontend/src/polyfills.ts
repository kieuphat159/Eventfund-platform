/**
 * Browser polyfills for Node.js globals required by Web3Auth dependencies
 * (readable-stream, hash-base, @toruslabs/ws-embed, etc.)
 *
 * Must be imported FIRST in main.tsx before any Web3Auth code runs.
 */

// Ensure globalThis.process exists with all fields readable-stream needs
if (typeof (globalThis as any).process === 'undefined') {
  (globalThis as any).process = {}
}

const proc = (globalThis as any).process

if (!proc.browser) proc.browser = true
if (!proc.env) proc.env = {}
if (!proc.version) proc.version = 'v18.0.0'
if (!proc.versions) proc.versions = {}
if (!proc.platform) proc.platform = 'browser'

// readable-stream uses process.nextTick — polyfill with setTimeout
if (typeof proc.nextTick !== 'function') {
  proc.nextTick = (cb: (...args: any[]) => void, ...args: any[]) => {
    setTimeout(() => cb(...args), 0)
  }
}

// Some bundles reference process via a local alias (process2, etc.)
// Patching globalThis.process covers those too since they alias from global scope
;(globalThis as any).global = globalThis
