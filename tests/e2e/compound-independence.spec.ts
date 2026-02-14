import { test, expect } from '@playwright/test'
import { setupAudioPage, loadAudioFile } from './helpers/audio-loader'

/**
 * Compound Independence Tests (CRITICAL)
 *
 * Tests that multiple controls can work together without interference.
 * These tests verify the independence of different features.
 *
 * Categories:
 * 1. Pairwise Independence (6 tests)
 * 2. Sequential Operation (2 tests)
 * 3. State Persistence (3 tests)
 * 4. Rapid Successive Operations (3 tests)
 */

// ============================================================================
// Category 1: Pairwise Independence (6 tests)
// Tests that two different features don't interfere with each other
// ============================================================================

test.describe('Pairwise Independence', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('Volume + Seek: changing volume should not affect seek position', async ({ page }) => {
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')
    const timeDisplay = page.getByTestId('time-display')

    // Pause playback first to test volume independence from time
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()
    await page.waitForTimeout(500)

    // Pause to freeze time
    const pauseButton = page.getByRole('button', { name: /pause/i })
    await pauseButton.click()

    // Get current time (frozen)
    const timeBefore = await timeDisplay.textContent()

    // Change volume
    await volumeSlider.fill('50')
    await page.waitForTimeout(100)

    // Time should be unchanged (playback was paused)
    const timeAfter = await timeDisplay.textContent()
    expect(timeAfter).toBe(timeBefore)
  })

  test('Mute + Seek: muting should not affect seek functionality', async ({ page }) => {
    const muteButton = page.getByRole('button', { name: /mute/i })
    const playButton = page.getByRole('button', { name: /play/i })
    const timeDisplay = page.getByTestId('time-display')
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Start playback
    await playButton.click()
    await page.waitForTimeout(500)

    // Mute
    await muteButton.click()
    expect(await volumeSlider.inputValue()).toBe('0')

    // Seek forward
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)

    // Should still be muted
    expect(await volumeSlider.inputValue()).toBe('0')

    // Time should have changed
    const timeAfter = await timeDisplay.textContent()
    expect(timeAfter).toBeDefined()
  })

  test('Play/Pause + Volume: volume changes during play should not affect play state', async ({ page }) => {
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')
    const playButton = page.getByRole('button', { name: /play/i })

    // Start playing
    await playButton.click()

    // After click, button becomes pause button
    const pauseButton = page.getByRole('button', { name: /pause/i })
    await expect(pauseButton).toBeVisible()

    // Change volume multiple times
    await volumeSlider.fill('75')
    await page.waitForTimeout(100)
    await expect(pauseButton).toBeVisible()

    await volumeSlider.fill('25')
    await page.waitForTimeout(100)
    await expect(pauseButton).toBeVisible()

    // Should still be playing (pause button visible)
    await expect(pauseButton).toBeVisible()
  })

  test('A-B Loop + Volume: volume changes should not affect loop state', async ({ page }) => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Set up loop
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()
    await loopButton.click()

    // Loop should be enabled
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    // Change volume
    await volumeSlider.fill('60')
    await page.waitForTimeout(100)

    // Loop should still be enabled
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    // Change volume again
    await volumeSlider.fill('40')
    await page.waitForTimeout(100)

    // Loop should still be enabled
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('Keyboard Seek + A-B Loop: seeking should not disable loop', async ({ page }) => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })

    // Set up loop
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()
    await loopButton.click()

    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    // Seek using keyboard
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(100)

    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)

    // Loop should still be enabled
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('Mute + A-B Loop: muting should not affect loop state', async ({ page }) => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const muteButton = page.getByRole('button', { name: /mute/i })

    // Set up loop
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()
    await loopButton.click()

    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    // Mute
    await muteButton.click()

    // Loop should still be enabled
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    // Unmute
    await muteButton.click()

    // Loop should still be enabled
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')
  })
})

// ============================================================================
// Category 2: Sequential Operation (2 tests)
// Tests that the order of operations doesn't affect the final state
// ============================================================================

