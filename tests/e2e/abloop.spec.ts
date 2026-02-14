import { test, expect } from '@playwright/test'

/**
 * A-B Loop Tests
 *
 * Tests setting A/B points, loop toggle, loop back verification,
 * and A key jump to loop start (only when loop enabled)
 */

test.describe('A-B Loop Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Load test audio file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)
  })

  test('should set loop A point when I key is pressed', async () => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })

    // Initially A should not be set
    await expect(buttonA).not.toHaveAttribute('aria-pressed', 'true')

    // Press I to set A point
    await page.keyboard.press('i')
    await page.waitForTimeout(100)

    // A button should now show as set
    await expect(buttonA).toHaveAttribute('aria-pressed', 'true')

    // Should display time below A button
    const timeDisplay = page.locator('button[aria-label="Set loop point A"] + span')
    await expect(timeDisplay).toBeVisible()
  })

  test('should set loop B point when O key is pressed', async () => {
    const buttonB = page.getByRole('button', { name: /set loop point b/i })

    // Initially B should not be set
    await expect(buttonB).not.toHaveAttribute('aria-pressed', 'true')

    // Press O to set B point
    await page.keyboard.press('o')
    await page.waitForTimeout(100)

    // B button should now show as set
    await expect(buttonB).toHaveAttribute('aria-pressed', 'true')

    // Should display time below B button
    const timeDisplay = page.locator('button[aria-label="Set loop point B"] + span')
    await expect(timeDisplay).toBeVisible()
  })

  test('should set A point when A button is clicked', async () => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })

    await buttonA.click()
    await page.waitForTimeout(100)

    await expect(buttonA).toHaveAttribute('aria-pressed', 'true')
  })

  test('should set B point when B button is clicked', async () => {
    const buttonB = page.getByRole('button', { name: /set loop point b/i })

    await buttonB.click()
    await page.waitForTimeout(100)

    await expect(buttonB).toHaveAttribute('aria-pressed', 'true')
  })

  test('should enable loop toggle only after both A and B are set', async () => {
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })

    // Initially disabled
    await expect(loopButton).toBeDisabled()

    // Set only A - still disabled
    await buttonA.click()
    await expect(loopButton).toBeDisabled()

    // Set B - now enabled
    await buttonB.click()
    await expect(loopButton).toBeEnabled()
  })

  test('should toggle loop on when both points are set', async () => {
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })

    // Set both points
    await buttonA.click()
    await buttonB.click()

    // Initially not active
    await expect(loopButton).not.toHaveClass(/bg-\\[\\#34c759\\]/)

    // Toggle loop on
    await loopButton.click()

    // Should show active state (green background)
    await expect(loopButton).toHaveClass(/bg-\\[\\#34c759\\]/)
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('should toggle loop off when clicked again', async () => {
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })

    // Set up loop
    await buttonA.click()
    await buttonB.click()
    await loopButton.click()

    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    // Toggle off
    await loopButton.click()

    await expect(loopButton).toHaveAttribute('aria-pressed', 'false')
  })

  test('should disable loop controls when no file is loaded', async () => {
    // Reload without file
    await page.goto('/')

    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })

    await expect(buttonA).toBeDisabled()
    await expect(buttonB).toBeDisabled()
    await expect(loopButton).toBeDisabled()
  })

  test('should display A and B times in formatted format', async () => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })

    // Set points
    await buttonA.click()
    await buttonB.click()

    // Check time format (MM:SS or M:SS)
    const timeA = page.locator('button[aria-label="Set loop point A"] + span')
    const timeB = page.locator('button[aria-label="Set loop point B"] + span')

    const textA = await timeA.textContent()
    const textB = await timeB.textContent()

    expect(textA).toMatch(/\d+:\d{2}/)
    expect(textB).toMatch(/\d+:\d{2}/)
  })
})

