import { useRef, useEffect, useCallback } from 'react'
import type { DisplayList, DisplayItem } from './../lib/swfTypes'
import { ELEMENT_COLOURS } from '../lib/swfTypes'

type Props = {
  displayList: DisplayList
  selected: number | null   // uid of selected item
  onSelect: (uid: number | null) => void
}

const PADDING = 32
const SELECTED_COLOUR = '#e06236'
const LABEL_FONT = "10px 'JetBrains Mono', monospace"
const TEXT_FONT   = "11px 'Barlow Semi Condensed', system-ui, sans-serif"

/** Parse a CSS hex colour string (#rrggbbaa) to canvas rgba() */
function hexToRgba(hex: string, alphaOverride?: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const a = alphaOverride ?? (hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1)
  return `rgba(${r},${g},${b},${a})`
}

export default function SWFCanvas({ displayList, selected, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const getTransform = useCallback((cw: number, ch: number) => {
    const scale = Math.min((cw - PADDING * 2) / displayList.width, (ch - PADDING * 2) / displayList.height)
    const offsetX = (cw - displayList.width * scale) / 2
    const offsetY = (ch - displayList.height * scale) / 2
    return { scale, offsetX, offsetY }
  }, [displayList.width, displayList.height])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width: cw, height: ch } = canvas
    const { scale, offsetX, offsetY } = getTransform(cw, ch)
    const sw = displayList.width * scale
    const sh = displayList.height * scale

    ctx.clearRect(0, 0, cw, ch)

    // Stage fill and border
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    ctx.fillRect(offsetX, offsetY, sw, sh)
    ctx.strokeStyle = 'rgba(80,180,220,0.35)'
    ctx.lineWidth = 1
    ctx.strokeRect(offsetX, offsetY, sw, sh)

    // Corner ticks
    const tick = 8
    ctx.strokeStyle = 'rgba(80,180,220,0.6)'
    ctx.lineWidth = 1.5
    for (const [cx, cy, dx, dy] of [
      [offsetX,      offsetY,       1, 1],
      [offsetX + sw, offsetY,      -1, 1],
      [offsetX,      offsetY + sh,  1,-1],
      [offsetX + sw, offsetY + sh, -1,-1],
    ]) {
      ctx.beginPath()
      ctx.moveTo((cx as number) + (dx as number) * tick, cy as number)
      ctx.lineTo(cx as number, cy as number)
      ctx.lineTo(cx as number, (cy as number) + (dy as number) * tick)
      ctx.stroke()
    }

    // Draw unselected first, selected on top
    const unselected = displayList.items.filter(i => i.uid !== selected)
    const sel = displayList.items.find(i => i.uid === selected)
    for (const item of unselected) drawItem(ctx, item, scale, offsetX, offsetY, false)
    if (sel) drawItem(ctx, sel, scale, offsetX, offsetY, true)

  }, [displayList, selected, getTransform])

  function drawItem(
    ctx: CanvasRenderingContext2D,
    item: DisplayItem,
    scale: number,
    ox: number, oy: number,
    isSelected: boolean,
  ) {
    const x = ox + item.x * scale
    const y = oy + item.y * scale
    const w = Math.max(item.width * scale, 2)
    const h = Math.max(item.height * scale, 2)

    const colours = ELEMENT_COLOURS[item.element_type] ?? ELEMENT_COLOURS.unknown

    // Fill — always very faint so overlapping elements stay readable
    ctx.fillStyle = isSelected
      ? 'rgba(224,98,54,0.15)'
      : (item.fill_colour ? hexToRgba(item.fill_colour, 0.12) : colours.fill)
    ctx.fillRect(x, y, w, h)

    // Stroke — use actual fill colour for shapes (shows real colour as outline),
    // or type colour for other elements. Brighter when selected.
    const strokeColour = item.fill_colour && !item.is_container
      ? hexToRgba(item.fill_colour, isSelected ? 1 : 0.75)
      : (isSelected ? SELECTED_COLOUR : colours.stroke)
    ctx.strokeStyle = strokeColour
    ctx.lineWidth = isSelected ? 2 : 1
    if (item.is_container) {
      ctx.setLineDash([4, 3])
      ctx.globalAlpha = 0.4
    } else {
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }
    ctx.strokeRect(x, y, w, h)
    ctx.setLineDash([])
    ctx.globalAlpha = 1

    // Text content for text fields
    if (item.text && w > 8 && h > 8) {
      ctx.font = TEXT_FONT
      ctx.fillStyle = item.text_colour
        ? hexToRgba(item.text_colour, 0.9)
        : (isSelected ? SELECTED_COLOUR : 'rgba(245,247,247,0.9)')
      ctx.globalAlpha = isSelected ? 1 : 0.8
      ctx.fillText(item.text, x + 2, y + h * 0.65, w - 4)
      ctx.globalAlpha = 1
      return  // skip generic label if we showed text
    }

    // Generic label (name or char ID) for larger elements
    if (w > 28 && h > 10) {
      const label = item.name ?? `#${item.character_id}`
      ctx.font = LABEL_FONT
      ctx.fillStyle = isSelected ? SELECTED_COLOUR : colours.stroke
      ctx.globalAlpha = isSelected ? 0.9 : 0.55
      ctx.fillText(label, x + 3, y + 11, w - 6)
      ctx.globalAlpha = 1
    }
  }

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width)
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height)
    const { scale, offsetX, offsetY } = getTransform(canvas.width, canvas.height)
    const sx = (cx - offsetX) / scale
    const sy = (cy - offsetY) / scale

    // Find topmost non-container element under cursor (skip transparent containers)
    let hit: DisplayItem | null = null
    for (const item of displayList.items) {
      if (sx >= item.x && sx <= item.x + item.width &&
          sy >= item.y && sy <= item.y + item.height) {
        if (!item.is_container || hit === null) hit = item
      }
    }
    onSelect(hit ? hit.uid : null)
  }, [displayList, getTransform, onSelect])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const observer = new ResizeObserver(() => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      draw()
    })
    observer.observe(container)
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight
    draw()
    return () => observer.disconnect()
  }, [draw])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{
        backgroundColor: '#0d1a28',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="absolute inset-0 cursor-crosshair"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
