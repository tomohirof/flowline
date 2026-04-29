const SVG_NS = 'http://www.w3.org/2000/svg'

interface BuildExportSvgResult {
  node: SVGSVGElement
  cleanup: () => void
}

export function buildExportSvg(
  src: SVGSVGElement,
  canvasBg: string,
  dotGridColor: string,
  fullW: number,
  fullH: number,
  showDotGrid: boolean,
  headerSrc?: SVGSVGElement | null,
): BuildExportSvgResult {
  const clone = src.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(fullW))
  clone.setAttribute('height', String(fullH))
  clone.setAttribute('viewBox', `0 -30 ${fullW} ${fullH}`)
  clone.style.removeProperty('min-width')
  clone.style.removeProperty('min-height')

  // Background rect (insert as first child so it sits behind everything)
  const bg = document.createElementNS(SVG_NS, 'rect')
  bg.setAttribute('x', '0')
  bg.setAttribute('y', '-30')
  bg.setAttribute('width', String(fullW))
  bg.setAttribute('height', String(fullH))
  bg.setAttribute('fill', canvasBg)
  clone.insertBefore(bg, clone.firstChild)

  // Dot grid pattern (optional)
  if (showDotGrid) {
    let defs = clone.querySelector('defs')
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs')
      clone.insertBefore(defs, clone.firstChild)
    }
    const pattern = document.createElementNS(SVG_NS, 'pattern')
    pattern.setAttribute('id', 'flowline-dots')
    pattern.setAttribute('width', '20')
    pattern.setAttribute('height', '20')
    pattern.setAttribute('patternUnits', 'userSpaceOnUse')
    const dot = document.createElementNS(SVG_NS, 'circle')
    dot.setAttribute('cx', '0.5')
    dot.setAttribute('cy', '0.5')
    dot.setAttribute('r', '0.5')
    dot.setAttribute('fill', dotGridColor)
    pattern.appendChild(dot)
    defs.appendChild(pattern)

    const gridRect = document.createElementNS(SVG_NS, 'rect')
    gridRect.setAttribute('x', '0')
    gridRect.setAttribute('y', '-30')
    gridRect.setAttribute('width', String(fullW))
    gridRect.setAttribute('height', String(fullH))
    gridRect.setAttribute('fill', 'url(#flowline-dots)')
    bg.parentNode?.insertBefore(gridRect, bg.nextSibling)
  }

  // Merge header SVG children so lane labels/decorations appear in the export
  if (headerSrc) {
    Array.from(headerSrc.children).forEach((child) => {
      clone.appendChild(child.cloneNode(true))
    })
  }

  // Mount off-screen so html-to-image can compute layout
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-99999px'
  host.style.top = '0'
  host.style.pointerEvents = 'none'
  host.appendChild(clone)
  document.body.appendChild(host)

  return {
    node: clone,
    cleanup: () => {
      if (host.parentNode) host.parentNode.removeChild(host)
    },
  }
}

const MAX_LONG_EDGE = 8000

interface PixelRatioDecision {
  pixelRatio: number
  downgraded: boolean
  abort: boolean
}

export function pickPixelRatio(width: number, height: number): PixelRatioDecision {
  const longEdge = Math.max(width, height)
  if (longEdge * 2 <= MAX_LONG_EDGE) {
    return { pixelRatio: 2, downgraded: false, abort: false }
  }
  if (longEdge <= MAX_LONG_EDGE) {
    return { pixelRatio: 1, downgraded: true, abort: false }
  }
  return { pixelRatio: 1, downgraded: false, abort: true }
}
