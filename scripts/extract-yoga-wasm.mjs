#!/usr/bin/env node
/* global console, process, Buffer */
/**
 * Extract yoga WASM binary from yoga-layout's base64-encoded ESM bundle.
 *
 * yoga-layout embeds its WASM as base64 inside JavaScript (Emscripten build).
 * Cloudflare Workers cannot use this because WebAssembly.instantiate() with
 * raw bytes is blocked. Instead, we extract the binary and import it as a
 * static .wasm file (pre-compiled WebAssembly.Module).
 *
 * Usage: node scripts/extract-yoga-wasm.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const srcPath = resolve(rootDir, 'node_modules/yoga-layout/dist/binaries/yoga-wasm-base64-esm.js')
const destPath = resolve(rootDir, 'workers/ogp/src/yoga.wasm')

const src = readFileSync(srcPath, 'utf8')

// The WASM is embedded as a data URI: data:application/octet-stream;base64,<data>
const match = src.match(/base64,([A-Za-z0-9+/=]{100,})/)
if (!match) {
  console.error('Could not find base64 WASM data in yoga-layout')
  process.exit(1)
}

const wasmBuf = Buffer.from(match[1], 'base64')

// Verify WASM magic bytes: \0asm
if (wasmBuf[0] !== 0x00 || wasmBuf[1] !== 0x61 || wasmBuf[2] !== 0x73 || wasmBuf[3] !== 0x6d) {
  console.error('Extracted data does not have valid WASM magic bytes')
  process.exit(1)
}

writeFileSync(destPath, wasmBuf)

const pkg = JSON.parse(
  readFileSync(resolve(rootDir, 'node_modules/yoga-layout/package.json'), 'utf8'),
)
console.log(`Extracted yoga.wasm (${wasmBuf.length} bytes) from yoga-layout v${pkg.version}`)
console.log(`Saved to: ${destPath}`)
