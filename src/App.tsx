import { useState } from 'react'
import './App.css'
import type { SWFDocument } from './lib/swfTypes'
import FileLoader from './components/FileLoader'
import EditorView from './components/EditorView'

const mono = { fontFamily: "'JetBrains Mono', monospace" }
const heading = { fontFamily: "'Barlow Semi Condensed', system-ui, sans-serif" }
const body = { fontFamily: "'Crimson Pro', Georgia, serif" }
const base = import.meta.env.BASE_URL

export default function App() {
  const [doc, setDoc] = useState<SWFDocument | null>(null)

  return (
    <div className="flex flex-col h-screen bg-sf-bg text-sf-ink overflow-hidden">

      <div className="constellation-stripe flex-shrink-0" />

      {/* Header */}
      <header className="border-b border-sf-blue/10 bg-white flex-shrink-0">
        <div className="max-w-5xl mx-auto px-10 py-6 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img
                src={`${base}constellation-logo.png`}
                alt="Constellation"
                className="w-6 h-6 rounded-full"
              />
              <span className="text-sf-blue/50 text-xs tracking-[0.3em] uppercase" style={mono}>
                Constellation Tools
              </span>
            </div>
            <h1 className="text-4xl font-medium tracking-[0.2em] uppercase text-sf-ink leading-none" style={heading}>
              StarForge
            </h1>
            <div className="tick-rule mt-2 mb-2 max-w-[200px]" />
            <p className="text-sf-blue text-xs tracking-[0.2em] uppercase" style={heading}>
              Starfield Interface Editor
            </p>
          </div>
          {doc && (
            <p className="text-sf-ink/25 text-xs" style={mono}>
              {doc.filename}
            </p>
          )}
        </div>
      </header>

      {/* Main — fills remaining height */}
      {doc ? (
        <EditorView doc={doc} onReset={() => setDoc(null)} />
      ) : (
        <main
          className="flex-1 flex flex-col items-center justify-center px-8 py-12 overflow-auto"
          style={{
            backgroundColor: '#0d1a28',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        >
          <div className="w-full max-w-lg">
            <p className="text-sf-white/50 text-lg leading-relaxed mb-8 max-w-md" style={body}>
              Open a GFx file, edit it visually, download the result.
              Runs entirely in your browser.
            </p>
            <FileLoader onLoad={setDoc} />
          </div>
        </main>
      )}

      {/* Footer — only on landing page */}
      {!doc && (
        <>
          <div className="h-px bg-gradient-to-r from-transparent via-sf-blue/10 to-transparent flex-shrink-0" />
          <footer className="bg-white py-3 flex-shrink-0">
            <div className="max-w-5xl mx-auto px-10 flex items-center justify-between">
              <p className="text-sf-ink/25 text-xs tracking-wider" style={mono}>
                ALL PROCESSING IS LOCAL. NOTHING LEAVES YOUR MACHINE.
              </p>
              <p className="text-sf-ink/20 text-xs tracking-wider" style={mono}>
                OPEN SOURCE / MIT
              </p>
            </div>
          </footer>
        </>
      )}

    </div>
  )
}
