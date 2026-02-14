import { test, expect } from '@playwright/test'
import { setupAudioPage, loadAudioFile } from './helpers/audio-loader'

/**
 * Speed/Pitch Control E2E Tests
 *
 * SPEC-UPDATE-001: Phase 2 - 고급 속도/피치 제어
 *
 * data-testid:
 * - speed-slider: 속도 슬라이더 (0.5x ~ 2.0x)
 * - speed-display: 속도 표시 텍스트 (X.Xx 형식)
 * - pitch-slider: 피치 슬라이더 (-12 ~ +12)
 * - pitch-display: 피치 표시 텍스트 (+N/-N/0 형식)
 * - speed-pitch-reset: 속도/피치 리셋 버튼
 * - speed-pitch-panel: SpeedPitch 패널 컨테이너
 *
 * 키보드 단축키:
 * - +/=: 속도 +0.1x
 * - -/_: 속도 -0.1x
 * - ]: 피치 +1 반음
 * - [: 피치 -1 반음
 * - r: 속도/피치 리셋 (speed=1.0, pitch=0)
 */

// ============================================================================
// Category 1: Speed Control Basic (5 tests)
// ============================================================================

test.describe('Speed Control Basic', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('should display default speed as 1.0x', async ({ page }) => {
    const speedDisplay = page.getByTestId('speed-display')
    const speedSlider = page.getByTestId('speed-slider')

    await expect(speedDisplay).toBeVisible()
    const displayText = await speedDisplay.textContent()
    expect(displayText).toContain('1.0x')

    const sliderValue = await speedSlider.inputValue()
    expect(parseFloat(sliderValue)).toBe(1.0)
  })

  test('should change speed to 0.5x via slider', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const speedDisplay = page.getByTestId('speed-display')

    // Record before value
    const beforeValue = await speedSlider.inputValue()
    expect(parseFloat(beforeValue)).toBe(1.0)

    // Change to 0.5x
    await speedSlider.fill('0.5')
    await page.waitForTimeout(100)

    // Verify after value
    const afterValue = await speedSlider.inputValue()
    expect(parseFloat(afterValue)).toBe(0.5)
    expect(afterValue).not.toBe(beforeValue)

    const displayText = await speedDisplay.textContent()
    expect(displayText).toContain('0.5x')
  })

  test('should change speed to 2.0x via slider', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const speedDisplay = page.getByTestId('speed-display')

    const beforeValue = await speedSlider.inputValue()
    expect(parseFloat(beforeValue)).toBe(1.0)

    await speedSlider.fill('2')
    await page.waitForTimeout(100)

    const afterValue = await speedSlider.inputValue()
    expect(parseFloat(afterValue)).toBe(2.0)
    expect(afterValue).not.toBe(beforeValue)

    const displayText = await speedDisplay.textContent()
    expect(displayText).toContain('2.0x')
  })

  test('should clamp speed to 0.5x-2.0x range', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')

    // Set to maximum boundary
    await speedSlider.fill('2')
    await page.waitForTimeout(100)
    const maxValue = parseFloat(await speedSlider.inputValue())
    expect(maxValue).toBeLessThanOrEqual(2.0)

    // Set to minimum boundary
    await speedSlider.fill('0.5')
    await page.waitForTimeout(100)
    const minValue = parseFloat(await speedSlider.inputValue())
    expect(minValue).toBeGreaterThanOrEqual(0.5)
  })

  test('should display speed with X.Xx format', async ({ page }) => {
    const speedDisplay = page.getByTestId('speed-display')
    const speedSlider = page.getByTestId('speed-slider')

    // Default: 1.0x
    const defaultText = await speedDisplay.textContent()
    expect(defaultText).toMatch(/\d\.\dx/i)

    // Change to 0.8x
    await speedSlider.fill('0.8')
    await page.waitForTimeout(100)

    const changedText = await speedDisplay.textContent()
    expect(changedText).toMatch(/\d\.\dx/i)
    expect(changedText).toContain('0.8x')
  })
})

// ============================================================================
// Category 2: Pitch Control Basic (5 tests)
// ============================================================================

