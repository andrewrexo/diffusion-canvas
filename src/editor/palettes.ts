export const SWEETIE_16 = [
  '#1a1c2c',
  '#5d275d',
  '#b13e53',
  '#ef7d57',
  '#ffcd75',
  '#a7f070',
  '#38b764',
  '#257179',
  '#29366f',
  '#3b5dc9',
  '#41a6f6',
  '#73eff7',
  '#f4f4f4',
  '#94b0c2',
  '#566c86',
  '#333c57',
]

export function extractPalette(img: ImageData, max = 24): string[] {
  const counts = new Map<number, number>()
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => '#' + k.toString(16).padStart(6, '0'))
}
