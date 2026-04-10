# StarForge

A browser-based visual editor for Starfield's GFx interface files. Open a GFx file, edit it visually, download the result. No installs required.

---

## What it does

Starfield uses Scaleform GFx files for all in-game UI. Editing them currently requires raw binary tools with no visual feedback. StarForge lets you open a GFx file in your browser, see its elements, change properties, and download the patched file.

Everything runs locally in your browser. Nothing is uploaded anywhere.

## Getting started

1. Extract a GFx file from `Starfield - Interface.ba2` using [Bethesda Archive Extractor](https://www.nexusmods.com/starfield/mods/165)
2. Open StarForge and drop the file onto the editor
3. Edit elements visually
4. Download the patched file and drop it into your MO2 mod folder as a loose file override

## Local development

Requires [Node.js](https://nodejs.org) and [Rust](https://rustup.rs) with the `wasm32-unknown-unknown` target.

```sh
# Install wasm-pack
cargo install wasm-pack

# Build the WASM core
wasm-pack build crates/starforge-wasm --target bundler --out-dir ../../src/wasm

# Install JS dependencies and start the dev server
npm install
npm run dev
```

## Tech

- **WASM core**: Rust, swf-parser, swf-emitter, wasm-bindgen
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite

## Credits

- [StarDelta](https://github.com/hierocles/stardelta) by hierocles (MIT) — architecture reference
- open-flash/swf-parser (MIT) — SWF parsing
- swf-emitter (MIT) — SWF serialisation

## Licence

MIT
