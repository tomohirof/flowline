// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { pickPixelRatio } from './png-export'
import { buildExportSvg } from './png-export'

describe('pickPixelRatio', () => {
  it('returns pixelRatio=2 and downgraded=false for small flows (≤4000 long edge)', () => {
    expect(pickPixelRatio(100, 100)).toEqual({
      pixelRatio: 2,
      downgraded: false,
      abort: false,
    })
  })

  it('returns pixelRatio=2 at the 4000px boundary', () => {
    expect(pickPixelRatio(4000, 4000)).toEqual({
      pixelRatio: 2,
      downgraded: false,
      abort: false,
    })
  })

  it('downgrades to pixelRatio=1 when 2x would exceed 8000 long edge', () => {
    expect(pickPixelRatio(5000, 3000)).toEqual({
      pixelRatio: 1,
      downgraded: true,
      abort: false,
    })
  })

  it('aborts when 1x already exceeds 8000 long edge', () => {
    expect(pickPixelRatio(9000, 100)).toEqual({
      pixelRatio: 1,
      downgraded: false,
      abort: true,
    })
  })
})

const SVG_NS = 'http://www.w3.org/2000/svg'

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', '500')
  svg.setAttribute('height', '300')
  svg.setAttribute('viewBox', '0 -30 250 150')
  const rect = document.createElementNS(SVG_NS, 'rect')
  rect.setAttribute('x', '10')
  rect.setAttribute('y', '10')
  svg.appendChild(rect)
  return svg
}

describe('buildExportSvg', () => {
  it('returns a cloned SVG with width/height set to fullW/fullH and viewBox using full size', () => {
    const src = makeSvg()
    const { node, cleanup } = buildExportSvg(src, '#EAEAF2', '#000', 800, 600, false)

    expect(node).not.toBe(src)
    expect(node.getAttribute('width')).toBe('800')
    expect(node.getAttribute('height')).toBe('600')
    expect(node.getAttribute('viewBox')).toBe('0 -30 800 600')

    cleanup()
  })

  it('inserts a background rect with canvasBg color as the first child', () => {
    const src = makeSvg()
    const { node, cleanup } = buildExportSvg(src, '#1A1A24', '#666', 200, 200, false)

    const first = node.firstChild as SVGElement
    expect(first.tagName.toLowerCase()).toBe('rect')
    expect(first.getAttribute('fill')).toBe('#1A1A24')
    expect(first.getAttribute('width')).toBe('200')
    expect(first.getAttribute('height')).toBe('200')

    cleanup()
  })

  it('does NOT add a dot-pattern when showDotGrid is false', () => {
    const src = makeSvg()
    const { node, cleanup } = buildExportSvg(src, '#EAEAF2', '#000', 200, 200, false)

    expect(node.querySelector('#flowline-dots')).toBeNull()

    cleanup()
  })

  it('adds a <pattern id="flowline-dots"> in <defs> when showDotGrid is true', () => {
    const src = makeSvg()
    const { node, cleanup } = buildExportSvg(src, '#EAEAF2', '#888', 200, 200, true)

    const pattern = node.querySelector('#flowline-dots')
    expect(pattern).not.toBeNull()
    expect(pattern?.tagName.toLowerCase()).toBe('pattern')
    const circle = pattern?.querySelector('circle')
    expect(circle?.getAttribute('fill')).toBe('#888')

    cleanup()
  })

  it('cleanup() removes the temporary off-screen container from document.body', () => {
    const src = makeSvg()
    const { node, cleanup } = buildExportSvg(src, '#EAEAF2', '#000', 200, 200, false)

    const parent = node.parentElement
    expect(parent).not.toBeNull()
    expect(parent?.parentElement).toBe(document.body)

    cleanup()

    expect(document.body.contains(node)).toBe(false)
    expect(document.body.contains(parent!)).toBe(false)
  })

  it('appends header SVG children to the clone when headerSrc is provided', () => {
    const src = makeSvg()
    const header = document.createElementNS(SVG_NS, 'svg')
    const laneLabel = document.createElementNS(SVG_NS, 'text')
    laneLabel.setAttribute('data-testid', 'lane-label')
    laneLabel.textContent = 'Lane A'
    header.appendChild(laneLabel)

    const { node, cleanup } = buildExportSvg(src, '#EAEAF2', '#000', 800, 600, false, header)

    const found = node.querySelector('[data-testid="lane-label"]')
    expect(found).not.toBeNull()
    expect(found?.textContent).toBe('Lane A')

    cleanup()
  })

  it('does not throw and omits header content when headerSrc is null', () => {
    const src = makeSvg()
    const before = document.body.childNodes.length

    const { node, cleanup } = buildExportSvg(src, '#EAEAF2', '#000', 200, 200, false, null)

    // Should not have thrown; node should be a valid SVGSVGElement
    expect(node.tagName.toLowerCase()).toBe('svg')

    cleanup()
    expect(document.body.childNodes.length).toBe(before)
  })
})