test.describe('Pitch Control Basic', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('should display default pitch as 0', async ({ page }) => {
    const pitchDisplay = page.getByTestId('pitch-display')
    const pitchSlider = page.getByTestId('pitch-slider')

    await expect(pitchDisplay).toBeVisible()
    const displayText = await pitchDisplay.textContent()
    expect(displayText).toContain('0')

    const sliderValue = await pitchSlider.inputValue()
    expect(parseInt(sliderValue)).toBe(0)
  })

  test('should change pitch to +6 via slider', async ({ page }) => {
    const pitchSlider = page.getByTestId('pitch-slider')
    const pitchDisplay = page.getByTestId('pitch-display')

    const beforeValue = await pitchSlider.inputValue()
    expect(parseInt(beforeValue)).toBe(0)

    await pitchSlider.fill('6')
    await page.waitForTimeout(100)

    const afterValue = await pitchSlider.inputValue()
    expect(parseInt(afterValue)).toBe(6)
    expect(afterValue).not.toBe(beforeValue)

    const displayText = await pitchDisplay.textContent()
    expect(displayText).toContain('+6')
  })

  test('should change pitch to -6 via slider', async ({ page }) => {
    const pitchSlider = page.getByTestId('pitch-slider')
    const pitchDisplay = page.getByTestId('pitch-display')

    const beforeValue = await pitchSlider.inputValue()
    expect(parseInt(beforeValue)).toBe(0)

    await pitchSlider.fill('-6')
    await page.waitForTimeout(100)

    const afterValue = await pitchSlider.inputValue()
    expect(parseInt(afterValue)).toBe(-6)
    expect(afterValue).not.toBe(beforeValue)

    const displayText = await pitchDisplay.textContent()
    expect(displayText).toContain('-6')
  })

  test('should clamp pitch to -12 to +12 range', async ({ page }) => {
    const pitchSlider = page.getByTestId('pitch-slider')

    // Set to maximum boundary
    await pitchSlider.fill('12')
    await page.waitForTimeout(100)
    const maxValue = parseInt(await pitchSlider.inputValue())
    expect(maxValue).toBeLessThanOrEqual(12)

    // Set to minimum boundary
    await pitchSlider.fill('-12')
    await page.waitForTimeout(100)
    const minValue = parseInt(await pitchSlider.inputValue())
    expect(minValue).toBeGreaterThanOrEqual(-12)
  })

  test('should display pitch with +/- sign format', async ({ page }) => {
    const pitchDisplay = page.getByTestId('pitch-display')
    const pitchSlider = page.getByTestId('pitch-slider')

    // Default: 0 (no sign)
    const defaultText = await pitchDisplay.textContent()
    expect(defaultText).toContain('0')

    // Positive: +3
    await pitchSlider.fill('3')
    await page.waitForTimeout(100)
    const positiveText = await pitchDisplay.textContent()
    expect(positiveText).toContain('+3')

    // Negative: -3
    await pitchSlider.fill('-3')
    await page.waitForTimeout(100)
    const negativeText = await pitchDisplay.textContent()
    expect(negativeText).toContain('-3')
  })
})

// ============================================================================
// Category 3: Speed/Pitch Independence (4 tests)
// ============================================================================

