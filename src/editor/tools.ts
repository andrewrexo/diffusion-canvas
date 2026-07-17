export type RGBA = readonly [number, number, number, number]

export const cloneImage = (img: ImageData) =>
  new ImageData(new Uint8ClampedArray(img.data), img.width, img.height)

export function getPixel(img: ImageData, x: number, y: number): RGBA {
  const i = (y * img.width + x) * 4
  const d = img.data
  return [d[i], d[i + 1], d[i + 2], d[i + 3]]
}

export function setPixel(img: ImageData, x: number, y: number, c: RGBA) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return
  const i = (y * img.width + x) * 4
  img.data[i] = c[0]
  img.data[i + 1] = c[1]
  img.data[i + 2] = c[2]
  img.data[i + 3] = c[3]
}

export function drawBrush(img: ImageData, x: number, y: number, size: number, c: RGBA) {
  const o = Math.floor((size - 1) / 2)
  for (let by = 0; by < size; by++) {
    for (let bx = 0; bx < size; bx++) {
      setPixel(img, x - o + bx, y - o + by, c)
    }
  }
}

export function drawLine(
  img: ImageData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size: number,
  c: RGBA
) {
  const dx = Math.abs(x1 - x0)
  const sx = x0 < x1 ? 1 : -1
  const dy = -Math.abs(y1 - y0)
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    drawBrush(img, x0, y0, size, c)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0 += sy
    }
  }
}

export function drawRect(
  img: ImageData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size: number,
  c: RGBA
) {
  const [ax, bx] = x0 < x1 ? [x0, x1] : [x1, x0]
  const [ay, by] = y0 < y1 ? [y0, y1] : [y1, y0]
  drawLine(img, ax, ay, bx, ay, size, c)
  drawLine(img, ax, by, bx, by, size, c)
  drawLine(img, ax, ay, ax, by, size, c)
  drawLine(img, bx, ay, bx, by, size, c)
}

export function floodFill(img: ImageData, x: number, y: number, c: RGBA) {
  const { width: w, height: h, data } = img
  if (x < 0 || y < 0 || x >= w || y >= h) return
  const i0 = (y * w + x) * 4
  const [tr, tg, tb, ta] = [data[i0], data[i0 + 1], data[i0 + 2], data[i0 + 3]]
  if (tr === c[0] && tg === c[1] && tb === c[2] && ta === c[3]) return
  const stack = [y * w + x]
  while (stack.length) {
    const p = stack.pop()!
    const i = p * 4
    if (data[i] !== tr || data[i + 1] !== tg || data[i + 2] !== tb || data[i + 3] !== ta) continue
    data[i] = c[0]
    data[i + 1] = c[1]
    data[i + 2] = c[2]
    data[i + 3] = c[3]
    const px = p % w
    if (px > 0) stack.push(p - 1)
    if (px < w - 1) stack.push(p + 1)
    if (p >= w) stack.push(p - w)
    if (p + w < w * h) stack.push(p + w)
  }
}

export function hexToRgba(hex: string): RGBA | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const v = parseInt(m[1], 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255]
}

export const rgbaToHex = (c: RGBA) =>
  '#' + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1)
