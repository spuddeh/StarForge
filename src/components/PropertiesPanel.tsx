import type { DisplayItem, DisplayList } from './../lib/swfTypes'
import { ELEMENT_COLOURS } from '../lib/swfTypes'

type Props = {
  displayList: DisplayList
  selected: number | null
}

const mono = { fontFamily: "'JetBrains Mono', monospace" }
const body = { fontFamily: "'Crimson Pro', Georgia, serif" }

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-sf-ink/30 text-xs tracking-wider uppercase" style={mono}>{label}</span>
      <span className="text-sf-ink/70 text-xs truncate" style={mono}>{value}</span>
    </>
  )
}

export default function PropertiesPanel({ displayList, selected }: Props) {
  const item: DisplayItem | undefined = selected != null
    ? displayList.items.find(i => i.uid === selected)
    : undefined

  const colours = item ? (ELEMENT_COLOURS[item.element_type] ?? ELEMENT_COLOURS.unknown) : null

  return (
    <div className="flex flex-col h-full border-l border-sf-blue/10 bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-sf-blue/10 flex-shrink-0">
        <p className="text-sf-ink/50 text-xs tracking-widest uppercase" style={mono}>
          Properties
        </p>
      </div>

      {!item ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sf-ink/25 text-sm text-center leading-relaxed" style={body}>
            Select an element on the canvas or in the tree.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Type indicator */}
          <div className="px-4 py-3 border-b border-sf-blue/10">
            <span
              className="inline-block text-xs px-2 py-1 rounded-[2px] font-medium uppercase tracking-wider"
              style={{
                ...mono,
                color: colours!.stroke,
                background: colours!.fill,
                border: `1px solid ${colours!.stroke}`,
              }}
            >
              {item.element_type}
            </span>
            {item.name && (
              <p className="text-sf-ink/70 text-xs mt-2 truncate" style={mono}>
                {item.name}
              </p>
            )}
          </div>

          {/* Properties grid */}
          <div className="px-4 py-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5">
            <Row label="Depth"    value={String(item.depth)} />
            <Row label="Char ID"  value={String(item.character_id)} />
            <Row label="X"        value={`${item.x.toFixed(1)} px`} />
            <Row label="Y"        value={`${item.y.toFixed(1)} px`} />
            <Row label="Width"    value={`${item.width.toFixed(1)} px`} />
            <Row label="Height"   value={`${item.height.toFixed(1)} px`} />
          </div>

          {/* Stage info */}
          <div className="px-4 pb-4 pt-2 border-t border-sf-blue/10 mt-2">
            <p className="text-sf-ink/25 text-xs tracking-wider uppercase mb-2" style={mono}>
              Stage
            </p>
            <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              <Row label="W" value={`${displayList.width.toFixed(0)} px`} />
              <Row label="H" value={`${displayList.height.toFixed(0)} px`} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