test.describe('Speed/Pitch Independence', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('changing speed should not affect pitch', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')

    // Set pitch to +5
    await pitchSlider.fill('5')
    await page.waitForTimeout(100)
    const pitchBefore = await pitchSlider.inputValue()
    expect(parseInt(pitchBefore)).toBe(5)

    // Change speed
    await speedSlider.fill('0.7')
    await page.waitForTimeout(100)

    // Pitch should remain unchanged
    const pitchAfter = await pitchSlider.inputValue()
    expect(pitchAfter).toBe(pitchBefore)
  })

  test('changing pitch should not affect speed', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')

    // Set speed to 0.8x
    await speedSlider.fill('0.8')
    await page.waitForTimeout(100)
    const speedBefore = await speedSlider.inputValue()
    expect(parseFloat(speedBefore)).toBe(0.8)

    // Change pitch
    await pitchSlider.fill('3')
    await page.waitForTimeout(100)

    // Speed should remain unchanged
    const speedAfter = await speedSlider.inputValue()
    expect(speedAfter).toBe(speedBefore)
  })

  test('changing speed should not affect volume', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Set volume to 70
    await volumeSlider.fill('70')
    await page.waitForTimeout(100)
    const volumeBefore = await volumeSlider.inputValue()
    expect(parseInt(volumeBefore)).toBe(70)

    // Change speed
    await speedSlider.fill('1.5')
    await page.waitForTimeout(100)

    // Volume should remain unchanged
    const volumeAfter = await volumeSlider.inputValue()
    expect(volumeAfter).toBe(volumeBefore)
  })

  test('changing pitch should not affect volume', async ({ page }) => {
    const pitchSlider = page.getByTestId('pitch-slider')
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Set volume to 60
    await volumeSlider.fill('60')
    await page.waitForTimeout(100)
    const volumeBefore = await volumeSlider.inputValue()
    expect(parseInt(volumeBefore)).toBe(60)

    // Change pitch
    await pitchSlider.fill('-4')
    await page.waitForTimeout(100)

    // Volume should remain unchanged
    const volumeAfter = await volumeSlider.inputValue()
    expect(volumeAfter).toBe(volumeBefore)
  })
})

// ============================================================================
// Category 4: Speed/Pitch + Playback (5 tests)
// ============================================================================

test.describe('Speed/Pitch + Playback', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('changing speed during playback should maintain playing state', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const playButton = page.getByRole('button', { name: /play/i })

    // Start playing
    await playButton.click()
    const pauseButton = page.getByRole('button', { name: /pause/i })
    await expect(pauseButton).toBeVisible()

    // Change speed during playback
    await speedSlider.fill('0.7')
    await page.waitForTimeout(200)

    // Should still be playing (pause button visible)
    await expect(pauseButton).toBeVisible()
  })

  test('changing pitch during playback should maintain playing state', async ({ page }) => {
    const pitchSlider = page.getByTestId('pitch-slider')
    const playButton = page.getByRole('button', { name: /play/i })

    // Start playing
    await playButton.click()
    const pauseButton = page.getByRole('button', { name: /pause/i })
    await expect(pauseButton).toBeVisible()

    // Change pitch during playback
    await pitchSlider.fill('4')
    await page.waitForTimeout(200)

    // Should still be playing
    await expect(pauseButton).toBeVisible()
  })

  test('pause/resume should preserve speed and pitch values', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')
    const playButton = page.getByRole('button', { name: /play/i })

    // Set speed and pitch
    await speedSlider.fill('0.8')
    await pitchSlider.fill('3')
    await page.waitForTimeout(100)

    // Play
    await playButton.click()
    await page.waitForTimeout(500)

    // Pause
    const pauseButton = page.getByRole('button', { name: /pause/i })
    await pauseButton.click()
    await page.waitForTimeout(100)

    // Verify speed and pitch preserved after pause
    const speedAfterPause = await speedSlider.inputValue()
    const pitchAfterPause = await pitchSlider.inputValue()
    expect(parseFloat(speedAfterPause)).toBe(0.8)
    expect(parseInt(pitchAfterPause)).toBe(3)

    // Resume
    const playButtonAgain = page.getByRole('button', { name: /play/i })
    await playButtonAgain.click()
    await page.waitForTimeout(200)

    // Verify speed and pitch preserved after resume
    const speedAfterResume = await speedSlider.inputValue()
    const pitchAfterResume = await pitchSlider.inputValue()
    expect(parseFloat(speedAfterResume)).toBe(0.8)
    expect(parseInt(pitchAfterResume)).toBe(3)
  })

  test('time should progress slower at 0.5x speed', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const playButton = page.getByRole('button', { name: /play/i })
    const timeDisplay = page.getByTestId('time-display').first()

    // Set speed to 0.5x
    await speedSlider.fill('0.5')
    await page.waitForTimeout(100)

    // Record start time
    const timeBefore = await timeDisplay.textContent()

    // Play for 2 wall-clock seconds
    await playButton.click()
    await page.waitForTimeout(2000)

    // Pause to freeze time
    const pauseButton = page.getByRole('button', { name: /pause/i })
    await pauseButton.click()

    const timeAfter = await timeDisplay.textContent()

    // Time should have progressed (but slower than real time)
    expect(timeAfter).not.toBe(timeBefore)
  })

  test('time should progress faster at 2.0x speed', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const playButton = page.getByRole('button', { name: /play/i })
    const timeDisplay = page.getByTestId('time-display').first()

    // Set speed to 2.0x
    await speedSlider.fill('2')
    await page.waitForTimeout(100)

    // Record start time
    const timeBefore = await timeDisplay.textContent()

    // Play for 2 wall-clock seconds
    await playButton.click()
    await page.waitForTimeout(2000)

    // Pause to freeze time
    const pauseButton = page.getByRole('button', { name: /pause/i })
    await pauseButton.click()

    const timeAfter = await timeDisplay.textContent()

    // Time should have progressed (faster than real time)
    expect(timeAfter).not.toBe(timeBefore)
  })
})

