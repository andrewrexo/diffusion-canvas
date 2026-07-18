import { describe, expect, it } from 'vitest'
import {
  cloneImage,
  drawBrush,
  drawLine,
  drawRect,
  floodFill,
  getPixel,
  hexToRgba,
  rgbaToHex,
  type RGBA,
} from './tools'

const RED: RGBA = [255, 0, 0, 255]
const BLUE: RGBA = [0, 0, 255, 255]

const blank = (w = 8, h = 8) => new ImageData(w, h)

const opaqueCount = (img: ImageData) => {
  let n = 0
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0) n++
  return n
}

describe('drawLine', () => {
  it('covers both endpoints of a diagonal with no gaps', () => {
    const img = blank()
    drawLine(img, 0, 0, 7, 7, 1, RED)
    for (let i = 0; i < 8; i++) expect(getPixel(img, i, i)).toEqual(RED)
    expect(opaqueCount(img)).toBe(8)
  })

  it('draws horizontal and vertical runs exactly', () => {
    const img = blank()
    drawLine(img, 1, 2, 6, 2, 1, RED)
    expect(opaqueCount(img)).toBe(6)
    for (let x = 1; x <= 6; x++) expect(getPixel(img, x, 2)).toEqual(RED)

    drawLine(img, 4, 0, 4, 7, 1, BLUE)
    for (let y = 0; y <= 7; y++) expect(getPixel(img, 4, y)).toEqual(BLUE)
    expect(getPixel(img, 3, 2)).toEqual(RED)
  })

  it('handles single-point lines', () => {
    const img = blank()
    drawLine(img, 3, 3, 3, 3, 1, RED)
    expect(opaqueCount(img)).toBe(1)
    expect(getPixel(img, 3, 3)).toEqual(RED)
  })
})

describe('drawBrush', () => {
  it('size 1 sets exactly one pixel', () => {
    const img = blank()
    drawBrush(img, 4, 4, 1, RED)
    expect(opaqueCount(img)).toBe(1)
  })

  it('size 3 covers a 3×3 block around the point', () => {
    const img = blank()
    drawBrush(img, 4, 4, 3, RED)
    expect(opaqueCount(img)).toBe(9)
    expect(getPixel(img, 3, 3)).toEqual(RED)
    expect(getPixel(img, 5, 5)).toEqual(RED)
    expect(getPixel(img, 6, 4)[3]).toBe(0)
  })

  it('clips at the image edge instead of wrapping', () => {
    const img = blank()
    drawBrush(img, 0, 0, 3, RED)
    expect(opaqueCount(img)).toBe(4)
    expect(getPixel(img, 7, 7)[3]).toBe(0)
    expect(getPixel(img, 7, 0)[3]).toBe(0)
  })
})

describe('drawRect', () => {
  it('outlines without filling the interior', () => {
    const img = blank()
    drawRect(img, 1, 1, 6, 6, 1, RED)
    expect(opaqueCount(img)).toBe(20)
    expect(getPixel(img, 1, 1)).toEqual(RED)
    expect(getPixel(img, 6, 6)).toEqual(RED)
    expect(getPixel(img, 3, 3)[3]).toBe(0)
  })

  it('normalizes reversed corners', () => {
    const a = blank()
    const b = blank()
    drawRect(a, 1, 1, 6, 6, 1, RED)
    drawRect(b, 6, 6, 1, 1, 1, RED)
    expect(b.data).toEqual(a.data)
  })
})

describe('floodFill', () => {
  it('fills an enclosed region up to the boundary', () => {
    const img = blank()
    drawRect(img, 1, 1, 6, 6, 1, RED)
    floodFill(img, 3, 3, BLUE)
    expect(getPixel(img, 2, 2)).toEqual(BLUE)
    expect(getPixel(img, 5, 5)).toEqual(BLUE)
    expect(getPixel(img, 1, 1)).toEqual(RED)
    expect(getPixel(img, 0, 0)[3]).toBe(0)
    expect(opaqueCount(img)).toBe(20 + 16)
  })

  it('fills the whole image from a corner when empty', () => {
    const img = blank()
    floodFill(img, 0, 0, RED)
    expect(opaqueCount(img)).toBe(64)
  })

  it('is a no-op when the target already matches the fill color', () => {
    const img = blank()
    drawBrush(img, 4, 4, 1, RED)
    const before = cloneImage(img)
    floodFill(img, 4, 4, RED)
    expect(img.data).toEqual(before.data)
  })

  it('ignores out-of-bounds start points', () => {
    const img = blank()
    floodFill(img, -1, 0, RED)
    floodFill(img, 8, 8, RED)
    expect(opaqueCount(img)).toBe(0)
  })
})

describe('cloneImage', () => {
  it('copies pixels so mutations do not leak back', () => {
    const img = blank()
    const copy = cloneImage(img)
    drawBrush(copy, 0, 0, 1, RED)
    expect(getPixel(img, 0, 0)[3]).toBe(0)
    expect(getPixel(copy, 0, 0)).toEqual(RED)
  })
})

describe('hex conversion', () => {
  it('round-trips through rgba', () => {
    expect(rgbaToHex(hexToRgba('#f0a441')!)).toBe('#f0a441')
    expect(hexToRgba('38b764')).toEqual([0x38, 0xb7, 0x64, 255])
  })

  it('pads small channel values', () => {
    expect(rgbaToHex([0, 10, 255, 255])).toBe('#000aff')
  })

  it('rejects malformed input', () => {
    expect(hexToRgba('#12345')).toBeNull()
    expect(hexToRgba('zzzzzz')).toBeNull()
    expect(hexToRgba('')).toBeNull()
  })
})
