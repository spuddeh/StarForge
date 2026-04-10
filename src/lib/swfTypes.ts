export type ElementType = 'shape' | 'text' | 'sprite' | 'button' | 'unknown'

export type DisplayItem = {
  uid: number
  depth: number
  level: number       // nesting depth: 0 = root, 1 = inside a sprite, etc.
  character_id: number
  name?: string
  element_type: ElementType
  x: number
  y: number
  width: number
  height: number
  fill_colour?: string    // "#rrggbbaa" hex — present for shapes with solid fills
  text?: string           // text content for dynamic text fields
  text_colour?: string    // "#rrggbbaa" hex — text colour
  is_container: boolean   // true for sprites with children expanded below
}

export type DisplayList = {
  width: number
  height: number
  items: DisplayItem[]
}

export type SWFDocument = {
  filename: string
  byteLength: number
  wasGfx: boolean
  movieJson: string
  displayList: DisplayList
}

// Stroke/fill colours for element type indicators (used in tree badges and canvas outlines)
export const ELEMENT_COLOURS: Record<ElementType, { stroke: string; fill: string }> = {
  shape:   { stroke: 'rgba(100,160,255,0.85)', fill: 'rgba(100,160,255,0.10)' },
  text:    { stroke: 'rgba(224,98,54,0.90)',   fill: 'rgba(224,98,54,0.12)'   },
  sprite:  { stroke: 'rgba(215,171,97,0.70)',  fill: 'rgba(215,171,97,0.06)'  },
  button:  { stroke: 'rgba(220,60,70,0.90)',   fill: 'rgba(220,60,70,0.10)'   },
  unknown: { stroke: 'rgba(180,190,200,0.50)', fill: 'rgba(180,190,200,0.06)' },
}
