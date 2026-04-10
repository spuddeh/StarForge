import { useState } from 'react'
import type { SWFDocument } from '../lib/swfTypes'
import SWFCanvas from './SWFCanvas'
import ElementTree from './ElementTree'
import PropertiesPanel from './PropertiesPanel'

type Props = {
  doc: SWFDocument
  onReset: () => void
}

const mono = { fontFamily: "'JetBrains Mono', monospace" }
const heading = { fontFamily: "'Barlow Semi Condensed', system-ui, sans-serif" }

export default function EditorView({ doc, onReset }: Props) {
  const [selected, setSelected] = useState<number | null>(null)

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

        <span className="ml-auto text-sf-ink/25 text-xs flex-shrink-0" style={mono}>
          {doc.displayList.width.toFixed(0)} &times; {doc.displayList.height.toFixed(0)} px
          &nbsp;/&nbsp;
          {doc.displayList.items.length} elements
        </span>
      </div>

      {/* Three-panel editor */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Element tree */}
        <div className="w-56 flex-shrink-0 overflow-hidden">
          <ElementTree
            displayList={doc.displayList}
            selected={selected}
            onSelect={setSelected}
          />
        </div>

        {/* Centre: Canvas */}
        <div className="flex-1 overflow-hidden">
          <SWFCanvas
            displayList={doc.displayList}
            selected={selected}
            onSelect={setSelected}
          />
        </div>

        {/* Right: Properties */}
        <div className="w-52 flex-shrink-0 overflow-hidden">
          <PropertiesPanel
            displayList={doc.displayList}
            selected={selected}
          />
        </div>

      </div>

      {/* Download bar */}
      <div className="flex-shrink-0 border-t border-sf-blue/10 bg-white px-6 py-2 flex items-center gap-4">
        <span className="text-sf-ink/30 text-xs" style={heading}>
          Editing is coming in the next phase. Download the original round-trip file to verify the parser.
        </span>
        <DownloadButton doc={doc} />
      </div>

    </div>
  )
}

function DownloadButton({ doc }: { doc: SWFDocument }) {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const { loadWasm } = await import('../hooks/useWasm')
      const wasm = await loadWasm()
      const outBytes = wasm.emit_gfx(doc.movieJson, doc.wasGfx)
      const blob = new Blob([outBytes.slice(0)], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.filename.replace(/(\.\w+)$/, '_edited$1')
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
      className="ml-auto flex-shrink-0 text-xs tracking-widest uppercase border border-sf-blue/25 hover:border-sf-blue text-sf-blue/50 hover:text-sf-blue px-4 py-1.5 transition-all duration-150 disabled:opacity-40"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {busy ? 'Exporting...' : 'Download file'}
    </button>
  )
}
