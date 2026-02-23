/** Mock for @resvg/resvg-wasm in test environment */
const VALID_PNG_HEADER = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

export class Resvg {
  render() {
    return {
      asPng: () => VALID_PNG_HEADER,
    }
  }
}

export async function initWasm() {
  // no-op in test environment
}
