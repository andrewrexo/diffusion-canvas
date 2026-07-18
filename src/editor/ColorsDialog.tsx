import { useEffect, useMemo, useState } from 'react'
import { applyPalette, medianCut, type DitherMode, type RGB } from './color'
import { GAME_BOY, PICO_8, SWEETIE_16 } from './palettes'
import { hexToRgba, rgbaToHex } from './tools'

type PaletteSource = 'auto' | 'sweetie' | 'pico8' | 'gameboy'

const PRESETS: Record<Exclude<PaletteSource, 'auto'>, string[]> = {
  sweetie: SWEETIE_16,
  pico8: PICO_8,
  gameboy: GAME_BOY,
}

interface Props {
  frameCount: number
  currentFrame: number
  getFrames: () => ImageData[]
  onPreview: (img: ImageData | null) => void
  onApply: (transform: (img: ImageData) => ImageData, all: boolean) => void
  onClose: () => void
}

export function ColorsDialog({
  frameCount,
  currentFrame,
  getFrames,
  onPreview,
  onApply,
  onClose,
}: Props) {
  const [source, setSource] = useState<PaletteSource>('auto')
  const [count, setCount] = useState(16)
  const [dither, setDither] = useState<DitherMode>('none')
  const [strength, setStrength] = useState(1)
  const [allFrames, setAllFrames] = useState(true)

  const palette = useMemo<RGB[]>(() => {
    if (source !== 'auto') {
      return PRESETS[source].map((hex) => {
        const [r, g, b] = hexToRgba(hex)!
        return [r, g, b] as const
      })
    }
    const frames = getFrames()
    return medianCut(allFrames ? frames : [frames[currentFrame]], count)
  }, [source, count, allFrames, currentFrame, getFrames])

  useEffect(() => {
    const img = getFrames()[currentFrame]
    onPreview(img && palette.length ? applyPalette(img, palette, dither, strength) : null)
  }, [palette, dither, strength, currentFrame, getFrames, onPreview])

  useEffect(() => () => onPreview(null), [onPreview])

  return (
    <div className="ed-colors">
      <div className="ed-colors-head">Reduce colors</div>
      <label className="ed-row">
        <span>Palette</span>
        <select
          className="ed-pal-select"
          value={source}
          onChange={(e) => setSource(e.target.value as PaletteSource)}
        >
          <option value="auto">This image</option>
          <option value="sweetie">Sweetie 16</option>
          <option value="pico8">PICO-8</option>
          <option value="gameboy">Game Boy</option>
        </select>
      </label>
      {source === 'auto' && (
        <label className="ed-row">
          <span>Colors</span>
          <input
            type="range"
            min={2}
            max={64}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10))}
          />
          <span className="gen-value">{count}</span>
        </label>
      )}
      <label className="ed-row">
        <span>Dither</span>
        <select
          className="ed-dither-select"
          value={dither}
          onChange={(e) => setDither(e.target.value as DitherMode)}
        >
          <option value="none">None</option>
          <option value="floyd">Floyd–Steinberg</option>
          <option value="ordered">Ordered (Bayer)</option>
        </select>
      </label>
      {dither !== 'none' && (
        <label className="ed-row">
          <span>Strength</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={strength}
            onChange={(e) => setStrength(parseFloat(e.target.value))}
          />
          <span className="gen-value">{Math.round(strength * 100)}%</span>
        </label>
      )}
      {frameCount > 1 && (
        <label className="ed-check">
          <input
            type="checkbox"
            checked={allFrames}
            onChange={(e) => setAllFrames(e.target.checked)}
          />
          Apply to all frames
        </label>
      )}
      <div className="ed-colors-pal">
        {palette.slice(0, 32).map((c, i) => (
          <i key={i} style={{ background: rgbaToHex([c[0], c[1], c[2], 255]) }} />
        ))}
        {palette.length > 32 && <span>+{palette.length - 32}</span>}
      </div>
      <div className="dialog-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={!palette.length}
          onClick={() => onApply((img) => applyPalette(img, palette, dither, strength), allFrames)}
        >
          Apply
        </button>
      </div>
    </div>
  )
}
