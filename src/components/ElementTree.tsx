import type { DisplayItem, DisplayList } from './../lib/swfTypes'
import { ELEMENT_COLOURS } from '../lib/swfTypes'

type Props = {
  displayList: DisplayList
  selected: number | null
  onSelect: (depth: number | null) => void
}

const mono = { fontFamily: "'JetBrains Mono', monospace" }

const TYPE_LABELS: Record<string, string> = {
  shape:   'SHP',
  text:    'TXT',
  sprite:  'SPR',
  button:  'BTN',
  unknown: 'UNK',
}

export default function ElementTree({ displayList, selected, onSelect }: Props) {
  return (
    <div className="flex flex-col h-full border-r border-sf-blue/10 bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-sf-blue/10 flex-shrink-0">
        <p className="text-sf-ink/50 text-xs tracking-widest uppercase" style={mono}>
          Elements
        </p>
        <p className="text-sf-ink/30 text-xs mt-0.5" style={mono}>
          {displayList.items.length} placed
        </p>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b border-sf-blue/10 flex flex-wrap gap-x-3 gap-y-1 flex-shrink-0">
        {(['shape', 'text', 'sprite', 'button'] as const).map(type => (
          <span key={type} className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-[1px]"
              style={{ background: ELEMENT_COLOURS[type].stroke }}
            />
            <span className="text-sf-ink/40 text-[10px] uppercase" style={mono}>
              {type}
            </span>
          </span>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {displayList.items.map(item => (
          <ElementRow
            key={item.depth}
            item={item}
            isSelected={item.depth === selected}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

function ElementRow({
  item,
  isSelected,
  onSelect,
}: {
  item: DisplayItem
  isSelected: boolean
  onSelect: (depth: number | null) => void
}) {
  const colours = ELEMENT_COLOURS[item.element_type] ?? ELEMENT_COLOURS.unknown
  const label = item.name ?? `char_${item.character_id}`

  return (
    <button
      onClick={() => onSelect(isSelected ? null : item.depth)}
      className={[
        'w-full text-left px-4 py-2 flex items-center gap-2 transition-colors duration-100',
        isSelected
          ? 'bg-sf-orange/8 border-l-2 border-sf-orange'
          : 'border-l-2 border-transparent hover:bg-sf-blue/5',
      ].join(' ')}
    >
      {/* Type badge */}
      <span
        className="flex-shrink-0 text-[9px] px-1 py-0.5 rounded-[2px] font-medium"
        style={{
          ...mono,
          color: colours.stroke,
          background: colours.fill,
          border: `1px solid ${colours.stroke}`,
          opacity: 0.85,
        }}
      >
        {TYPE_LABELS[item.element_type] ?? 'UNK'}
      </span>

      {/* Name */}
      <span
        className={`text-xs truncate ${isSelected ? 'text-sf-orange' : 'text-sf-ink/70'}`}
        style={mono}
      >
        {label}
      </span>

      {/* Depth */}
      <span className="ml-auto flex-shrink-0 text-sf-ink/25 text-[10px]" style={mono}>
        {item.depth}
      </span>
    </button>
  )
}
