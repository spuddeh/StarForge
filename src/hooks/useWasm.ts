import { parse_gfx, emit_gfx, get_display_list, set_element_position, set_element_text } from '../wasm/starforge_wasm.js'

export type WasmModule = {
  parse_gfx: (bytes: Uint8Array) => string
  emit_gfx: (movieJson: string, wasGfx: boolean) => Uint8Array
  get_display_list: (movieJson: string) => string
  set_element_position: (movieJson: string, pathJson: string, x: number, y: number) => string
  set_element_text: (movieJson: string, characterId: number, text: string) => string
}

// With --target bundler, wasm-pack auto-initialises the module on import.
export async function loadWasm(): Promise<WasmModule> {
  return { parse_gfx, emit_gfx, get_display_list, set_element_position, set_element_text }
}
