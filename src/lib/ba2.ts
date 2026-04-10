/**
 * ba2.ts — in-browser BA2 archive reader.
 *
 * Parses Bethesda BA2 archives (General type, v1/v2) using the File API.
 * All data stays in memory — nothing is uploaded anywhere.
 *
 * Format reference: https://en.uesp.net/wiki/Starfield_Mod:Archive_File_Format
 *
 * TODO: implement in Phase 4 once the visual editor core is working.
 */

export type BA2Entry = {
  path: string
  offset: number
  packedSize: number
  unpackedSize: number
}

export type BA2Archive = {
  entries: BA2Entry[]
  getFile: (path: string) => Uint8Array | null
}

// Stub — returns null until implemented
export function parseBA2(_buffer: ArrayBuffer): BA2Archive {
  throw new Error('BA2 reader not yet implemented (Phase 4).')
}
