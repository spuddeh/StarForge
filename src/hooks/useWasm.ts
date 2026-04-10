import { parse_gfx, emit_gfx, get_display_list } from '../wasm/starforge_wasm.js'

export type WasmModule = {
  parse_gfx: (bytes: Uint8Array) => string
  emit_gfx: (movieJson: string, wasGfx: boolean) => Uint8Array
  get_display_list: (movieJson: string) => string
}

// With --target bundler, wasm-pack auto-initialises the module on import.
export async function loadWasm(): Promise<WasmModule> {
  return { parse_gfx, emit_gfx, get_display_list }
}
