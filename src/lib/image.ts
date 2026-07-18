import { encodeGif } from './gif'
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

export async function sliceSpritesheet(
  data: string,
  count: number
): Promise<{ frames: string[]; w: number; h: number }> {
  const img = await loadImage(data)
  const fw = img.naturalWidth / count
  if (count < 2 || !Number.isInteger(fw)) {
    return { frames: [data], w: img.naturalWidth, h: img.naturalHeight }
  }
  const canvas = document.createElement('canvas')
  canvas.width = fw
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  const frames = Array.from({ length: count }, (_, i) => {
    ctx.clearRect(0, 0, fw, canvas.height)
    ctx.drawImage(img, -i * fw, 0)
    return canvas.toDataURL('image/png')
  })
  return { frames, w: fw, h: img.naturalHeight }
}

const safeName = (name: string) => name.replace(/[^\w\- ]+/g, '').trim() || 'pixel-art'

const suffix = (factor: number) => (factor > 1 ? `@${factor}x` : '')

function downloadUrl(url: string, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
}

export async function downloadPng(data: string, name: string, w: number, h: number, factor: number) {
  const img = await loadImage(data)
  const canvas = document.createElement('canvas')
  canvas.width = w * factor
  canvas.height = h * factor
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  downloadUrl(canvas.toDataURL('image/png'), `${safeName(name)}${suffix(factor)}.png`)
}

async function scaledFrames(frames: string[], w: number, h: number, factor: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w * factor
  canvas.height = h * factor
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const images = await Promise.all(frames.map(loadImage))
  return images.map((img) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  })
}

export async function downloadGif(
  frames: string[],
  name: string,
  w: number,
  h: number,
  fps: number,
  factor: number
) {
  const bytes = encodeGif(await scaledFrames(frames, w, h, factor), fps)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' }))
  downloadUrl(url, `${safeName(name)}${suffix(factor)}.gif`)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function downloadSheet(
  frames: string[],
  name: string,
  w: number,
  h: number,
  factor: number
) {
  const canvas = document.createElement('canvas')
  canvas.width = w * factor * frames.length
  canvas.height = h * factor
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const images = await Promise.all(frames.map(loadImage))
  images.forEach((img, i) => ctx.drawImage(img, i * w * factor, 0, w * factor, h * factor))
  downloadUrl(canvas.toDataURL('image/png'), `${safeName(name)}-sheet${suffix(factor)}.png`)
}
