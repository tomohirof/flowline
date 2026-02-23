// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('SharedFlowViewer', () => {
  it('SharedFlowViewer.module.css .root should have position relative for overlay stacking', () => {
    const css = readFileSync(resolve(__dirname, './SharedFlowViewer.module.css'), 'utf-8')
    const rootMatch = css.match(/\.root\s*\{[^}]*\}/s)
    expect(rootMatch).not.toBeNull()
    const rootBlock = rootMatch![0]
    expect(rootBlock).toMatch(/position:\s*relative/)
  })
})
