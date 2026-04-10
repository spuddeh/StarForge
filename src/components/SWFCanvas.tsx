import { useRef, useEffect, useCallback } from 'react'
import type { DisplayList, DisplayItem } from './../lib/swfTypes'
import { ELEMENT_COLOURS } from '../lib/swfTypes'

type Props = {
  displayList: DisplayList
  selected: number | null   // depth of selected element
  onSelect: (depth: number | null) => void
}

const PADDING = 24           // px padding around stage
const SELECTED_COLOUR = '#e06236'
const LABEL_FONT = "11px 'JetBrains Mono', monospace"

export default function SWFCanvas({ displayList, selected, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Returns { scale, offsetX, offsetY } mapping stage coords to canvas coords
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

    ctx.clearRect(0, 0, cw, ch)

    // Background
    ctx.fillStyle = '#f9f7f4'
    ctx.fillRect(0, 0, cw, ch)

    // Stage outline
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(offsetX, offsetY, displayList.width * scale, displayList.height * scale)
    ctx.strokeStyle = 'rgba(47,76,121,0.25)'
    ctx.lineWidth = 1
    ctx.strokeRect(offsetX, offsetY, displayList.width * scale, displayList.height * scale)

    // Grid
    ctx.strokeStyle = 'rgba(47,76,121,0.05)'
    ctx.lineWidth = 0.5
    const gridStep = 100 * scale  // grid every 100px of stage
    for (let gx = 0; gx <= displayList.width * scale; gx += gridStep) {
      ctx.beginPath()
      ctx.moveTo(offsetX + gx, offsetY)
      ctx.lineTo(offsetX + gx, offsetY + displayList.height * scale)
      ctx.stroke()
    }
    for (let gy = 0; gy <= displayList.height * scale; gy += gridStep) {
      ctx.beginPath()
      ctx.moveTo(offsetX, offsetY + gy)
      ctx.lineTo(offsetX + displayList.width * scale, offsetY + gy)
      ctx.stroke()
    }

    // Elements — draw unselected first, selected on top
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

    const colours = ELEMENT_COLOURS[item.element_type] ?? ELEMENT_COLOURS.unknown

    // Fill
    ctx.fillStyle = isSelected ? 'rgba(224,98,54,0.12)' : colours.fill
    ctx.fillRect(x, y, w, h)

    // Border
    ctx.strokeStyle = isSelected ? SELECTED_COLOUR : colours.stroke
    ctx.lineWidth = isSelected ? 1.5 : 0.75
    ctx.strokeRect(x, y, w, h)

    // Label (only when large enough to read)
    if (w > 30 && h > 12) {
      const label = item.name ?? `#${item.character_id}`
      ctx.font = LABEL_FONT
      ctx.fillStyle = isSelected ? SELECTED_COLOUR : colours.stroke
      ctx.globalAlpha = isSelected ? 0.9 : 0.6
      ctx.fillText(label, x + 3, y + 11, w - 6)
      ctx.globalAlpha = 1
    }
  }

  // Click handler — find topmost (highest depth) element under cursor
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width)
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height)
    const { scale, offsetX, offsetY } = getTransform(canvas.width, canvas.height)

    // Convert to stage coords
    const sx = (cx - offsetX) / scale
    const sy = (cy - offsetY) / scale

    // Find all elements under cursor (sorted highest depth last = topmost)
    let hit: DisplayItem | null = null
    for (const item of displayList.items) {
      if (sx >= item.x && sx <= item.x + item.width &&
          sy >= item.y && sy <= item.y + item.height) {
        hit = item
      }
    }
    onSelect(hit ? hit.depth : null)
  }, [displayList, getTransform, onSelect])

  // Resize canvas to match its container
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
    <div ref={containerRef} className="relative w-full h-full bg-sf-bg">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="absolute inset-0 cursor-crosshair"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
