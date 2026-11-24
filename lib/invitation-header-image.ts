export const INVITATION_HEADER_MAX_BYTES = 3 * 1024 * 1024
export const INVITATION_HEADER_MIN_WIDTH = 600
export const INVITATION_HEADER_MIN_HEIGHT = 200
export const INVITATION_HEADER_MAX_WIDTH = 1800
export const INVITATION_HEADER_MAX_HEIGHT = 900

export function invitationHeaderJpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 16 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  if (bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return null

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerEnd = Math.min(bytes.length - 2, 128 * 1024)
  let dimensions: { width: number; height: number } | null = null
  let components = 0
  let hasQuantizationTable = false
  let hasHuffmanTable = false
  let offset = 2
  while (offset + 4 < headerEnd) {
    if (bytes[offset++] !== 0xff) return null
    while (offset < headerEnd && bytes[offset] === 0xff) offset++
    const marker = bytes[offset++]
    if (offset + 2 > headerEnd || marker <= 0x01 || (marker >= 0xd0 && marker <= 0xd9)) return null
    const length = view.getUint16(offset)
    if (length < 2 || offset + length > headerEnd) return null

    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (dimensions || length < 11 || bytes[offset + 2] !== 8) return null
      components = bytes[offset + 7]
      if ((components !== 1 && components !== 3) || length !== 8 + components * 3) return null
      dimensions = { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) }
    } else if (marker === 0xdb && length >= 67) {
      hasQuantizationTable = true
    } else if (marker === 0xc4 && length >= 20) {
      hasHuffmanTable = true
    } else if (marker === 0xda) {
      const scanComponents = bytes[offset + 2]
      return hasQuantizationTable && hasHuffmanTable
        && scanComponents >= 1 && scanComponents <= components && length === 6 + scanComponents * 2
        && offset + length < bytes.length - 2 ? dimensions : null
    } else if (marker !== 0xdd && marker !== 0xfe && (marker < 0xe0 || marker > 0xef)) {
      return null
    }
    offset += length
  }
  return null
}
