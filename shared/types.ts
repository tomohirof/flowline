// ⚠️ Only pure type definitions allowed in this directory.
//    - No runtime code (no const, no function, no class).
//    - No DOM-specific or Workers-specific types.
//    - Imported by both src/ (Vite/React) and api/ (Cloudflare Workers).
//    Reason: src/ and api/ are bundled separately. This file is the
//    single source of truth for types shared on the wire / API contract.

/** 矢印の接続元/接続先として使う頂点/辺。未指定なら自動。 */
export type ArrowSide = 'top' | 'right' | 'bottom' | 'left'