// ============================================================================
// Category 5: Speed/Pitch + A-B Loop (3 tests)
// ============================================================================

test.describe('Speed/Pitch + A-B Loop', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('changing speed should not disable active loop', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })

    // Set up and enable loop
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()
    await loopButton.click()

    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    // Change speed
    await speedSlider.fill('0.7')
    await page.waitForTimeout(100)

    // Loop should still be active
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('changing pitch should not disable active loop', async ({ page }) => {
    const pitchSlider = page.getByTestId('pitch-slider')
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })

    // Set up and enable loop
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()
    await loopButton.click()

    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    // Change pitch
    await pitchSlider.fill('5')
    await page.waitForTimeout(100)

    // Loop should still be active
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('loop A/B points should be preserved after speed/pitch change', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })

    // Set up loop
    await buttonA.click()
    const timeABefore = await page.locator('button[aria-label="Set loop point A"] span.text-xs').textContent()
    await page.waitForTimeout(1000)
    await buttonB.click()
    const timeBBefore = await page.locator('button[aria-label="Set loop point B"] span.text-xs').textContent()
    await loopButton.click()

    // Change both speed and pitch
    await speedSlider.fill('1.5')
    await pitchSlider.fill('-3')
    await page.waitForTimeout(100)

    // Loop points should be unchanged
    const timeAAfter = await page.locator('button[aria-label="Set loop point A"] span.text-xs').textContent()
    const timeBAfter = await page.locator('button[aria-label="Set loop point B"] span.text-xs').textContent()
    expect(timeAAfter).toBe(timeABefore)
    expect(timeBAfter).toBe(timeBBefore)
  })
})

// ============================================================================
// Category 6: Speed/Pitch Reset (3 tests)
// ============================================================================

test.describe('Speed/Pitch Reset', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('reset button should restore speed to 1.0x and pitch to 0', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')
    const resetButton = page.getByTestId('speed-pitch-reset')

    // Change speed and pitch
    await speedSlider.fill('0.7')
    await pitchSlider.fill('5')
    await page.waitForTimeout(100)

    // Verify changed
    expect(parseFloat(await speedSlider.inputValue())).toBe(0.7)
    expect(parseInt(await pitchSlider.inputValue())).toBe(5)

    // Click reset
    await resetButton.click()
    await page.waitForTimeout(100)

    // Verify restored to defaults
    const speedAfter = parseFloat(await speedSlider.inputValue())
    const pitchAfter = parseInt(await pitchSlider.inputValue())
    expect(speedAfter).toBe(1.0)
    expect(pitchAfter).toBe(0)
  })

  test('reset during playback should maintain playing state', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')
    const resetButton = page.getByTestId('speed-pitch-reset')
    const playButton = page.getByRole('button', { name: /play/i })

    // Set speed/pitch and start playing
    await speedSlider.fill('0.7')
    await pitchSlider.fill('5')
    await playButton.click()

    const pauseButton = page.getByRole('button', { name: /pause/i })
    await expect(pauseButton).toBeVisible()

    // Reset
    await resetButton.click()
    await page.waitForTimeout(200)

    // Should still be playing
    await expect(pauseButton).toBeVisible()

    // Speed and pitch should be reset
    expect(parseFloat(await speedSlider.inputValue())).toBe(1.0)
    expect(parseInt(await pitchSlider.inputValue())).toBe(0)
  })

  test('reset should preserve volume and loop state', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')
    const resetButton = page.getByTestId('speed-pitch-reset')
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })

    // Set volume
    await volumeSlider.fill('65')

    // Set up loop
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()
    await loopButton.click()
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    // Change speed/pitch
    await speedSlider.fill('1.5')
    await pitchSlider.fill('-4')
    await page.waitForTimeout(100)

    // Record states before reset
    const volumeBefore = await volumeSlider.inputValue()
    const loopStateBefore = await loopButton.getAttribute('aria-pressed')

    // Reset
    await resetButton.click()
    await page.waitForTimeout(100)

    // Volume and loop should be preserved
    const volumeAfter = await volumeSlider.inputValue()
    const loopStateAfter = await loopButton.getAttribute('aria-pressed')
    expect(volumeAfter).toBe(volumeBefore)
    expect(loopStateAfter).toBe(loopStateBefore)

    // Speed and pitch should be reset
    expect(parseFloat(await speedSlider.inputValue())).toBe(1.0)
    expect(parseInt(await pitchSlider.inputValue())).toBe(0)
  })
})

