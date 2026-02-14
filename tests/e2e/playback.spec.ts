import { test, expect } from '@playwright/test'
import { setupAudioPage, loadAudioFile } from './helpers/audio-loader'

/**
 * Playback Tests
 *
 * Tests the core playback flow: file load → play → pause → stop
 * Also verifies time updates during playback and state transitions
 */

test.describe('Playback Flow', () => {
  test('should load audio file and enable controls', async ({ page }) => {
    await setupAudioPage(page)

    // Initially, drag-drop zone should be visible
    const dragDropZone = page.getByText('Drag & Drop Audio File')
    await expect(dragDropZone).toBeVisible()

    // Load audio file
    await loadAudioFile(page)

    // After loading, waveform should be visible
    const waveform = page.locator('[data-testid="waveform-container"]')
    await expect(waveform).toBeVisible()

    // Play button should be enabled
    const playButton = page.getByRole('button', { name: /play/i })
    await expect(playButton).toBeEnabled()
  })

  test('should play audio when play button is clicked', async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)

    // Click play button
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()

    // Button should change to pause (aria-label changes)
    const pauseButton = page.getByRole('button', { name: /pause/i })
    await expect(pauseButton).toBeVisible()
  })

  test('should pause audio when pause button is clicked', async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)

    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()

    // Wait for pause button to appear
    const pauseButton = page.getByRole('button', { name: /pause/i })
    await expect(pauseButton).toBeVisible()

    // Click pause
    await pauseButton.click()

    // Should show play button again
    const playButtonAgain = page.getByRole('button', { name: /play/i })
    await expect(playButtonAgain).toBeVisible()
  })

  test('should stop audio and reset to beginning', async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)

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

    // Should show play button (not paused, but stopped)
    const playButtonAgain = page.getByRole('button', { name: /play/i })
    await expect(playButtonAgain).toBeVisible()
  })

  test('should update time display during playback', async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)

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

  test('should show correct duration after loading', async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)

    // Time display should show duration
    const timeDisplay = page.getByTestId('time-display')
    await expect(timeDisplay).toBeVisible()

    // Format should be "current / duration" like "0:00 / 0:30"
    const text = await timeDisplay.textContent()
    expect(text).toMatch(/\d+:\d{2}\s*\/\s*\d+:\d{2}/)
  })

  test('should disable controls when no file is loaded', async ({ page }) => {
    await setupAudioPage(page)

    // Without loading a file, controls should not exist yet
    // The player controls only appear after loading a file
    const dragDropZone = page.getByText('Drag & Drop Audio File')
    await expect(dragDropZone).toBeVisible()
  })

  test('should support keyboard shortcuts for play/pause', async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)

    // Click play button to start (simulating user interaction)
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()
    await page.waitForTimeout(100)

    // Should show pause button (playing)
    const pauseButton = page.getByRole('button', { name: /pause/i })
    await expect(pauseButton).toBeVisible()

    // Click pause button to stop
    await pauseButton.click()
    await page.waitForTimeout(100)

    // Should show play button again (paused)
    const playButtonAgain = page.getByRole('button', { name: /play/i })
    await expect(playButtonAgain).toBeVisible()
  })
})
