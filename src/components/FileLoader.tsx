import { useState, useCallback } from 'react'
import { loadWasm } from '../hooks/useWasm'

type LoadState = 'idle' | 'loading' | 'done' | 'error'

type ParseResult = {
  filename: string
  byteLength: number
  movieJson: string
  tagCount: number
  wasGfx: boolean
}

const mono = { fontFamily: "'JetBrains Mono', monospace" }
const heading = { fontFamily: "'Barlow Semi Condensed', system-ui, sans-serif" }
const body = { fontFamily: "'Crimson Pro', Georgia, serif" }

export default function FileLoader() {
  const [state, setState] = useState<LoadState>('idle')
  const [result, setResult] = useState<ParseResult | null>(null)
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
    setResult(null)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const wasGfx = name.endsWith('.gfx')
      const wasm = await loadWasm()
      const movieJson = wasm.parse_gfx(bytes)
      const movie = JSON.parse(movieJson)
      const tagCount = Array.isArray(movie?.tags) ? movie.tags.length : 0
      setResult({ filename: file.name, byteLength: bytes.byteLength, movieJson, tagCount, wasGfx })
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }, [])

  const downloadRoundTrip = useCallback(async () => {
    if (!result) return
    try {
      const wasm = await loadWasm()
      const outBytes = wasm.emit_gfx(result.movieJson, result.wasGfx)
      const blob = new Blob([outBytes.slice(0)], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename.replace(/(\.\w+)$/, '_roundtrip$1')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setState('error')
    }
  }, [result])

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
    <div className="w-full max-w-lg flex flex-col gap-5">

      {/* Drop zone */}
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

        <img
          src="/constellation-logo.png"
          alt=""
          className={`w-14 h-14 rounded-full transition-opacity duration-200 ${isDragging ? 'opacity-100' : 'opacity-50'}`}
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

        <span className="absolute top-2 left-3 text-sf-blue/15 text-[10px]" style={mono}>00:00:00</span>
        <span className="absolute bottom-2 right-3 text-sf-blue/15 text-[10px]" style={mono}>SF-UI</span>
      </label>

      {/* Loading */}
      {state === 'loading' && (
        <div className="flex items-center gap-3 px-5 py-3 border border-sf-blue/15 bg-white">
          <div className="w-1 h-1 bg-sf-blue rounded-full animate-pulse flex-shrink-0" />
          <p className="text-sf-blue/60 text-xs tracking-[0.2em] uppercase" style={mono}>
            Scanning...
          </p>
        </div>
      )}

      {/* Success */}
      {state === 'done' && result && (
        <div className="border border-sf-blue/15 bg-white">
          <div className="px-5 py-3 border-b border-sf-blue/10 flex items-center gap-2">
            <div className="w-1 h-1 bg-sf-blue rounded-full flex-shrink-0" />
            <p className="text-sf-blue/70 text-xs tracking-widest truncate" style={mono}>
              {result.filename}
            </p>
          </div>

          <div className="px-5 py-4 grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-xs" style={mono}>
            <span className="text-sf-ink/30 tracking-wider">FORMAT</span>
            <span className="text-sf-ink/70">{result.wasGfx ? 'Scaleform GFx' : 'SWF'}</span>
            <span className="text-sf-ink/30 tracking-wider">TAGS</span>
            <span className="text-sf-ink/70">{result.tagCount}</span>
            <span className="text-sf-ink/30 tracking-wider">SIZE</span>
            <span className="text-sf-ink/70">{result.byteLength.toLocaleString()} bytes</span>
          </div>

          <div className="px-5 pb-5">
            <button
              onClick={downloadRoundTrip}
              className="w-full py-2.5 border border-sf-blue/25 hover:border-sf-blue hover:bg-sf-blue hover:text-white text-sf-blue/60 text-xs tracking-[0.2em] uppercase transition-all duration-150"
              style={mono}
            >
              Download round-trip file
            </button>
            <p className="text-sf-ink/30 text-sm mt-2 leading-relaxed" style={body}>
              Open the result in JPEXS to verify the parse and emit pipeline.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {state === 'error' && error && (
        <div className="border border-sf-red/30 bg-white px-5 py-4">
          <p className="text-sf-red/80 text-xs leading-relaxed" style={mono}>{error}</p>
        </div>
      )}

    </div>
  )
}
