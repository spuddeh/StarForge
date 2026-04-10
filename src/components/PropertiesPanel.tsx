import { useState, useEffect, useCallback } from 'react'
import type { DisplayItem, DisplayList } from '../lib/swfTypes'
import { ELEMENT_COLOURS } from '../lib/swfTypes'

type EditField = 'x' | 'y' | 'text'

type Props = {
  displayList: DisplayList
  selected: number | null
  onEdit: (item: DisplayItem, field: EditField, value: string | number) => void
}

const mono = { fontFamily: "'JetBrains Mono', monospace" }
const body = { fontFamily: "'Crimson Pro', Georgia, serif" }

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sf-ink/35 text-xs tracking-wider uppercase" style={mono}>{children}</span>
}

function StaticValue({ children }: { children: React.ReactNode }) {
  return <span className="text-sf-ink/65 text-xs" style={mono}>{children}</span>
}

function EditableNumber({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [raw, setRaw] = useState(value.toFixed(1))
  useEffect(() => { setRaw(value.toFixed(1)) }, [value])
  const commit = useCallback(() => {
    const n = parseFloat(raw)
    if (!isNaN(n)) onCommit(n)
    else setRaw(value.toFixed(1))
  }, [raw, value, onCommit])
  return (
    <>
      <Label>{label}</Label>
      <input type="number" value={raw} step="1"
        onChange={e => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
        className="text-xs text-sf-ink bg-sf-bg border border-sf-blue/20 focus:border-sf-blue/60 focus:outline-none px-2 py-0.5 w-full"
        style={mono} />
    </>
  )
}

function EditableText({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [raw, setRaw] = useState(value)
  useEffect(() => { setRaw(value) }, [value])
  return (
    <>
      <Label>{label}</Label>
      <input type="text" value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={() => onCommit(raw)}
        onKeyDown={e => e.key === 'Enter' && onCommit(raw)}
        className="text-xs text-sf-ink bg-sf-bg border border-sf-blue/20 focus:border-sf-blue/60 focus:outline-none px-2 py-0.5 w-full"
        style={mono} />
    </>
  )
}

export default function PropertiesPanel({ displayList, selected, onEdit }: Props) {
  const item = selected != null ? displayList.items.find(i => i.uid === selected) : undefined
  const colours = item ? (ELEMENT_COLOURS[item.element_type] ?? ELEMENT_COLOURS.unknown) : null

  return (
    <div className="flex flex-col h-full border-l border-sf-blue/10 bg-white">
      <div className="px-4 py-3 border-b border-sf-blue/10 flex-shrink-0">
        <p className="text-sf-ink/50 text-xs tracking-widest uppercase" style={mono}>Properties</p>
      </div>

      {!item ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sf-ink/25 text-sm text-center leading-relaxed" style={body}>
            Select an element on the canvas or in the tree.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 border-b border-sf-blue/10">
            <span className="inline-block text-xs px-2 py-0.5 rounded-[2px] font-medium uppercase tracking-wider"
              style={{ ...mono, color: colours!.stroke, background: colours!.fill, border: `1px solid ${colours!.stroke}` }}>
              {item.element_type}
            </span>
            {item.name && <p className="text-sf-ink/65 text-xs mt-2 truncate" style={mono}>{item.name}</p>}
          </div>

          <div className="px-4 pt-4 pb-3 border-b border-sf-blue/10">
            <p className="text-sf-ink/30 text-[10px] tracking-widest uppercase mb-2" style={mono}>Position</p>
            <div className="grid grid-cols-[24px_1fr] gap-x-3 gap-y-2 items-center">
              <EditableNumber label="X" value={item.x} onCommit={v => onEdit(item, 'x', v)} />
              <EditableNumber label="Y" value={item.y} onCommit={v => onEdit(item, 'y', v)} />
            </div>
          </div>

          {item.element_type === 'text' && (
            <div className="px-4 pt-3 pb-3 border-b border-sf-blue/10">
              <p className="text-sf-ink/30 text-[10px] tracking-widest uppercase mb-2" style={mono}>Content</p>
              <div className="grid grid-cols-[24px_1fr] gap-x-3 gap-y-2 items-center">
                <EditableText label="T" value={item.text ?? ''} onCommit={v => onEdit(item, 'text', v)} />
              </div>
            </div>
          )}

          <div className="px-4 pt-3 pb-4">
            <p className="text-sf-ink/30 text-[10px] tracking-widest uppercase mb-2" style={mono}>Info</p>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <Label>W</Label>      <StaticValue>{item.width.toFixed(1)} px</StaticValue>
              <Label>H</Label>      <StaticValue>{item.height.toFixed(1)} px</StaticValue>
              <Label>Depth</Label>  <StaticValue>{item.depth}</StaticValue>
              <Label>Char</Label>   <StaticValue>{item.character_id}</StaticValue>
              <Label>Path</Label>   <StaticValue>[{item.path.join(', ')}]</StaticValue>
            </div>
          </div>

          <div className="px-4 pb-4 pt-2 border-t border-sf-blue/10">
            <p className="text-sf-ink/25 text-[10px] tracking-widest uppercase mb-2" style={mono}>Stage</p>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <Label>W</Label><StaticValue>{displayList.width.toFixed(0)} px</StaticValue>
              <Label>H</Label><StaticValue>{displayList.height.toFixed(0)} px</StaticValue>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
