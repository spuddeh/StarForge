/**
 * TypeScript types mirroring the Movie JSON schema produced by swf-parser.
 * These are partial — expanded as needed when WASM is wired up.
 * Source: open-flash/swf-types and StarDelta swf.rs structures.
 */

export type SwfRect = {
  x_min: number
  x_max: number
  y_min: number
  y_max: number
}

export type SwfMatrix = {
  scale_x?: number
  scale_y?: number
  rotate_skew0?: number
  rotate_skew1?: number
  translate_x: number
  translate_y: number
}

export type SwfColour = {
  r: number
  g: number
  b: number
  a: number
}

// Top-level SWF/GFx file
export type Movie = {
  header: {
    swf_version: number
    frame_size: SwfRect
    frame_rate: number
    frame_count: number
  }
  tags: Tag[]
}

// Tag union — extend as needed
export type Tag =
  | PlaceObjectTag
  | DefineEditTextTag
  | DefineDynamicTextTag
  | DefineShapeTag
  | DefineSpriteTag
  | UnknownTag

export type PlaceObjectTag = {
  type: 'place-object'
  depth: number
  character_id?: number
  matrix?: SwfMatrix
  name?: string
}

export type DefineEditTextTag = {
  type: 'define-edit-text'
  id: number
  bounds: SwfRect
  initial_text?: string
  font_size?: number
  color?: SwfColour
}

export type DefineDynamicTextTag = {
  type: 'define-dynamic-text'
  id: number
  bounds: SwfRect
  text?: string
  font_size?: number
  color?: SwfColour
}

export type DefineShapeTag = {
  type: 'define-shape'
  id: number
  bounds: SwfRect
}

export type DefineSpriteTag = {
  type: 'define-sprite'
  id: number
  frame_count: number
  tags: Tag[]
}

export type UnknownTag = {
  type: string
  [key: string]: unknown
}
