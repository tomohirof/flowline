declare module '*.wasm' {
  const mod: WebAssembly.Module | ArrayBuffer
  export default mod
}
