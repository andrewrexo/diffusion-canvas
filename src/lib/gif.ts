/* Minimal GIF89a encoder for equally-sized RGBA frames. Palette index 0 is
   reserved for transparency; channels are bit-reduced only when the combined
   frames exceed 255 opaque colors, which pixel art rarely does. */

const MAX_CODE = 4096

const quantKey = (r: number, g: number, b: number, shift: number) => {
  const m = (v: number) => (v >> shift) << shift
  return (m(r) << 16) | (m(g) << 8) | m(b)
}

function buildPalette(frames: ImageData[]) {
  const seen = new Set<number>()
  for (const f of frames) {
    const d = f.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] >= 128) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])
    }
  }
  let shift = 0
  let colors = [...seen]
  while (colors.length > 255 && shift < 7) {
    shift++
    const reduced = new Set<number>()
    for (const c of seen) {
      reduced.add(quantKey((c >> 16) & 255, (c >> 8) & 255, c & 255, shift))
    }
    colors = [...reduced]
  }
  return { colors, shift }
}

function toIndices(img: ImageData, indexOf: Map<number, number>, shift: number) {
  const d = img.data
  const indices = new Uint8Array(img.width * img.height)
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    if (d[i + 3] >= 128) {
      indices[p] = indexOf.get(quantKey(d[i], d[i + 1], d[i + 2], shift)) ?? 0
    }
  }
  return indices
}

function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clear = 1 << minCodeSize
  const eoi = clear + 1
  let codeSize = minCodeSize + 1
  let next = eoi + 1
  let table = new Map<number, number>()
  const bytes: number[] = []
  let acc = 0
  let nbits = 0

  const emit = (code: number) => {
    acc |= code << nbits
    nbits += codeSize
    while (nbits >= 8) {
      bytes.push(acc & 255)
      acc >>= 8
      nbits -= 8
    }
  }

  emit(clear)
  let prefix: number = indices[0]
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]
    const key = (prefix << 8) | k
    const found = table.get(key)
    if (found !== undefined) {
      prefix = found
      continue
    }
    emit(prefix)
    if (next === MAX_CODE) {
      emit(clear)
      codeSize = minCodeSize + 1
      next = eoi + 1
      table = new Map()
    } else {
      if (next >= 1 << codeSize) codeSize++
      table.set(key, next++)
    }
    prefix = k
  }
  emit(prefix)
  emit(eoi)
  if (nbits > 0) bytes.push(acc & 255)
  return Uint8Array.from(bytes)
}

export function encodeGif(frames: ImageData[], fps: number): Uint8Array<ArrayBuffer> {
  if (!frames.length) throw new Error('encodeGif needs at least one frame')
  const { width, height } = frames[0]
  const { colors, shift } = buildPalette(frames)
  const indexOf = new Map<number, number>()
  colors.forEach((c, i) => indexOf.set(c, i + 1))
  const tableBits = Math.max(2, Math.ceil(Math.log2(colors.length + 1)))
  const tableSize = 1 << tableBits
  const delay = Math.max(2, Math.round(100 / fps))

  const out: number[] = []
  const u16 = (v: number) => out.push(v & 255, (v >> 8) & 255)
  const ascii = (s: string) => {
    for (const ch of s) out.push(ch.charCodeAt(0))
  }

  ascii('GIF89a')
  u16(width)
  u16(height)
  out.push(0x80 | 0x70 | (tableBits - 1), 0, 0)

  out.push(0, 0, 0)
  for (const c of colors) out.push((c >> 16) & 255, (c >> 8) & 255, c & 255)
  for (let i = colors.length + 1; i < tableSize; i++) out.push(0, 0, 0)

  if (frames.length > 1) {
    out.push(0x21, 0xff, 11)
    ascii('NETSCAPE2.0')
    out.push(3, 1)
    u16(0)
    out.push(0)
  }

  for (const frame of frames) {
    out.push(0x21, 0xf9, 4, (2 << 2) | 1)
    u16(delay)
    out.push(0, 0)

    out.push(0x2c)
    u16(0)
    u16(0)
    u16(width)
    u16(height)
    out.push(0)

    out.push(tableBits)
    const data = lzwEncode(toIndices(frame, indexOf, shift), tableBits)
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.subarray(i, i + 255)
      out.push(chunk.length, ...chunk)
    }
    out.push(0)
  }

  out.push(0x3b)
  return Uint8Array.from(out)
}