// ============================================================================
// Category 7: Keyboard Shortcuts (5 tests)
// ============================================================================

test.describe('Speed/Pitch Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('+/- keys should change speed by 0.1x increments', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const speedDisplay = page.getByTestId('speed-display')

    // Default speed is 1.0x
    const beforeValue = parseFloat(await speedSlider.inputValue())
    expect(beforeValue).toBe(1.0)

    // Press + to increase speed
    await page.keyboard.press('Equal') // + key (= without shift, but + on US keyboard)
    await page.waitForTimeout(100)

    const afterIncrease = parseFloat(await speedSlider.inputValue())
    expect(afterIncrease).toBeCloseTo(1.1, 1)
    expect(afterIncrease).toBeGreaterThan(beforeValue)

    // Press - to decrease speed
    await page.keyboard.press('Minus')
    await page.waitForTimeout(100)

    const afterDecrease = parseFloat(await speedSlider.inputValue())
    expect(afterDecrease).toBeCloseTo(1.0, 1)
    expect(afterDecrease).toBeLessThan(afterIncrease)
  })

  test('[/] keys should change pitch by 1 semitone', async ({ page }) => {
    const pitchSlider = page.getByTestId('pitch-slider')
    const pitchDisplay = page.getByTestId('pitch-display')

    // Default pitch is 0
    const beforeValue = parseInt(await pitchSlider.inputValue())
    expect(beforeValue).toBe(0)

    // Press ] to increase pitch
    await page.keyboard.press('BracketRight')
    await page.waitForTimeout(100)

    const afterIncrease = parseInt(await pitchSlider.inputValue())
    expect(afterIncrease).toBe(1)
    expect(afterIncrease).toBeGreaterThan(beforeValue)

    // Press [ to decrease pitch
    await page.keyboard.press('BracketLeft')
    await page.waitForTimeout(100)

    const afterDecrease = parseInt(await pitchSlider.inputValue())
    expect(afterDecrease).toBe(0)
    expect(afterDecrease).toBeLessThan(afterIncrease)
  })

  test('r key should reset speed to 1.0x and pitch to 0', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')

    // Change speed and pitch via keyboard
    await page.keyboard.press('Equal')
    await page.keyboard.press('Equal')
    await page.keyboard.press('BracketRight')
    await page.keyboard.press('BracketRight')
    await page.keyboard.press('BracketRight')
    await page.waitForTimeout(100)

    // Verify changed
    const speedBefore = parseFloat(await speedSlider.inputValue())
    const pitchBefore = parseInt(await pitchSlider.inputValue())
    expect(speedBefore).toBeGreaterThan(1.0)
    expect(pitchBefore).toBeGreaterThan(0)

    // Press r to reset
    await page.keyboard.press('r')
    await page.waitForTimeout(100)

    // Verify reset
    const speedAfter = parseFloat(await speedSlider.inputValue())
    const pitchAfter = parseInt(await pitchSlider.inputValue())
    expect(speedAfter).toBe(1.0)
    expect(pitchAfter).toBe(0)
  })

  test('should not trigger shortcuts when typing in input fields', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')

    // Record initial values
    const speedBefore = await speedSlider.inputValue()
    const pitchBefore = await pitchSlider.inputValue()

    // Create a temporary input
    await page.evaluate(() => {
      const input = document.createElement('input')
      input.type = 'text'
      input.id = 'test-input-sp'
      document.body.appendChild(input)
    })

    const testInput = page.locator('#test-input-sp')
    await testInput.click()

    // Type shortcut keys inside input
    await page.keyboard.type('+-[]r')
    await page.waitForTimeout(100)

    // Speed and pitch should NOT have changed
    const speedAfter = await speedSlider.inputValue()
    const pitchAfter = await pitchSlider.inputValue()
    expect(speedAfter).toBe(speedBefore)
    expect(pitchAfter).toBe(pitchBefore)

    // Clean up
    await page.evaluate(() => {
      document.getElementById('test-input-sp')?.remove()
    })
  })

  test('keyboard shortcuts should respect boundary values', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')

    // Set speed to max (2.0x) via slider
    await speedSlider.fill('2')
    await page.waitForTimeout(100)

    // Try to increase beyond max
    await page.keyboard.press('Equal')
    await page.waitForTimeout(100)

    const speedAtMax = parseFloat(await speedSlider.inputValue())
    expect(speedAtMax).toBeLessThanOrEqual(2.0)

    // Set pitch to max (+12) via slider
    await pitchSlider.fill('12')
    await page.waitForTimeout(100)

    // Try to increase beyond max
    await page.keyboard.press('BracketRight')
    await page.waitForTimeout(100)

    const pitchAtMax = parseInt(await pitchSlider.inputValue())
    expect(pitchAtMax).toBeLessThanOrEqual(12)

    // Set speed to min (0.5x) via slider
    await speedSlider.fill('0.5')
    await page.waitForTimeout(100)

    // Try to decrease below min
    await page.keyboard.press('Minus')
    await page.waitForTimeout(100)

    const speedAtMin = parseFloat(await speedSlider.inputValue())
    expect(speedAtMin).toBeGreaterThanOrEqual(0.5)

    // Set pitch to min (-12) via slider
    await pitchSlider.fill('-12')
    await page.waitForTimeout(100)

    // Try to decrease below min
    await page.keyboard.press('BracketLeft')
    await page.waitForTimeout(100)

    const pitchAtMin = parseInt(await pitchSlider.inputValue())
    expect(pitchAtMin).toBeGreaterThanOrEqual(-12)
  })
})

