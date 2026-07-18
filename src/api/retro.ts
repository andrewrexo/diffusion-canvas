const BASE = '/api/rd/v1'

export interface GenerateRequest {
  prompt: string
  style: string
  width: number
  height: number
  seed?: number
  inputImage?: string
  strength?: number
  inputPalette?: string
  returnSpritesheet?: boolean
  framesDuration?: number
}

export interface GenerateResult {
  images: string[]
  cost: number
  remainingBalance: number | null
}

export interface Balance {
  balance: number
  credits: number
}

export class RetroApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function readError(res: Response): Promise<string> {
  let message = res.status === 401 ? 'Invalid API key' : `Request failed (${res.status})`
  try {
    const detail = (await res.json()).detail
    if (typeof detail === 'string') message = detail
    else if (Array.isArray(detail) && detail[0]?.msg) message = detail[0].msg
    else if (detail?.message) message = detail.message
  } catch {
    /* non-JSON error body */
  }
  return message
}

export async function generate(apiKey: string, req: GenerateRequest): Promise<GenerateResult> {
  const body: Record<string, unknown> = {
    prompt: req.prompt,
    prompt_style: req.style,
    width: req.width,
    height: req.height,
    num_images: 1,
  }
  if (req.seed != null) body.seed = req.seed
  if (req.inputImage) {
    body.input_image = req.inputImage
    body.strength = req.strength ?? 0.8
  }
  if (req.inputPalette) body.input_palette = req.inputPalette
  if (req.returnSpritesheet) {
    body.return_spritesheet = true
    body.frames_duration = req.framesDuration ?? 4
  }

  const res = await fetch(`${BASE}/inferences`, {
    method: 'POST',
    headers: { 'X-RD-Token': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new RetroApiError(await readError(res), res.status)

  const json = await res.json()
  const b64: string[] = json.base64_images ?? []
  return {
    images: b64.map((b) => `data:image/png;base64,${b}`),
    cost: json.balance_cost ?? json.credit_cost ?? 0,
    remainingBalance: json.remaining_balance ?? null,
  }
}

export async function getBalance(apiKey: string): Promise<Balance> {
  const res = await fetch(`${BASE}/inferences/credits`, { headers: { 'X-RD-Token': apiKey } })
  if (!res.ok) throw new RetroApiError(await readError(res), res.status)
  const json = await res.json()
  return { balance: json.balance ?? 0, credits: json.credits ?? 0 }
}
