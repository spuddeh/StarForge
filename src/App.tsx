import './App.css'
import FileLoader from './components/FileLoader'

const mono = { fontFamily: "'JetBrains Mono', monospace" }
const heading = { fontFamily: "'Barlow Semi Condensed', system-ui, sans-serif" }
const body = { fontFamily: "'Crimson Pro', Georgia, serif" }
const base = import.meta.env.BASE_URL

export default function App() {
  return (
    <div className="flex flex-col min-h-screen bg-sf-bg text-sf-ink">

      {/* Four stacked horizontal stripes — full width */}
      <div className="constellation-stripe" />

      {/* Header */}
      <header className="border-b border-sf-blue/10 bg-white">
        <div className="max-w-5xl mx-auto px-10 py-10">

          <div className="flex items-center gap-3 mb-6">
            <img
              src={`${base}constellation-logo.png`}
              alt="Constellation"
              className="w-7 h-7 rounded-full"
            />
            <span
              className="text-sf-blue/60 text-xs tracking-[0.3em] uppercase"
              style={mono}
            >
              Constellation Tools
            </span>
          </div>

          <h1
            className="text-5xl font-medium tracking-[0.22em] uppercase text-sf-ink mb-3"
            style={heading}
          >
            StarForge
          </h1>

          <div className="tick-rule mb-4 max-w-xs" />

          <p
            className="text-sf-blue text-sm tracking-[0.2em] uppercase mb-4"
            style={heading}
          >
            Starfield Interface Editor
          </p>

          <p className="text-sf-ink/55 text-lg leading-relaxed max-w-lg" style={body}>
            Open a GFx file, edit it visually, download the result.
            Runs entirely in your browser.
          </p>

        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-14 bg-sf-bg">
        <FileLoader />
      </main>

      {/* Footer */}
      <footer className="border-t border-sf-blue/10 bg-white py-4">
        <div className="max-w-5xl mx-auto px-10 flex items-center justify-between">
          <p className="text-sf-ink/30 text-xs tracking-wider" style={mono}>
            ALL PROCESSING IS LOCAL. NOTHING LEAVES YOUR MACHINE.
          </p>
          <p className="text-sf-ink/20 text-xs tracking-wider" style={mono}>
            OPEN SOURCE / MIT
          </p>
        </div>
      </footer>

    </div>
  )
}
