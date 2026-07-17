export const uid = () => Math.random().toString(36).slice(2, 10)

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
