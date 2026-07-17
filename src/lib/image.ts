import { clamp } from './util'

const MAX_IMPORT_DIM = 1024

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = src
  })
}

export async function decodeImageFile(file: Blob): Promise<{ data: string; w: number; h: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const max = Math.max(img.naturalWidth, img.naturalHeight)
    const s = max > MAX_IMPORT_DIM ? MAX_IMPORT_DIM / max : 1
    const w = Math.max(1, Math.round(img.naturalWidth * s))
    const h = Math.max(1, Math.round(img.naturalHeight * s))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return { data: canvas.toDataURL('image/png'), w, h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/* Power-of-two display scale that lands most images near 256 world units. */
export function displayScale(w: number, h: number) {
  const m = Math.max(w, h)
  return clamp(2 ** Math.round(Math.log2(224 / m)), 0.125, 8)
}
