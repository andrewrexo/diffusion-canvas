import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/* 16×4 sheet: four 4×4 frames in distinct colors */
const SHEET_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAECAYAAACHtL/sAAAANklEQVR4AcTMoQ0AIAwFUdKpSEhYAo1jBQZDMQOCma72+4pe8uzZ6QNV70K1+VD8jbISLH/gAAAA//+oiGf6AAAABklEQVQDAN1NKNWx+pxIAAAAAElFTkSuQmCC'

async function dropSprite(page: Page, x: number, y: number) {
  await page.locator('.canvas').evaluate(
    async (el, pos) => {
      const c = document.createElement('canvas')
      c.width = 16
      c.height = 16
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#b13e53'
      ctx.fillRect(0, 0, 16, 16)
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))
      const dt = new DataTransfer()
      dt.items.add(new File([blob], 'sprite.png', { type: 'image/png' }))
      el.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: dt,
          clientX: pos.x,
          clientY: pos.y,
          bubbles: true,
          cancelable: true,
        })
      )
    },
    { x, y }
  )
  await page.locator('.image-node').first().waitFor()
}

async function connect(page: Page, fromSel: string, toSel: string) {
  const from = (await page.locator(fromSel).boundingBox())!
  const to = (await page.locator(toSel).boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('.canvas').waitFor()
})

test('draws in the pixel editor and saves to the canvas', async ({ page }) => {
  await page.click('button[title="New drawing"]')
  const canvas = page.locator('.ed-stage canvas')
  await canvas.waitFor()
  const bb = (await canvas.boundingBox())!
  const cx = bb.x + bb.width / 2
  const cy = bb.y + bb.height / 2

  await page.mouse.move(cx - 80, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 80, cy + 40, { steps: 8 })
  await page.mouse.up()

  const save = page.locator('.ed-top .btn.primary')
  await expect(save).toBeEnabled()
  await save.click()

  await expect(page.locator('.editor')).toHaveCount(0)
  await expect(page.locator('.image-node')).toHaveCount(1)
  await expect(page.locator('.image-node .node-dims')).toHaveText('64×64')
})

test('frame timeline: duplicate, navigate, and save an animation', async ({ page }) => {
  await page.click('button[title="New drawing"]')
  const canvas = page.locator('.ed-stage canvas')
  await canvas.waitFor()
  const bb = (await canvas.boundingBox())!
  const cx = bb.x + bb.width / 2
  const cy = bb.y + bb.height / 2

  await page.mouse.move(cx - 60, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 60, cy, { steps: 4 })
  await page.mouse.up()

  await page.click('.ed-frame.add')
  await expect(page.locator('.ed-frame:not(.add)')).toHaveCount(2)
  await expect(page.locator('.ed-frame.active span')).toHaveText('2')

  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.ed-frame:not(.add)')).toHaveCount(1)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(page.locator('.ed-frame:not(.add)')).toHaveCount(2)

  await page.mouse.move(cx, cy - 60)
  await page.mouse.down()
  await page.mouse.move(cx, cy + 60, { steps: 4 })
  await page.mouse.up()

  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.ed-hud')).toContainText('f1/2')

  await page.click('.ed-top .btn.primary')
  await expect(page.locator('.image-node .node-dims')).toHaveText('64×64 · 2f')
})

test('generates through the node graph with a mocked API', async ({ page }) => {
  await page.route('**/api/rd/v1/inferences/credits', (route) =>
    route.fulfill({ json: { credits: 0, balance: 5 } })
  )
  await page.route('**/api/rd/v1/inferences', (route) =>
    route.fulfill({
      json: { base64_images: [PNG_1PX], balance_cost: 0.01, remaining_balance: 4.99 },
    })
  )

  await dropSprite(page, 260, 320)
  await page.mouse.dblclick(950, 360)
  await expect(page.locator('.gen-node')).toHaveCount(1)
  await page.fill('.gen-prompt', 'test sprite')

  await connect(page, '.image-node .port-out', '.gen-node .port-in[data-port="source"]')
  await expect(page.locator('.edge-layer path')).toHaveCount(1)
  await expect(page.locator('.gen-label')).toHaveText('Strength')

  await page.click('button[title="Settings"]')
  await page.fill('.field input', 'rdpk-e2e-test')
  await page.click('.dialog-actions .btn.primary')
  await expect(page.locator('.chip')).toHaveText('$5.00')

  await page.click('.gen-run')
  await expect(page.locator('.image-node')).toHaveCount(2)
  await expect(page.locator('.edge-layer path.edge-output')).toHaveCount(1)
  await expect(page.locator('.image-node.selected .node-name')).toHaveText('test sprite')
  await expect(page.locator('.chip')).toHaveText('$4.99')
})