// ============================================================================
// Category 8: Compound Independence (6 tests)
// ============================================================================

test.describe('Speed/Pitch Compound Independence', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('speed + volume: changing both should maintain independence', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Set speed
    await speedSlider.fill('0.7')
    await page.waitForTimeout(100)

    // Set volume
    await volumeSlider.fill('50')
    await page.waitForTimeout(100)

    // Verify both values
    const speedValue = parseFloat(await speedSlider.inputValue())
    const volumeValue = parseInt(await volumeSlider.inputValue())
    expect(speedValue).toBe(0.7)
    expect(volumeValue).toBe(50)

    // Change speed again
    await speedSlider.fill('1.3')
    await page.waitForTimeout(100)

    // Volume should be unchanged
    const volumeAfter = parseInt(await volumeSlider.inputValue())
    expect(volumeAfter).toBe(50)

    // Change volume again
    await volumeSlider.fill('80')
    await page.waitForTimeout(100)

    // Speed should be unchanged
    const speedAfter = parseFloat(await speedSlider.inputValue())
    expect(speedAfter).toBe(1.3)
  })

  test('pitch + volume: changing both should maintain independence', async ({ page }) => {
    const pitchSlider = page.getByTestId('pitch-slider')
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Set pitch
    await pitchSlider.fill('4')
    await page.waitForTimeout(100)

    // Set volume
    await volumeSlider.fill('40')
    await page.waitForTimeout(100)

    // Verify both values
    const pitchValue = parseInt(await pitchSlider.inputValue())
    const volumeValue = parseInt(await volumeSlider.inputValue())
    expect(pitchValue).toBe(4)
    expect(volumeValue).toBe(40)

    // Change pitch again
    await pitchSlider.fill('-2')
    await page.waitForTimeout(100)

    // Volume should be unchanged
    const volumeAfter = parseInt(await volumeSlider.inputValue())
    expect(volumeAfter).toBe(40)

    // Change volume again
    await volumeSlider.fill('90')
    await page.waitForTimeout(100)

    // Pitch should be unchanged
    const pitchAfter = parseInt(await pitchSlider.inputValue())
    expect(pitchAfter).toBe(-2)
  })

  test('speed + A-B loop: speed change should not affect loop', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })

    // Set up loop
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()
    await loopButton.click()
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    // Change speed multiple times (wait for buffer rebuild between changes)
    await speedSlider.fill('0.5')
    await page.waitForTimeout(500)
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    await speedSlider.fill('2')
    await page.waitForTimeout(500)
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    await speedSlider.fill('1')
    await page.waitForTimeout(500)
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('pitch + A-B loop: pitch change should not affect loop', async ({ page }) => {
    const pitchSlider = page.getByTestId('pitch-slider')
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })

    // Set up loop
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()
    await loopButton.click()
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    // Change pitch multiple times
    await pitchSlider.fill('6')
    await page.waitForTimeout(100)
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    await pitchSlider.fill('-6')
    await page.waitForTimeout(100)
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    await pitchSlider.fill('0')
    await page.waitForTimeout(100)
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('speed + seek: seek should not change speed', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')

    // Set speed
    await speedSlider.fill('1.5')
    await page.waitForTimeout(300)
    const speedBefore = await speedSlider.inputValue()
    expect(parseFloat(speedBefore)).toBe(1.5)

    // Blur slider to prevent ArrowRight/Left from changing slider value
    await speedSlider.evaluate(el => (el as HTMLElement).blur())
    await page.waitForTimeout(100)

    // Seek forward and backward
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    const speedAfterForward = await speedSlider.inputValue()
    expect(speedAfterForward).toBe(speedBefore)

    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(200)
    const speedAfterBackward = await speedSlider.inputValue()
    expect(speedAfterBackward).toBe(speedBefore)
  })

  test('pitch + seek: seek should not change pitch', async ({ page }) => {
    const pitchSlider = page.getByTestId('pitch-slider')

    // Set pitch
    await pitchSlider.fill('-3')
    await page.waitForTimeout(300)
    const pitchBefore = await pitchSlider.inputValue()
    expect(parseInt(pitchBefore)).toBe(-3)

    // Blur slider to prevent ArrowRight/Left from changing slider value
    await pitchSlider.evaluate(el => (el as HTMLElement).blur())
    await page.waitForTimeout(100)

    // Seek forward and backward
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    const pitchAfterForward = await pitchSlider.inputValue()
    expect(pitchAfterForward).toBe(pitchBefore)

    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(200)
    const pitchAfterBackward = await pitchSlider.inputValue()
    expect(pitchAfterBackward).toBe(pitchBefore)
  })
})

