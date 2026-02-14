import { test, expect, Page } from '@playwright/test'

/**
 * Playback Tests
 *
 * Tests the core playback flow: file load → play → pause → stop
 * Also verifies time updates during playback and state transitions
 */

test.describe('Playback Flow', () => {
  let page: Page

  test.beforeEach(async ({ page: p }) => {
    page = p
    await page.goto('/')
  })

  test('should load audio file and enable controls', async () => {
    // Initially, drag-drop zone should be visible
    const dragDropZone = page.getByRole('button', { name: /drag and drop/i })
    await expect(dragDropZone).toBeVisible()

    // Click to load file (we'll need to mock file upload)
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')

    // After loading, waveform should be visible
    const waveform = page.locator('[data-testid="waveform-container"]')
    await expect(waveform).toBeVisible({ timeout: 5000 })

    // Play button should be enabled
    const playButton = page.getByRole('button', { name: /play/i })
    await expect(playButton).toBeEnabled()
  })

  test('should play audio when play button is clicked', async () => {
    // Load test audio file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')

    // Wait for file to load
    await page.waitForTimeout(1000)

    // Click play button
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()

    // Should show pause icon
    const pauseIcon = page.locator('svg path[d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"]')
    await expect(pauseIcon).toBeVisible()

    // Check if playing state is reflected (button aria-pressed)
    await expect(playButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('should pause audio when pause button is clicked', async () => {
    // Load and start playing
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)

    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()

    // Wait a bit for playback to start
    await page.waitForTimeout(500)

    // Click pause (same button, now showing pause icon)
    await playButton.click()

    // Should show play icon again
    const playIcon = page.locator('svg path[d="M8 5v14l11-7z"]')
    await expect(playIcon).toBeVisible()

    await expect(playButton).toHaveAttribute('aria-pressed', 'false')
  })

  test('should stop audio and reset to beginning', async () => {
    // Load and start playing
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)

    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()

    // Wait for playback to progress
    await page.waitForTimeout(1000)

    // Click stop button
    const stopButton = page.getByRole('button', { name: /stop/i })
    await stopButton.click()

    // Time should reset to 0:00
    const timeDisplay = page.getByTestId('time-display')
    await expect(timeDisplay).toContainText('0:00')

    // Should show play icon (not paused, but stopped)
    const playIcon = page.locator('svg path[d="M8 5v14l11-7z"]')
    await expect(playIcon).toBeVisible()
  })

  test('should update time display during playback', async () => {
    // Load audio file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)

    // Get initial time
    const timeDisplay = page.getByTestId('time-display')
    const initialTime = await timeDisplay.textContent()

    // Start playback
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()

    // Wait for time to update
    await page.waitForTimeout(2000)

    const currentTime = await timeDisplay.textContent()

    // Time should have changed (unless it's a very short file)
    expect(currentTime).not.toBe(initialTime)
  })

  test('should show correct duration after loading', async () => {
    // Load audio file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')

    // Wait for metadata to load
    await page.waitForTimeout(2000)

    // Time display should show duration
    const timeDisplay = page.getByTestId('time-display')
    await expect(timeDisplay).toBeVisible()

    // Format should be "current / duration" like "0:00 / 0:30"
    const text = await timeDisplay.textContent()
    expect(text).toMatch(/\d+:\d{2}\s*\/\s*\d+:\d{2}/)
  })

  test('should disable controls when no file is loaded', async () => {
    // Without loading a file, controls should be disabled
    const playButton = page.getByRole('button', { name: /play/i })
    const stopButton = page.getByRole('button', { name: /stop/i })

    await expect(playButton).toBeDisabled()
    await expect(stopButton).toBeDisabled()
  })

  test('should support keyboard space bar for play/pause', async () => {
    // Load audio file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)

    const playButton = page.getByRole('button', { name: /play/i })

    // Press space to play
    await page.keyboard.press('Space')
    await page.waitForTimeout(100)

    // Should be playing
    await expect(playButton).toHaveAttribute('aria-pressed', 'true')

    // Press space again to pause
    await page.keyboard.press('Space')
    await page.waitForTimeout(100)

    // Should be paused
    await expect(playButton).toHaveAttribute('aria-pressed', 'false')
  })
})