test('animation styles produce multi-frame nodes from spritesheets', async ({ page }) => {
  let requestBody: Record<string, unknown> = {}
  await page.route('**/api/rd/v1/inferences/credits', (route) =>
    route.fulfill({ json: { credits: 0, balance: 5 } })
  )
  await page.route('**/api/rd/v1/inferences', (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>
    return route.fulfill({
      json: { base64_images: [SHEET_PNG], balance_cost: 0.03, remaining_balance: 4.97 },
    })
  })

  await page.mouse.dblclick(700, 400)
  await page.selectOption('.gen-style', 'rd_animation__any_animation')
  await expect(page.locator('.gen-frames')).toHaveValue('4')
  await page.fill('.gen-prompt', 'walking knight')
  await page.click('button[title="Settings"]')
  await page.fill('.field input', 'rdpk-e2e-test')
  await page.click('.dialog-actions .btn.primary')

  await page.click('.gen-run')
  await expect(page.locator('.image-node')).toHaveCount(1)
  await expect(page.locator('.image-node .node-dims')).toHaveText('4×4 · 4f')
  expect(requestBody.return_spritesheet).toBe(true)
  expect(requestBody.frames_duration).toBe(4)
})

test('exports an animation as a decodable GIF', async ({ page }) => {
  await page.route('**/api/rd/v1/inferences/credits', (route) =>
    route.fulfill({ json: { credits: 0, balance: 5 } })
  )
  await page.route('**/api/rd/v1/inferences', (route) =>
    route.fulfill({
      json: { base64_images: [SHEET_PNG], balance_cost: 0.03, remaining_balance: 4.97 },
    })
  )
  await page.mouse.dblclick(700, 400)
  await page.selectOption('.gen-style', 'rd_animation__any_animation')
  await page.fill('.gen-prompt', 'walking knight')
  await page.click('button[title="Settings"]')
  await page.fill('.field input', 'rdpk-e2e-test')
  await page.click('.dialog-actions .btn.primary')
  await page.click('.gen-run')
  await expect(page.locator('.image-node')).toHaveCount(1)

  await page.hover('.image-node')
  await page.click('.image-node .node-action')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('.export-menu button:has-text("GIF 4×")'),
  ])
  expect(download.suggestedFilename()).toBe('walking knight@4x.gif')

  const buf = readFileSync((await download.path())!)
  expect(buf.subarray(0, 6).toString('latin1')).toBe('GIF89a')
  expect(buf[buf.length - 1]).toBe(0x3b)

  interface Decoderish {
    tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } }
  }
  const frameCount = await page.evaluate(async (b64) => {
    const g = globalThis as unknown as {
      ImageDecoder?: new (init: { data: Uint8Array; type: string }) => Decoderish
    }
    if (!g.ImageDecoder) return -1
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const decoder = new g.ImageDecoder({ data: bytes, type: 'image/gif' })
    await decoder.tracks.ready
    return decoder.tracks.selectedTrack.frameCount
  }, buf.toString('base64'))
  expect(frameCount).toBe(4)
})

test('surfaces API errors on the generator card', async ({ page }) => {
  await page.route('**/api/rd/**', (route) =>
    route.fulfill({ status: 403, json: { detail: 'Invalid or expired API token' } })
  )

  await page.mouse.dblclick(700, 400)
  await page.fill('.gen-prompt', 'anything')
  await page.click('button[title="Settings"]')
  await page.fill('.field input', 'rdpk-bad-key')
  await page.click('.dialog-actions .btn.primary')

  await page.click('.gen-run')
  await expect(page.locator('.gen-dot.error')).toHaveCount(1)
  await expect(page.locator('.gen-error')).toHaveText('Invalid or expired API token')
  await expect(page.locator('.gen-run')).toBeEnabled()
})

test('persists the project across reloads and undoes deletion', async ({ page }) => {
  await dropSprite(page, 400, 400)
  await page.mouse.dblclick(900, 300)
  await expect(page.locator('.gen-node')).toHaveCount(1)
  await connect(page, '.image-node .port-out', '.gen-node .port-in[data-port="source"]')

  await page.reload()
  await expect(page.locator('.image-node')).toHaveCount(1)
  await expect(page.locator('.gen-node')).toHaveCount(1)
  await expect(page.locator('.edge-layer path')).toHaveCount(1)

  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await expect(page.locator('.empty-hint')).toBeVisible()

  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.image-node')).toHaveCount(1)
  await expect(page.locator('.edge-layer path')).toHaveCount(1)
})
