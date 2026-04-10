import { useState, useCallback } from 'react'
import { loadWasm } from '../hooks/useWasm'
import type { SWFDocument } from '../lib/swfTypes'

type Props = {
  onLoad: (doc: SWFDocument) => void
}

const mono = { fontFamily: "'JetBrains Mono', monospace" }
const heading = { fontFamily: "'Barlow Semi Condensed', system-ui, sans-serif" }
const base = import.meta.env.BASE_URL

export default function FileLoader({ onLoad }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.gfx') && !name.endsWith('.swf') && !name.endsWith('.ba2')) {
      setError(`Unsupported file: ${file.name}`)
      setState('error')
      return
    }
    setState('loading')
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const wasGfx = name.endsWith('.gfx')

      const wasm = await loadWasm()
      const movieJson = wasm.parse_gfx(bytes)
      const displayListJson = wasm.get_display_list(movieJson)
      const displayList = JSON.parse(displayListJson)

      onLoad({
        filename: file.name,
        byteLength: bytes.byteLength,
        wasGfx,
        movieJson,
        displayList,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }, [onLoad])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setIsDragging(false), [])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }, [handleFile])

  return (
    <div className="flex flex-col gap-4">
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          'bracket-corners relative flex flex-col items-center justify-center gap-7',
          'px-10 py-16 cursor-pointer canvas-grid transition-all duration-200',
          isDragging
            ? 'bg-white border border-sf-blue/40'
            : 'bg-white border border-sf-blue/15 hover:border-sf-blue/30',
        ].join(' ')}
      >
        <input type="file" accept=".gfx,.swf,.ba2" className="sr-only" onChange={onInputChange} />

        {state === 'loading' ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-1 h-1 bg-sf-blue rounded-full animate-ping" />
            <p className="text-sf-ink/40 text-xs tracking-[0.2em] uppercase" style={mono}>
              Parsing...
            </p>
          </div>
        ) : (
          <>
            <img
              src={`${base}constellation-logo.png`}
              alt=""
              className={`w-14 h-14 rounded-full transition-opacity duration-200 ${isDragging ? 'opacity-100' : 'opacity-40'}`}
            />
            <div className="text-center">
              <p
                className={`text-base font-medium tracking-[0.2em] uppercase transition-colors duration-200 ${isDragging ? 'text-sf-blue' : 'text-sf-ink/50'}`}
                style={heading}
              >
                {isDragging ? 'Release to load' : 'Drop GFx file here'}
              </p>
              <p className="text-sf-ink/25 text-xs tracking-[0.2em] uppercase mt-2" style={mono}>
                .GFX / .SWF / .BA2
              </p>
            </div>
          </>
        )}

        <span className="absolute top-2 left-3 text-sf-blue/15 text-[10px]" style={mono}>00:00:00</span>
        <span className="absolute bottom-2 right-3 text-sf-blue/15 text-[10px]" style={mono}>SF-UI</span>
      </label>

      {state === 'error' && error && (
        <div className="border border-sf-red/30 bg-white px-5 py-4">
          <p className="text-sf-red/80 text-xs leading-relaxed" style={mono}>{error}</p>
        </div>
      )}
    </div>
  )
}