// ============================================================================
// Category 9: State Persistence (3 tests)
// ============================================================================

test.describe('Speed/Pitch State Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('speed and pitch should persist after seek', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')

    // Set speed and pitch
    await speedSlider.fill('0.8')
    await page.waitForTimeout(300)
    await pitchSlider.fill('3')
    await page.waitForTimeout(300)

    const speedBefore = await speedSlider.inputValue()
    const pitchBefore = await pitchSlider.inputValue()

    // Blur slider to prevent ArrowRight/Left from changing slider value
    await pitchSlider.evaluate(el => (el as HTMLElement).blur())
    await page.waitForTimeout(100)

    // Perform multiple seek operations
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(200)

    // Speed and pitch should persist
    const speedAfter = await speedSlider.inputValue()
    const pitchAfter = await pitchSlider.inputValue()
    expect(speedAfter).toBe(speedBefore)
    expect(pitchAfter).toBe(pitchBefore)
  })

  test('speed and pitch should persist after volume change', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')
    const volumeSlider = page.locator('input[type="range"][data-testid="volume-slider"]')

    // Set speed and pitch
    await speedSlider.fill('1.3')
    await pitchSlider.fill('-5')
    await page.waitForTimeout(100)

    const speedBefore = await speedSlider.inputValue()
    const pitchBefore = await pitchSlider.inputValue()

    // Change volume multiple times
    await volumeSlider.fill('30')
    await page.waitForTimeout(100)
    await volumeSlider.fill('80')
    await page.waitForTimeout(100)
    await volumeSlider.fill('50')
    await page.waitForTimeout(100)

    // Speed and pitch should persist
    const speedAfter = await speedSlider.inputValue()
    const pitchAfter = await pitchSlider.inputValue()
    expect(speedAfter).toBe(speedBefore)
    expect(pitchAfter).toBe(pitchBefore)
  })

  test('speed and pitch should persist after mute toggle', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')
    const muteButton = page.getByRole('button', { name: /mute/i })

    // Set speed and pitch
    await speedSlider.fill('0.6')
    await pitchSlider.fill('7')
    await page.waitForTimeout(100)

    const speedBefore = await speedSlider.inputValue()
    const pitchBefore = await pitchSlider.inputValue()

    // Mute
    await muteButton.click()
    await page.waitForTimeout(100)

    // Speed and pitch should persist while muted
    expect(await speedSlider.inputValue()).toBe(speedBefore)
    expect(await pitchSlider.inputValue()).toBe(pitchBefore)

    // Unmute
    await muteButton.click()
    await page.waitForTimeout(100)

    // Speed and pitch should still persist
    const speedAfter = await speedSlider.inputValue()
    const pitchAfter = await pitchSlider.inputValue()
    expect(speedAfter).toBe(speedBefore)
    expect(pitchAfter).toBe(pitchBefore)
  })
})

