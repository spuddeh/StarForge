// Types returned by the WASM get_display_list function.
// Field names match the snake_case JSON output from the Rust serde serialisation.

export type ElementType = 'shape' | 'text' | 'sprite' | 'button' | 'unknown'

export type DisplayItem = {
  depth: number
  character_id: number
  name?: string
  element_type: ElementType
  x: number        // pixels
  y: number        // pixels
  width: number    // pixels
  height: number   // pixels
}

export type DisplayList = {
  width: number    // stage width in pixels
  height: number   // stage height in pixels
  items: DisplayItem[]
}

export type SWFDocument = {
  filename: string
  byteLength: number
  wasGfx: boolean
  movieJson: string
  displayList: DisplayList
}

// Colour for each element type — Starfield palette
export const ELEMENT_COLOURS: Record<ElementType, { stroke: string; fill: string }> = {
  shape:   { stroke: '#2f4c79', fill: 'rgba(47,76,121,0.08)'   },
  text:    { stroke: '#e06236', fill: 'rgba(224,98,54,0.08)'   },
  sprite:  { stroke: '#d7ab61', fill: 'rgba(215,171,97,0.08)'  },
  button:  { stroke: '#c82337', fill: 'rgba(200,35,55,0.08)'   },
  unknown: { stroke: '#9ca3af', fill: 'rgba(156,163,175,0.05)' },
}
