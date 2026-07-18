import { describe, expect, it } from 'vitest'
import { encodeGif } from './gif'
import { setPixel, type RGBA } from '../editor/tools'

const RED: RGBA = [255, 0, 0, 255]
const GREEN: RGBA = [0, 255, 0, 255]
const BLUE: RGBA = [0, 0, 255, 255]

function frameOf(w: number, h: number, paint: (img: ImageData) => void) {
  const img = new ImageData(w, h)
  paint(img)
  return img
}

/* Walks the GIF block structure without decompressing. */
function parseGif(bytes: Uint8Array) {
  const header = String.fromCharCode(...bytes.subarray(0, 6))
  const width = bytes[6] | (bytes[7] << 8)
  const height = bytes[8] | (bytes[9] << 8)
  const packed = bytes[10]
  const gctSize = 2 ** ((packed & 7) + 1)
  let pos = 13
  const gct = bytes.subarray(pos, pos + gctSize * 3)
  pos += gctSize * 3

  const extensions: number[] = []
  const gces: Uint8Array[] = []
  const images: { minCodeSize: number; data: Uint8Array }[] = []
  let appId = ''
  let sawTrailer = false

  while (pos < bytes.length) {
    const block = bytes[pos]
    if (block === 0x3b) {
      sawTrailer = true
      break
    }
    if (block === 0x21) {
      const label = bytes[pos + 1]
      extensions.push(label)
      pos += 2
      const subBlocks: number[] = []
      while (bytes[pos] !== 0) {
        subBlocks.push(...bytes.subarray(pos + 1, pos + 1 + bytes[pos]))
        pos += bytes[pos] + 1
      }
      pos++
      if (label === 0xf9) gces.push(Uint8Array.from(subBlocks))
      if (label === 0xff) appId = String.fromCharCode(...subBlocks.slice(0, 11))
    } else if (block === 0x2c) {
      pos += 10
      const minCodeSize = bytes[pos++]
      const data: number[] = []
      while (bytes[pos] !== 0) {
        data.push(...bytes.subarray(pos + 1, pos + 1 + bytes[pos]))
        pos += bytes[pos] + 1
      }
      pos++
      images.push({ minCodeSize, data: Uint8Array.from(data) })
    } else {
      throw new Error(`Unexpected block 0x${block.toString(16)} at ${pos}`)
    }
  }
  return { header, width, height, gctSize, gct, extensions, gces, images, appId, sawTrailer }
}

function lzwDecode(minCodeSize: number, data: Uint8Array, pixelCount: number): number[] {
  const clear = 1 << minCodeSize
  const eoi = clear + 1
  let codeSize = minCodeSize + 1
  let dict: number[][] = []
  const reset = () => {
    dict = []
    for (let i = 0; i < clear; i++) dict.push([i])
    dict.push([], [])
    codeSize = minCodeSize + 1
  }
  reset()

  let pos = 0
  let acc = 0
  let nbits = 0
  const read = () => {
    while (nbits < codeSize) {
      acc |= data[pos++] << nbits
      nbits += 8
    }
    const code = acc & ((1 << codeSize) - 1)
    acc >>= codeSize
    nbits -= codeSize
    return code
  }

  const out: number[] = []
  let prev: number[] | null = null
  while (out.length < pixelCount) {
    const code = read()
    if (code === clear) {
      reset()
      prev = null
      continue
    }
    if (code === eoi) break
    const entry: number[] = code < dict.length ? [...dict[code]] : [...prev!, prev![0]]
    out.push(...entry)
    if (prev) dict.push([...prev, entry[0]])
    if (dict.length >= 1 << codeSize && codeSize < 12) codeSize++
    prev = entry
  }
  return out
}

describe('encodeGif', () => {
  it('emits a valid animated structure with loop and transparency', () => {
    const frames = [
      frameOf(8, 8, (img) => setPixel(img, 0, 0, RED)),
      frameOf(8, 8, (img) => setPixel(img, 1, 1, GREEN)),
      frameOf(8, 8, (img) => setPixel(img, 2, 2, BLUE)),
    ]
    const gif = parseGif(encodeGif(frames, 10))

    expect(gif.header).toBe('GIF89a')
    expect(gif.width).toBe(8)
    expect(gif.height).toBe(8)
    expect(gif.images).toHaveLength(3)
    expect(gif.gces).toHaveLength(3)
    expect(gif.appId).toBe('NETSCAPE2.0')
    expect(gif.sawTrailer).toBe(true)

    const [gcePacked, delayLo, delayHi, transparentIndex] = gif.gces[0]
    expect(gcePacked & 1).toBe(1)
    expect((gcePacked >> 2) & 7).toBe(2)
    expect(delayLo | (delayHi << 8)).toBe(10)
    expect(transparentIndex).toBe(0)
  })

  it('skips the loop extension for single-frame output', () => {
    const gif = parseGif(encodeGif([frameOf(4, 4, () => {})], 8))
    expect(gif.images).toHaveLength(1)
    expect(gif.appId).toBe('')
  })

  it('round-trips pixels through its own LZW stream', () => {
    const frame = frameOf(16, 16, (img) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if ((x + y) % 3 === 0) setPixel(img, x, y, RED)
          else if ((x + y) % 3 === 1) setPixel(img, x, y, BLUE)
        }
      }
    })
    const gif = parseGif(encodeGif([frame], 8))
    const indices = lzwDecode(gif.images[0].minCodeSize, gif.images[0].data, 256)

    expect(indices).toHaveLength(256)
    for (let p = 0; p < 256; p++) {
      const x = p % 16
      const y = Math.floor(p / 16)
      const idx = indices[p]
      if ((x + y) % 3 === 2) {
        expect(idx).toBe(0)
      } else {
        const rgb = [gif.gct[idx * 3], gif.gct[idx * 3 + 1], gif.gct[idx * 3 + 2]]
        expect(rgb).toEqual((x + y) % 3 === 0 ? [255, 0, 0] : [0, 0, 255])
      }
    }
  })

  it('quantizes palettes that exceed 255 colors', () => {
    const frame = frameOf(20, 20, (img) => {
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
          setPixel(img, x, y, [x * 12, y * 12, (x + y) * 6, 255])
        }
      }
    })
    const gif = parseGif(encodeGif([frame], 8))
    expect(gif.gctSize).toBeLessThanOrEqual(256)
    const indices = lzwDecode(gif.images[0].minCodeSize, gif.images[0].data, 400)
    expect(indices).toHaveLength(400)
    expect(indices.every((i) => i > 0 && i * 3 < gif.gct.length)).toBe(true)
  })

  it('survives streams long enough to grow and reset the code table', () => {
    const frame = frameOf(128, 128, (img) => {
      for (let y = 0; y < 128; y++) {
        for (let x = 0; x < 128; x++) {
          setPixel(img, x, y, [(x * 7 + y * 13) % 256 > 128 ? 255 : 0, (x * y) % 200, x % 255, 255])
        }
      }
    })
    const gif = parseGif(encodeGif([frame], 8))
    const indices = lzwDecode(gif.images[0].minCodeSize, gif.images[0].data, 128 * 128)
    expect(indices).toHaveLength(128 * 128)
  })
})
