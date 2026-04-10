import { useState, useCallback } from 'react'
import type { SWFDocument, DisplayItem, DisplayList } from '../lib/swfTypes'
import { loadWasm } from '../hooks/useWasm'
import SWFCanvas from './SWFCanvas'
import ElementTree from './ElementTree'
import PropertiesPanel from './PropertiesPanel'

type Props = {
  doc: SWFDocument
  onReset: () => void
}

const mono = { fontFamily: "'JetBrains Mono', monospace" }

export default function EditorView({ doc, onReset }: Props) {
  const [selected, setSelected] = useState<number | null>(null)

  // movieJson accumulates edits; displayList re-derived from it after each edit
  const [movieJson, setMovieJson] = useState(doc.movieJson)
  const [displayList, setDisplayList] = useState<DisplayList>(doc.displayList)

  const handleEdit = useCallback(async (
    item: DisplayItem,
    field: 'x' | 'y' | 'text',
    value: string | number,
  ) => {
    try {
      const wasm = await loadWasm()
      let newMovieJson: string

      if (field === 'x' || field === 'y') {
        const newX = field === 'x' ? Number(value) : item.x
        const newY = field === 'y' ? Number(value) : item.y
        newMovieJson = wasm.set_element_position(
          movieJson,
          JSON.stringify(item.path),
          newX,
          newY,
        )
      } else {
        newMovieJson = wasm.set_element_text(movieJson, item.character_id, String(value))
      }

      const newDisplayList: DisplayList = JSON.parse(wasm.get_display_list(newMovieJson))
      setMovieJson(newMovieJson)
      setDisplayList(newDisplayList)
    } catch (err) {
      console.error('[StarForge] Edit failed:', err)
    }
  }, [movieJson])

  const isDirty = movieJson !== doc.movieJson

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-sf-blue/10 bg-white px-6 py-2 flex items-center gap-4">
        <button
          onClick={onReset}
          className="text-xs tracking-widest uppercase text-sf-blue/50 hover:text-sf-blue transition-colors duration-150 border border-sf-blue/20 hover:border-sf-blue/50 px-3 py-1.5"
          style={mono}
        >
          Load new file
        </button>

        <span className="text-sf-ink/40 text-xs truncate" style={mono}>
          {doc.filename}
        </span>

        {isDirty && (
          <span className="text-sf-orange text-xs tracking-widest uppercase" style={mono}>
            Unsaved edits
          </span>
        )}

        <span className="ml-auto text-sf-ink/25 text-xs flex-shrink-0" style={mono}>
          {displayList.width.toFixed(0)} &times; {displayList.height.toFixed(0)} px
          &nbsp;/&nbsp;
          {displayList.items.length} elements
        </span>
      </div>

      {/* Three-panel editor */}
      <div className="flex flex-1 overflow-hidden">

        <div className="w-56 flex-shrink-0 overflow-hidden">
          <ElementTree
            displayList={displayList}
            selected={selected}
            onSelect={setSelected}
          />
        </div>

        <div className="flex-1 overflow-hidden">
          <SWFCanvas
            displayList={displayList}
            selected={selected}
            onSelect={setSelected}
          />
        </div>

        <div className="w-56 flex-shrink-0 overflow-hidden">
          <PropertiesPanel
            displayList={displayList}
            selected={selected}
            onEdit={handleEdit}
          />
        </div>

      </div>

      {/* Download bar */}
      <div className="flex-shrink-0 border-t border-sf-blue/10 bg-white px-6 py-2 flex items-center gap-3">
        {isDirty ? (
          <p className="text-sf-ink/40 text-xs" style={mono}>
            Changes are applied in memory. Download to save the file.
          </p>
        ) : (
          <p className="text-sf-ink/25 text-xs" style={mono}>
            Select an element and edit its position or text content in the properties panel.
          </p>
        )}
        <DownloadButton movieJson={movieJson} wasGfx={doc.wasGfx} filename={doc.filename} isDirty={isDirty} />
      </div>

    </div>
  )
}

function DownloadButton({ movieJson, wasGfx, filename, isDirty }: {
  movieJson: string
  wasGfx: boolean
  filename: string
  isDirty: boolean
}) {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const wasm = await loadWasm()
      const outBytes = wasm.emit_gfx(movieJson, wasGfx)
      const blob = new Blob([outBytes.slice(0)], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename.replace(/(\.\w+)$/, '_edited$1')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={download}
      disabled={busy}
      className={[
        'ml-auto flex-shrink-0 text-xs tracking-widest uppercase px-4 py-1.5 transition-all duration-150 disabled:opacity-40',
        isDirty
          ? 'border border-sf-orange/60 hover:border-sf-orange text-sf-orange/70 hover:text-sf-orange'
          : 'border border-sf-blue/25 hover:border-sf-blue text-sf-blue/50 hover:text-sf-blue',
      ].join(' ')}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {busy ? 'Exporting...' : 'Download file'}
    </button>
  )
}
