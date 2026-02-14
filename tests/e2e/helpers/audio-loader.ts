import { Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const TEST_AUDIO = path.join(process.cwd(), 'public/test-audio/test-song.mp3')

/**
 * Audio file loader helper for E2E tests
 *
 * Loads audio file using base64 encoding and DataTransfer API
 * to work around Playwright's setInputFiles limitations with
 * hidden file inputs.
 */
export async function loadAudioFile(page: Page): Promise<void> {
  // Read file as base64
  const fileBuffer = fs.readFileSync(TEST_AUDIO)
  const base64 = fileBuffer.toString('base64')

  // Wait for AudioEngine to be ready
  await waitForAudioEngine(page)

  // Load file via page.evaluate
  await page.evaluate(({ base64Data }) => {
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const file = new File([byteArray], 'test-song.mp3', { type: 'audio/mpeg' })

    const input = document.querySelector('input[data-testid="file-input"]') as HTMLInputElement
    if (input) {
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      input.files = dataTransfer.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, { base64Data: base64 })

  // Wait for waveform to appear
  await page.waitForSelector('[data-testid="waveform-container"]', { timeout: 10000 })
}

/**
 * Wait for AudioEngine to be initialized
 */
export async function waitForAudioEngine(page: Page): Promise<void> {
  // First, trigger user gesture to enable AudioContext
  await page.evaluate(() => {
    document.body.click()
  })

  // Wait for isReady: true in console
  let isReady = false
  const listener = (msg: any) => {
    if (msg.text().includes('isReady: true')) {
      isReady = true
    }
  }
  page.on('console', listener)

  // Poll for ready state
  for (let i = 0; i < 20; i++) {
    if (isReady) break
    await page.waitForTimeout(250)
  }

  page.off('console', listener)
}

/**
 * Setup page for audio tests with console logging
 */
export async function setupAudioPage(page: Page): Promise<void> {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text())
    }
  })
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message)
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Wait for drag drop zone to be visible
  await page.waitForSelector('text=Drop your audio file here')
}