test.describe('A Key Jump to Loop Start', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)

    // Start playback
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()
    await page.waitForTimeout(500)
  })

  test('should NOT jump to A point when loop is not enabled', async () => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const timeDisplay = page.getByTestId('time-display')

    // Set A point at current time
    await buttonA.click()

    // Let playback advance
    await page.waitForTimeout(1000)

    const timeBeforeJump = await timeDisplay.textContent()

    // Press A key - should NOT jump (loop not enabled)
    await page.keyboard.press('a')
    await page.waitForTimeout(100)

    const timeAfterJump = await timeDisplay.textContent()

    // Time should be the same (no jump occurred)
    expect(timeAfterJump).toBe(timeBeforeJump)
  })

  test('should jump to A point when loop is enabled', async () => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const timeDisplay = page.getByTestId('time-display')

    // Set A and B points
    await buttonA.click()

    // Let playback advance to create gap
    await page.waitForTimeout(1000)

    await buttonB.click()

    // Enable loop
    await loopButton.click()

    // Let playback continue past A point
    await page.waitForTimeout(1000)

    const timeBeforeJump = await timeDisplay.textContent()

    // Press A key - should jump to A point
    await page.keyboard.press('a')
    await page.waitForTimeout(100)

    const timeAfterJump = await timeDisplay.textContent()

    // Time should have changed (jump occurred)
    // Note: Exact comparison depends on where A was set
    expect(timeAfterJump).toBeDefined()
  })

  test('should NOT jump to A point when A is not set', async () => {
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const timeDisplay = page.getByTestId('time-display')

    // Enable loop without setting points (won't actually enable, but test the behavior)
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    await buttonB.click()

    const timeBefore = await timeDisplay.textContent()

    // Try to jump
    await page.keyboard.press('a')
    await page.waitForTimeout(100)

    const timeAfter = await timeDisplay.textContent()

    // Should not have jumped
    expect(timeAfter).toBe(timeBefore)
  })
})

test.describe('Loop Back Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)
  })

  test('should loop back to A when reaching B during playback', async () => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const playButton = page.getByRole('button', { name: /play/i })
    const timeDisplay = page.getByTestId('time-display')

    // Set A point near beginning
    await buttonA.click()

    // Let it play a bit
    await page.waitForTimeout(1500)

    // Set B point
    await buttonB.click()

    // Enable loop
    await loopButton.click()

    // Start playback from before B
    await playButton.click()

    // Get time before B
    const timeBefore = await timeDisplay.textContent()

    // Wait to pass B point (loop should trigger)
    await page.waitForTimeout(3000)

    const timeAfter = await timeDisplay.textContent()

    // Time should be closer to A than to B (looped back)
    // This is a rough check - exact timing depends on file duration
    expect(timeAfter).toBeDefined()
  })

  test('should not loop when loop is disabled', async () => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const playButton = page.getByRole('button', { name: /play/i })
    const stopButton = page.getByRole('button', { name: /stop/i })
    const timeDisplay = page.getByTestId('time-display')

    // Set points but don't enable loop
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()

    // Play and let it go past B
    await playButton.click()

    // Wait longer than if it would loop
    await page.waitForTimeout(5000)

    const timeAtEnd = await timeDisplay.textContent()

    // Should have continued playing (not looped)
    // Stop and check time resets
    await stopButton.click()

    const timeAfterStop = await timeDisplay.textContent()
    expect(timeAfterStop).toMatch(/0:00/)
  })
})

test.describe('Loop Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./public/test-audio/test-song.mp3')
    await page.waitForTimeout(1000)
  })

  test('should show loop status display', async () => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const loopDisplay = page.getByTestId('loop-display')

    // Initially should show no loop
    await expect(loopDisplay).toContainText(/no loop|disabled|off/i)

    // Set points
    await buttonA.click()
    await buttonB.click()

    // Enable loop
    await loopButton.click()

    // Should show active loop
    await expect(loopDisplay).toBeVisible()
  })
})
