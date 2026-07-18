export type RGB = readonly [number, number, number]

export type DitherMode = 'none' | 'floyd' | 'ordered'

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

export function nearestColor(palette: RGB[], r: number, g: number, b: number): RGB {
  let best = palette[0]
  let bestDist = Infinity
  for (const p of palette) {
    const dr = r - p[0]
    const dg = g - p[1]
    const db = b - p[2]
    const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db
    if (d < bestDist) {
      bestDist = d
      best = p
    }
  }
  return best
}

/* Population-weighted median cut over the opaque pixels of the given frames. */
export function medianCut(frames: ImageData[], count: number): RGB[] {
  const counts = new Map<number, number>()
  for (const img of frames) {
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue
      const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  if (!counts.size) return []

  interface Box {
    colors: number[]
    population: number
  }
  const makeBox = (colors: number[]): Box => ({
    colors,
    population: colors.reduce((sum, c) => sum + counts.get(c)!, 0),
  })
  const channel = (c: number, ch: number) => (c >> ((2 - ch) * 8)) & 255

  const boxes: Box[] = [makeBox([...counts.keys()])]
  while (boxes.length < count) {
    let target = -1
    let targetCh = 0
    let widest = 0
    boxes.forEach((box, bi) => {
      if (box.colors.length < 2) return
      for (let ch = 0; ch < 3; ch++) {
        let min = 255
        let max = 0
        for (const c of box.colors) {
          const v = channel(c, ch)
          if (v < min) min = v
          if (v > max) max = v
        }
        if (max - min > widest) {
          widest = max - min
          target = bi
          targetCh = ch
        }
      }
    })
    if (target < 0) break

    const box = boxes[target]
    const sorted = [...box.colors].sort((a, b) => channel(a, targetCh) - channel(b, targetCh))
    let acc = 0
    let split = 0
    for (; split < sorted.length - 1; split++) {
      acc += counts.get(sorted[split])!
      if (acc >= box.population / 2) break
    }
    boxes.splice(target, 1, makeBox(sorted.slice(0, split + 1)), makeBox(sorted.slice(split + 1)))
  }

  return boxes.map((box) => {
    let r = 0
    let g = 0
    let b = 0
    for (const c of box.colors) {
      const n = counts.get(c)!
      r += ((c >> 16) & 255) * n
      g += ((c >> 8) & 255) * n
      b += (c & 255) * n
    }
    const n = box.population
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)] as const
  })
}

const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

function diffuse(
  err: Float32Array,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  er: number,
  eg: number,
  eb: number,
  k: number
) {
  if (x < 0 || x >= w || y >= h) return
  const p = y * w + x
  if (data[p * 4 + 3] < 128) return
  err[p * 3] += er * k
  err[p * 3 + 1] += eg * k
  err[p * 3 + 2] += eb * k
}

/* Returns a recolored copy; alpha is preserved and transparent pixels are untouched. */
export function applyPalette(
  img: ImageData,
  palette: RGB[],
  mode: DitherMode,
  strength: number
): ImageData {
  const out = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height)
  if (!palette.length) return out
  const { width: w, height: h } = img
  const d = out.data

  if (mode === 'floyd') {
    const err = new Float32Array(w * h * 3)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        const i = p * 4
        if (d[i + 3] < 128) continue
        const r = clamp255(d[i] + err[p * 3])
        const g = clamp255(d[i + 1] + err[p * 3 + 1])
        const b = clamp255(d[i + 2] + err[p * 3 + 2])
        const [pr, pg, pb] = nearestColor(palette, r, g, b)
        d[i] = pr
        d[i + 1] = pg
        d[i + 2] = pb
        const er = (r - pr) * strength
        const eg = (g - pg) * strength
        const eb = (b - pb) * strength
        diffuse(err, d, w, h, x + 1, y, er, eg, eb, 7 / 16)
        diffuse(err, d, w, h, x - 1, y + 1, er, eg, eb, 3 / 16)
        diffuse(err, d, w, h, x, y + 1, er, eg, eb, 5 / 16)
        diffuse(err, d, w, h, x + 1, y + 1, er, eg, eb, 1 / 16)
      }
    }
    return out
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (d[i + 3] < 128) continue
      let r = d[i]
      let g = d[i + 1]
      let b = d[i + 2]
      if (mode === 'ordered') {
        const t = ((BAYER_4[y % 4][x % 4] - 7.5) / 16) * 48 * strength
        r = clamp255(r + t)
        g = clamp255(g + t)
        b = clamp255(b + t)
      }
      const [pr, pg, pb] = nearestColor(palette, r, g, b)
      d[i] = pr
      d[i + 1] = pg
      d[i + 2] = pb
    }
  }
  return out
}
