/* Minimal image dimension sniffing for PNG / JPEG / GIF (P03/P04).
   Returns null for unknown formats - callers store null dimensions. */

export function imageSizeFromBuffer(buf: Buffer): { width: number, height: number } | null {
  if (buf.length >= 24 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }

  if (buf.length >= 10 && buf.subarray(0, 4).toString('latin1') === 'GIF8') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
  }

  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++
        continue
      }
      const marker = buf[offset + 1]
      if (marker === undefined) return null
      // SOF0-SOF15 except DHT(C4), JPG(C8), DAC(CC) carry the frame size
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) }
      }
      const segmentLength = buf.readUInt16BE(offset + 2)
      if (segmentLength <= 0) return null
      offset += 2 + segmentLength
    }
  }

  return null
}
