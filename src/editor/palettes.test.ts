import { describe, expect, it } from 'vitest'
import { extractPalette } from './palettes'
import { setPixel, type RGBA } from './tools'

function imageOf(pixels: RGBA[], w = pixels.length) {
  const img = new ImageData(w, Math.ceil(pixels.length / w))
  pixels.forEach((c, i) => setPixel(img, i % w, Math.floor(i / w), c))
  return img
}

describe('extractPalette', () => {
  it('orders colors by frequency', () => {
    const red: RGBA = [255, 0, 0, 255]
    const blue: RGBA = [0, 0, 255, 255]
    const img = imageOf([red, red, red, blue])
    expect(extractPalette(img)).toEqual(['#ff0000', '#0000ff'])
  })

  it('ignores transparent and near-transparent pixels', () => {
    const img = imageOf([
      [255, 0, 0, 255],
      [0, 255, 0, 0],
      [0, 0, 255, 4],
    ])
    expect(extractPalette(img)).toEqual(['#ff0000'])
  })

  it('caps the palette at max entries', () => {
    const pixels: RGBA[] = []
    for (let i = 0; i < 40; i++) pixels.push([i, 0, 0, 255])
    expect(extractPalette(imageOf(pixels), 24)).toHaveLength(24)
  })

  it('pads hex codes for dark colors', () => {
    expect(extractPalette(imageOf([[0, 0, 10, 255]]))).toEqual(['#00000a'])
  })
})
