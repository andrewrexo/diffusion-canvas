import { describe, expect, it } from 'vitest'
import { applyPalette, medianCut, nearestColor, type RGB } from './color'
import { setPixel, type RGBA } from './tools'

const BLACK: RGB = [0, 0, 0]
const WHITE: RGB = [255, 255, 255]

function imageOf(w: number, h: number, paint: (img: ImageData) => void) {
  const img = new ImageData(w, h)
  paint(img)
  return img
}

const fill = (img: ImageData, c: RGBA) => {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) setPixel(img, x, y, c)
  }
}

describe('nearestColor', () => {
  it('picks the perceptually closest entry', () => {
    const palette: RGB[] = [BLACK, WHITE, [255, 0, 0]]
    expect(nearestColor(palette, 240, 10, 10)).toEqual([255, 0, 0])
    expect(nearestColor(palette, 20, 20, 20)).toEqual(BLACK)
    expect(nearestColor(palette, 200, 200, 200)).toEqual(WHITE)
  })
})

describe('medianCut', () => {
  it('finds the two dominant clusters', () => {
    const img = imageOf(8, 8, (im) => {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          setPixel(im, x, y, x < 4 ? [10 + x, 10, 10, 255] : [240 + (x % 2), 240, 240, 255])
        }
      }
    })
    const palette = medianCut([img], 2)
    expect(palette).toHaveLength(2)
    const sorted = [...palette].sort((a, b) => a[0] - b[0])
    expect(sorted[0][0]).toBeLessThan(30)
    expect(sorted[1][0]).toBeGreaterThan(220)
  })

  it('never returns more colors than the image has', () => {
    const img = imageOf(4, 1, (im) => {
      setPixel(im, 0, 0, [255, 0, 0, 255])
      setPixel(im, 1, 0, [0, 255, 0, 255])
      setPixel(im, 2, 0, [255, 0, 0, 255])
      setPixel(im, 3, 0, [0, 255, 0, 255])
    })
    expect(medianCut([img], 16).length).toBeLessThanOrEqual(2)
  })

  it('returns nothing for fully transparent input', () => {
    expect(medianCut([new ImageData(4, 4)], 8)).toEqual([])
  })

  it('pools colors across frames', () => {
    const a = imageOf(2, 2, (im) => fill(im, [255, 0, 0, 255]))
    const b = imageOf(2, 2, (im) => fill(im, [0, 0, 255, 255]))
    const palette = medianCut([a, b], 4)
    expect(palette).toHaveLength(2)
  })
})

describe('applyPalette', () => {
  it('maps every opaque pixel to an exact palette color and keeps alpha', () => {
    const img = imageOf(4, 4, (im) => {
      fill(im, [37, 141, 200, 255])
      setPixel(im, 0, 0, [0, 0, 0, 0])
    })
    const out = applyPalette(img, [BLACK, WHITE], 'none', 1)
    expect(out.data[3]).toBe(0)
    for (let i = 4; i < out.data.length; i += 4) {
      const v = out.data[i]
      expect(v === 0 || v === 255).toBe(true)
      expect(out.data[i + 1]).toBe(v)
      expect(out.data[i + 3]).toBe(255)
    }
  })

  it('does not mutate the input', () => {
    const img = imageOf(2, 2, (im) => fill(im, [100, 100, 100, 255]))
    applyPalette(img, [BLACK, WHITE], 'floyd', 1)
    expect(img.data[0]).toBe(100)
  })

  it('floyd–steinberg approximates mid-gray with a black/white mix', () => {
    const img = imageOf(16, 16, (im) => fill(im, [128, 128, 128, 255]))
    const out = applyPalette(img, [BLACK, WHITE], 'floyd', 1)
    let white = 0
    for (let i = 0; i < out.data.length; i += 4) if (out.data[i] === 255) white++
    expect(white / 256).toBeGreaterThan(0.35)
    expect(white / 256).toBeLessThan(0.65)
  })

  it('ordered dithering is deterministic and mixes both colors', () => {
    const img = imageOf(8, 8, (im) => fill(im, [128, 128, 128, 255]))
    const a = applyPalette(img, [BLACK, WHITE], 'ordered', 1)
    const b = applyPalette(img, [BLACK, WHITE], 'ordered', 1)
    expect(a.data).toEqual(b.data)
    const values = new Set<number>()
    for (let i = 0; i < a.data.length; i += 4) values.add(a.data[i])
    expect(values).toEqual(new Set([0, 255]))
  })

  it('strength zero disables dithering entirely', () => {
    const img = imageOf(8, 8, (im) => fill(im, [128, 128, 128, 255]))
    const out = applyPalette(img, [BLACK, WHITE], 'ordered', 0)
    const values = new Set<number>()
    for (let i = 0; i < out.data.length; i += 4) values.add(out.data[i])
    expect(values.size).toBe(1)
  })
})
