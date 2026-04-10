import { useRef, useEffect, useCallback } from 'react'
import type { DisplayList, DisplayItem } from './../lib/swfTypes'

type Props = {
  displayList: DisplayList
  selected: number | null
  onSelect: (depth: number | null) => void
}

const PADDING = 32
const SELECTED_COLOUR = '#e06236'
const LABEL_FONT = "11px 'JetBrains Mono', monospace"

// On dark background, boost stroke opacity and use lighter fills
const DARK_COLOURS: Record<string, { stroke: string; fill: string }> = {
  shape:   { stroke: 'rgba(100,160,255,0.85)', fill: 'rgba(100,160,255,0.10)' },
  text:    { stroke: 'rgba(224,98,54,0.90)',   fill: 'rgba(224,98,54,0.12)'   },
  sprite:  { stroke: 'rgba(215,171,97,0.90)',  fill: 'rgba(215,171,97,0.10)'  },
  button:  { stroke: 'rgba(220,60,70,0.90)',   fill: 'rgba(220,60,70,0.10)'   },
  unknown: { stroke: 'rgba(180,190,200,0.50)', fill: 'rgba(180,190,200,0.06)' },
}

export default function SWFCanvas({ displayList, selected, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const getTransform = useCallback((canvasW: number, canvasH: number) => {
    const scaleX = (canvasW - PADDING * 2) / displayList.width
    const scaleY = (canvasH - PADDING * 2) / displayList.height
    const scale = Math.min(scaleX, scaleY)
    const offsetX = (canvasW - displayList.width * scale) / 2
    const offsetY = (canvasH - displayList.height * scale) / 2
    return { scale, offsetX, offsetY }
  }, [displayList.width, displayList.height])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width: cw, height: ch } = canvas
    const { scale, offsetX, offsetY } = getTransform(cw, ch)

    // Canvas is transparent — CSS background provides the dot grid
    ctx.clearRect(0, 0, cw, ch)

    const sw = displayList.width * scale
    const sh = displayList.height * scale

    // Stage fill — very slightly lighter than the dot grid background
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    ctx.fillRect(offsetX, offsetY, sw, sh)

    // Stage outline — soft teal, matches ship builder axis-line feel
    ctx.strokeStyle = 'rgba(80,180,220,0.35)'
    ctx.lineWidth = 1
    ctx.strokeRect(offsetX, offsetY, sw, sh)

    // Stage corner ticks
    const tick = 8
    ctx.strokeStyle = 'rgba(80,180,220,0.6)'
    ctx.lineWidth = 1.5
    ;[
      [offsetX, offsetY, 1, 1],
      [offsetX + sw, offsetY, -1, 1],
      [offsetX, offsetY + sh, 1, -1],
      [offsetX + sw, offsetY + sh, -1, -1],
    ].forEach(([cx, cy, dx, dy]) => {
      ctx.beginPath()
      ctx.moveTo(cx + (dx as number) * tick, cy as number)
      ctx.lineTo(cx as number, cy as number)
      ctx.lineTo(cx as number, cy + (dy as number) * tick)
      ctx.stroke()
    })

    // Elements
    const unselected = displayList.items.filter(i => i.depth !== selected)
    const sel = displayList.items.find(i => i.depth === selected)
    for (const item of unselected) drawItem(ctx, item, scale, offsetX, offsetY, false)
    if (sel) drawItem(ctx, sel, scale, offsetX, offsetY, true)

  }, [displayList, selected, getTransform])

  function drawItem(
    ctx: CanvasRenderingContext2D,
    item: DisplayItem,
    scale: number,
    ox: number,
    oy: number,
    isSelected: boolean
  ) {
    const x = ox + item.x * scale
    const y = oy + item.y * scale
    const w = Math.max(item.width * scale, 2)
    const h = Math.max(item.height * scale, 2)

    const colours = DARK_COLOURS[item.element_type] ?? DARK_COLOURS.unknown

    ctx.fillStyle = isSelected ? 'rgba(224,98,54,0.18)' : colours.fill
    ctx.fillRect(x, y, w, h)

    ctx.strokeStyle = isSelected ? SELECTED_COLOUR : colours.stroke
    ctx.lineWidth = isSelected ? 1.5 : 1
    ctx.strokeRect(x, y, w, h)

    if (w > 30 && h > 12) {
      const label = item.name ?? `#${item.character_id}`
      ctx.font = LABEL_FONT
      ctx.fillStyle = isSelected ? SELECTED_COLOUR : colours.stroke
      ctx.globalAlpha = isSelected ? 1 : 0.75
      ctx.fillText(label, x + 4, y + 12, w - 8)
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

    let hit: DisplayItem | null = null
    for (const item of displayList.items) {
      if (sx >= item.x && sx <= item.x + item.width &&
          sy >= item.y && sy <= item.y + item.height) {
        hit = item
      }
    }
    onSelect(hit ? hit.depth : null)
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