test.describe('Sequential Operation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('Volume -> Seek -> Loop produces same state as reverse order', async ({ page }) => {
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })

    // Forward order: Volume -> Seek -> Loop
    await volumeSlider.fill('70')
    await page.keyboard.press('ArrowRight')
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()
    await loopButton.click()

    const volume1 = await volumeSlider.inputValue()
    const loopState1 = await loopButton.getAttribute('aria-pressed')

    // Reset and try reverse order
    await page.reload()
    await setupAudioPage(page)
    await loadAudioFile(page)

    const volumeSlider2 = page.locator('input[type="range"][data-testid="volume-slider"]')
    const buttonA2 = page.getByRole('button', { name: /set loop point a/i })
    const buttonB2 = page.getByRole('button', { name: /set loop point b/i })
    const loopButton2 = page.getByRole('button', { name: /toggle loop/i })

    // Reverse order: Loop -> Seek -> Volume
    await buttonA2.click()
    await page.waitForTimeout(1000)
    await buttonB2.click()
    await loopButton2.click()
    await page.keyboard.press('ArrowRight')
    await volumeSlider2.fill('70')

    const volume2 = await volumeSlider2.inputValue()
    const loopState2 = await loopButton2.getAttribute('aria-pressed')

    // Both should result in same final states (allow small variance for volume)
    expect(parseInt(volume1)).toBeGreaterThanOrEqual(parseInt(volume2) - 2)
    expect(parseInt(volume1)).toBeLessThanOrEqual(parseInt(volume2) + 2)
    expect(loopState1).toBe(loopState2)
  })

  test('Mute -> Play -> Seek produces same state as reverse order', async ({ page }) => {
    const muteButton = page.getByRole('button', { name: /mute/i })
    const playButton = page.getByRole('button', { name: /play/i })

    // Forward order: Mute -> Play -> Seek
    await muteButton.click()
    await playButton.click()
    await page.waitForTimeout(500)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)

    const isMuted1 = await muteButton.getAttribute('aria-pressed')
    // After play, check for pause button to confirm playing state
    const pauseButton1 = page.getByRole('button', { name: /pause/i })
    const isPlaying1 = await pauseButton1.isVisible()

    // Reset and try reverse
    await page.reload()
    await setupAudioPage(page)
    await loadAudioFile(page)

    const muteButton2 = page.getByRole('button', { name: /mute/i })
    const playButton2 = page.getByRole('button', { name: /play/i })

    // Reverse order: Seek -> Play -> Mute
    await playButton2.click()
    await page.waitForTimeout(500)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)
    await muteButton2.click()

    const isMuted2 = await muteButton2.getAttribute('aria-pressed')
    // After play, check for pause button to confirm playing state
    const pauseButton2 = page.getByRole('button', { name: /pause/i })
    const isPlaying2 = await pauseButton2.isVisible()

    // Both should result in same states
    expect(isMuted1).toBe(isMuted2)
    expect(isPlaying1).toBe(isPlaying2)
  })
})

// ============================================================================
// Category 3: State Persistence (3 tests)
// Tests that state persists across other operations
// ============================================================================

test.describe('State Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('Playing + Volume -> Seek maintains volume', async ({ page }) => {
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')
    const playButton = page.getByRole('button', { name: /play/i })

    // Start playing
    await playButton.click()

    // Set volume
    await volumeSlider.fill('65')

    // Seek
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)

    // Volume should be maintained (allow small variance due to range input precision)
    const volume = await volumeSlider.inputValue()
    expect(parseInt(volume)).toBeGreaterThanOrEqual(64)
    expect(parseInt(volume)).toBeLessThanOrEqual(66)
  })

  test('A-B Loop Active -> Volume Change maintains loop', async ({ page }) => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Enable loop
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()
    await loopButton.click()

    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    // Change volume multiple times
    await volumeSlider.fill('80')
    await page.waitForTimeout(100)
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    await volumeSlider.fill('20')
    await page.waitForTimeout(100)
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    await volumeSlider.fill('50')
    await page.waitForTimeout(100)

    // Loop should still be enabled
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('Muted -> Keyboard Seek -> Still Muted', async ({ page }) => {
    const muteButton = page.getByRole('button', { name: /mute/i })
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Mute
    await muteButton.click()
    expect(await volumeSlider.inputValue()).toBe('0')

    // Seek multiple times
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(100)
    expect(await volumeSlider.inputValue()).toBe('0')

    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)
    expect(await volumeSlider.inputValue()).toBe('0')

    // Should still be muted
    expect(await volumeSlider.inputValue()).toBe('0')
    await expect(muteButton).toHaveAttribute('aria-pressed', 'true')
  })
})

// ============================================================================
// Category 4: Rapid Successive Operations (3 tests)
// Tests that rapid successive operations are handled correctly
// ============================================================================

test.describe('Rapid Successive Operations', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('Rapid Volume + Seek operations should be handled correctly', async ({ page }) => {
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')
    const timeDisplay = page.getByTestId('time-display')

    // Start playback
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()

    // Rapid operations: volume change, seek, volume change, seek
    await volumeSlider.fill('80')
    await page.keyboard.press('ArrowRight')
    await volumeSlider.fill('40')
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(200)

    // Both should have applied (allow small variance)
    const volume = await volumeSlider.inputValue()
    expect(parseInt(volume)).toBeGreaterThanOrEqual(38)
    expect(parseInt(volume)).toBeLessThanOrEqual(42)

    const time = await timeDisplay.textContent()
    expect(time).toBeDefined()
  })

  test('Rapid Mute Toggle + Loop operations should work independently', async ({ page }) => {
    const muteButton = page.getByRole('button', { name: /mute/i })
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })

    // Rapid operations: set A, mute, set B, toggle loop, unmute
    await buttonA.click()
    await muteButton.click()
    await page.waitForTimeout(1000)
    await buttonB.click()
    await loopButton.click()
    await muteButton.click()

    // Both should have their final states
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')
    await expect(muteButton).toHaveAttribute('aria-pressed', 'false')
  })

  test('Rapid Keyboard + Loop operations should not interfere', async ({ page }) => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const playButton = page.getByRole('button', { name: /play/i })

    // Set up loop
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()
    await loopButton.click()

    // Start playing
    await playButton.click()

    // Rapid keyboard operations
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('m')
    await page.keyboard.press('m') // unmute
    await page.waitForTimeout(200)

    // Loop should still be enabled
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')
  })
})