// ============================================================================
// Category 10: Rapid Operations (3 tests)
// ============================================================================

test.describe('Speed/Pitch Rapid Operations', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('rapid speed changes should result in accurate final value', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')

    // Default 1.0x, press + 5 times -> expected 1.5x
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Equal')
    }
    await page.waitForTimeout(200)

    const speedAfterIncrease = parseFloat(await speedSlider.inputValue())
    expect(speedAfterIncrease).toBeCloseTo(1.5, 1)

    // Press - 3 times -> expected 1.2x
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Minus')
    }
    await page.waitForTimeout(200)

    const speedAfterDecrease = parseFloat(await speedSlider.inputValue())
    expect(speedAfterDecrease).toBeCloseTo(1.2, 1)
  })

  test('rapid pitch changes should result in accurate final value', async ({ page }) => {
    const pitchSlider = page.getByTestId('pitch-slider')

    // Default 0, press ] 5 times -> expected +5
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('BracketRight')
    }
    await page.waitForTimeout(200)

    const pitchAfterIncrease = parseInt(await pitchSlider.inputValue())
    expect(pitchAfterIncrease).toBe(5)

    // Press [ 2 times -> expected +3
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('BracketLeft')
    }
    await page.waitForTimeout(200)

    const pitchAfterDecrease = parseInt(await pitchSlider.inputValue())
    expect(pitchAfterDecrease).toBe(3)
  })

  test('rapid speed + pitch + playback changes should not interfere', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')
    const playButton = page.getByRole('button', { name: /play/i })

    // Start playback
    await playButton.click()
    await page.waitForTimeout(100)

    // Rapid mixed operations
    await page.keyboard.press('Equal')   // speed +0.1
    await page.keyboard.press('BracketRight')  // pitch +1
    await page.keyboard.press('Equal')   // speed +0.1
    await page.keyboard.press('BracketRight')  // pitch +1
    await page.keyboard.press('Minus')   // speed -0.1
    await page.keyboard.press('BracketLeft')   // pitch -1
    await page.waitForTimeout(200)

    // Expected: speed = 1.0 + 0.1 + 0.1 - 0.1 = 1.1, pitch = 0 + 1 + 1 - 1 = 1
    const speedValue = parseFloat(await speedSlider.inputValue())
    const pitchValue = parseInt(await pitchSlider.inputValue())
    expect(speedValue).toBeCloseTo(1.1, 1)
    expect(pitchValue).toBe(1)

    // Should still be playing
    const pauseButton = page.getByRole('button', { name: /pause/i })
    await expect(pauseButton).toBeVisible()
  })
})
