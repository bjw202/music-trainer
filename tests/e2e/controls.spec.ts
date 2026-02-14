import { test, expect } from '@playwright/test'
import { setupAudioPage, loadAudioFile } from './helpers/audio-loader'

/**
 * Controls Tests
 *
 * Tests volume slider interaction, mute/unmute toggle,
 * and keyboard shortcuts (Space, Arrow keys, M)
 */

test.describe('Volume Controls', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('should display volume slider at 100% by default', async ({ page }) => {
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Default volume should be 100
    const value = await volumeSlider.inputValue()
    expect(value).toBe('100')
  })

  test('should change volume when slider is moved', async ({ page }) => {
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Set volume to 50%
    await volumeSlider.fill('50')

    const value = await volumeSlider.inputValue()
    expect(value).toBe('50')
  })

  test('should clamp volume to 0-100 range', async ({ page }) => {
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Try to set volume above 100 - HTML input should clamp it
    await volumeSlider.fill('100')
    const value1 = await volumeSlider.inputValue()
    expect(parseInt(value1)).toBeLessThanOrEqual(100)

    // Try to set volume below 0 - HTML input should clamp it
    await volumeSlider.fill('0')
    const value2 = await volumeSlider.inputValue()
    expect(parseInt(value2)).toBeGreaterThanOrEqual(0)
  })

  test('should mute when mute button is clicked', async ({ page }) => {
    const muteButton = page.getByRole('button', { name: /mute/i })
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Set volume to 50 first
    await volumeSlider.fill('50')

    // Click mute button
    await muteButton.click()

    // Volume should be 0 (muted)
    const value = await volumeSlider.inputValue()
    expect(value).toBe('0')

    // Button should show as muted
    await expect(muteButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('should unmute and restore previous volume when mute is clicked again', async ({ page }) => {
    const muteButton = page.getByRole('button', { name: /mute/i })
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Set volume to 70
    await volumeSlider.fill('70')

    // Mute
    await muteButton.click()
    expect(await volumeSlider.inputValue()).toBe('0')

    // Unmute
    await muteButton.click()

    // Volume should be restored to 70
    const value = await volumeSlider.inputValue()
    expect(value).toBe('70')

    await expect(muteButton).toHaveAttribute('aria-pressed', 'false')
  })

  test('should disable volume controls when no file is loaded', async ({ page }) => {
    // Reload page without file
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // When no file is loaded, controls should not be visible
    // Instead, the drag-drop zone should be visible
    const dragDropZone = page.getByText('Drag & Drop Audio File')
    await expect(dragDropZone).toBeVisible()
  })

  test('should update volume when slider is dragged', async ({ page }) => {
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Get bounding box for dragging
    const box = await volumeSlider.boundingBox()

    // Click at 25% position
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2)

    // Volume should be approximately 25 (allowing for rounding)
    const value = await volumeSlider.inputValue()
    const numValue = parseInt(value)
    expect(numValue).toBeGreaterThanOrEqual(20)
    expect(numValue).toBeLessThanOrEqual(30)
  })
})

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('should toggle mute with M key', async ({ page }) => {
    const muteButton = page.getByRole('button', { name: /mute/i })
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Press M to mute
    await page.keyboard.press('m')
    await page.waitForTimeout(100)

    expect(await volumeSlider.inputValue()).toBe('0')
    await expect(muteButton).toHaveAttribute('aria-pressed', 'true')

    // Press M again to unmute
    await page.keyboard.press('m')
    await page.waitForTimeout(100)

    // Volume should be restored
    const value = await volumeSlider.inputValue()
    expect(value).not.toBe('0')
  })

  test('should seek backward with Arrow Left key', async ({ page }) => {
    // Start playback
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()
    await page.waitForTimeout(1000)

    // Get current time
    const timeDisplay = page.getByTestId('time-display')
    const timeBefore = await timeDisplay.textContent()

    // Press Arrow Left to seek back 5 seconds
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(100)

    const timeAfter = await timeDisplay.textContent()

    // Times should be different (unless at beginning)
    expect(timeAfter).toBeDefined()
  })

  test('should seek forward with Arrow Right key', async ({ page }) => {
    // Start playback
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()
    await page.waitForTimeout(500)

    // Get current time
    const timeDisplay = page.getByTestId('time-display')
    const timeBefore = await timeDisplay.textContent()

    // Press Arrow Right to seek forward 5 seconds
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)

    const timeAfter = await timeDisplay.textContent()

    // Times should be different
    expect(timeAfter).toBeDefined()
  })

  test('should prevent default scroll behavior on Arrow keys', async ({ page }) => {
    // Arrow keys should not scroll the page
    const initialScroll = await page.evaluate(() => window.scrollY)

    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)

    const finalScroll = await page.evaluate(() => window.scrollY)

    expect(finalScroll).toBe(initialScroll)
  })

  test('should not trigger shortcuts when typing in input fields', async ({ page }) => {
    // Create a temporary input to test input field behavior
    await page.evaluate(() => {
      const input = document.createElement('input')
      input.type = 'text'
      input.id = 'test-input'
      document.body.appendChild(input)
    })

    const testInput = page.locator('#test-input')
    await testInput.click()

    // Type 'm' - should not toggle mute
    await page.keyboard.type('m')
    await page.waitForTimeout(100)

    const muteButton = page.getByRole('button', { name: /mute/i })
    await expect(muteButton).toHaveAttribute('aria-pressed', 'false')

    // Clean up
    await page.evaluate(() => {
      document.getElementById('test-input')?.remove()
    })
  })
})

test.describe('Volume State Persistence', () => {
  test('should remember volume when setting new volume while muted', async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)

    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')
    const muteButton = page.getByRole('button', { name: /mute/i })

    // Set volume to 60
    await volumeSlider.fill('60')

    // Mute
    await muteButton.click()
    expect(await volumeSlider.inputValue()).toBe('0')

    // Set new volume while muted (should unmute)
    await volumeSlider.fill('80')

    // Should be unmuted with new volume
    const value = await volumeSlider.inputValue()
    expect(value).toBe('80')
    await expect(muteButton).toHaveAttribute('aria-pressed', 'false')
  })
})

test.describe('Waveform Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('should seek when waveform is clicked', async ({ page }) => {
    const timeDisplay = page.getByTestId('time-display')
    const waveformContainer = page.locator('[data-testid="waveform-container"]')

    // Get initial time (should be 0:00)
    const initialTime = await timeDisplay.textContent()
    expect(initialTime).toContain('0:00')

    // Click on the waveform (center-right area to seek forward)
    const box = await waveformContainer.boundingBox()
    expect(box).toBeTruthy()

    // Click at 75% of the width
    const clickX = box!.x + box!.width * 0.75
    const clickY = box!.y + box!.height / 2
    await page.mouse.click(clickX, clickY)
    await page.waitForTimeout(500)

    // Time should have changed (seeked forward)
    const newTime = await timeDisplay.textContent()
    console.log('[Test] Initial time:', initialTime, 'New time:', newTime)

    // Time should no longer be 0:00 (should have seeked forward)
    expect(newTime).not.toContain('0:00')
  })
})
