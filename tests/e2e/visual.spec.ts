import { test, expect } from '@playwright/test'

/**
 * Visual Regression Tests
 *
 * Tests for visual rendering of waveform, playhead position, and loop regions.
 * Uses Playwright's screenshot comparison for visual regression detection.
 */

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should render initial drag-drop zone correctly', async ({ page }) => {
    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')

    // Take screenshot of drag-drop zone
    const dragDropZone = page.getByText('Drag & Drop Audio File')
    await expect(dragDropZone).toBeVisible()

    // Screenshot comparison (will establish baseline on first run)
    await expect(page).toHaveScreenshot('drag-drop-zone.png', {
      maxDiffPixels: 100, // Allow < 1% pixel difference for 1920x1080
      threshold: 0.01,
    })
  })

  test('should render waveform after loading audio', async ({ page }) => {
    // Load test audio
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')

    // Wait for waveform to render
    await page.waitForTimeout(3000)

    // Take screenshot
    await expect(page).toHaveScreenshot('waveform-rendered.png', {
      maxDiffPixels: 100,
      threshold: 0.01,
    })
  })

  test('should render playhead at correct position', async ({ page }) => {
    // Load audio
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)

    // Start playback
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()

    // Wait for playhead to move
    await page.waitForTimeout(1000)

    // Screenshot with playhead
    await expect(page).toHaveScreenshot('playhead-position.png', {
      maxDiffPixels: 150, // Allow slightly more for moving playhead
      threshold: 0.015,
    })
  })

  test('should render loop region visualization', async ({ page }) => {
    // Load audio
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)

    // Set loop points
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })

    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()

    // Enable loop
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    await loopButton.click()

    // Wait for visual update
    await page.waitForTimeout(500)

    // Screenshot with loop region
    await expect(page).toHaveScreenshot('loop-region.png', {
      maxDiffPixels: 100,
      threshold: 0.01,
    })
  })

  test('should render active state for play button', async ({ page }) => {
    // Load audio
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)

    // Start playback
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()

    // Wait for state update
    await page.waitForTimeout(200)

    // Screenshot of active play button
    await expect(playButton).toHaveScreenshot('play-button-active.png', {
      maxDiffPixels: 50,
      threshold: 0.01,
    })
  })

  test('should render muted state correctly', async ({ page }) => {
    // Load audio
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)

    // Mute
    const muteButton = page.getByRole('button', { name: /mute/i })
    await muteButton.click()

    // Wait for visual update
    await page.waitForTimeout(200)

    // Screenshot of muted state
    await expect(page).toHaveScreenshot('volume-muted.png', {
      maxDiffPixels: 50,
      threshold: 0.01,
    })
  })

  test('should render control panel layout correctly', async ({ page }) => {
    // Load audio
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)

    // Screenshot of entire control panel
    const controlPanel = page.locator('.bg-\\[\\#2a2a2a\\]').first()
    await expect(controlPanel).toBeVisible()

    await expect(controlPanel).toHaveScreenshot('control-panel-layout.png', {
      maxDiffPixels: 100,
      threshold: 0.01,
    })
  })

  test('should render time display correctly', async ({ page }) => {
    // Load audio
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(2000)

    // Screenshot of time display
    const timeDisplay = page.getByTestId('time-display')
    await expect(timeDisplay).toBeVisible()

    await expect(timeDisplay).toHaveScreenshot('time-display.png', {
      maxDiffPixels: 30,
      threshold: 0.01,
    })
  })

  test('should render disabled state for controls without audio', async ({ page }) => {
    // Don't load audio - controls should be disabled
    await page.waitForLoadState('networkidle')

    // Screenshot of disabled controls
    const playButton = page.getByRole('button', { name: /play/i })
    const stopButton = page.getByRole('button', { name: /stop/i })

    await expect(playButton).toBeDisabled()
    await expect(stopButton).toBeDisabled()

    // Full page screenshot of initial state
    await expect(page).toHaveScreenshot('initial-disabled-state.png', {
      maxDiffPixels: 100,
      threshold: 0.01,
    })
  })

  test('should render waveform with loading state', async ({ page }) => {
    // Load audio and capture during loading
    const fileInput = page.locator('input[type="file"]')

    // Start loading and immediately capture
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')

    // Quick screenshot might catch loading state
    await page.waitForTimeout(500)

    await expect(page).toHaveScreenshot('waveform-loading.png', {
      maxDiffPixels: 150, // Allow more for transient loading state
      threshold: 0.02,
    })
  })
})

test.describe('Visual Component Isolation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Load audio
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)
  })

  test('should isolate play button visual changes', async ({ page }) => {
    const playButton = page.getByRole('button', { name: /play/i })

    // Before playing
    await expect(playButton).toHaveScreenshot('play-button-before.png')

    // After playing
    await playButton.click()
    await page.waitForTimeout(200)

    await expect(playButton).toHaveScreenshot('play-button-after.png')
  })

  test('should isolate loop button visual changes', async ({ page }) => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })

    // Before enabling
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()

    await expect(loopButton).toHaveScreenshot('loop-button-before.png')

    // After enabling
    await loopButton.click()
    await page.waitForTimeout(200)

    await expect(loopButton).toHaveScreenshot('loop-button-after.png')
  })

  test('should isolate volume slider visual changes', async ({ page }) => {
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // At 100%
    await expect(volumeSlider).toHaveScreenshot('volume-100.png')

    // At 50%
    await volumeSlider.fill('50')
    await page.waitForTimeout(200)

    await expect(volumeSlider).toHaveScreenshot('volume-50.png')

    // At 0%
    await volumeSlider.fill('0')
    await page.waitForTimeout(200)

    await expect(volumeSlider).toHaveScreenshot('volume-0.png')
  })
})
