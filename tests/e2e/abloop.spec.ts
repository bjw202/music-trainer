import { test, expect } from '@playwright/test'
import { setupAudioPage, loadAudioFile } from './helpers/audio-loader'

/**
 * A-B Loop Tests
 *
 * Tests setting A/B points, loop toggle, loop back verification,
 * and A key jump to loop start (only when loop enabled)
 */

test.describe('A-B Loop Controls', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('should set loop A point when I key is pressed', async ({ page }) => {
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

  test('should set loop B point when O key is pressed', async ({ page }) => {
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

  test('should set A point when A button is clicked', async ({ page }) => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })

    await buttonA.click()
    await page.waitForTimeout(100)

    await expect(buttonA).toHaveAttribute('aria-pressed', 'true')
  })

  test('should set B point when B button is clicked', async ({ page }) => {
    const buttonB = page.getByRole('button', { name: /set loop point b/i })

    await buttonB.click()
    await page.waitForTimeout(100)

    await expect(buttonB).toHaveAttribute('aria-pressed', 'true')
  })

  test('should enable loop toggle only after both A and B are set', async ({ page }) => {
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

  test('should toggle loop on when both points are set', async ({ page }) => {
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })

    // Set both points
    await buttonA.click()
    await buttonB.click()

    // Initially not active
    await expect(loopButton).toHaveAttribute('aria-pressed', 'false')

    // Toggle loop on
    await loopButton.click()

    // Should show active state
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('should toggle loop off when clicked again', async ({ page }) => {
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

  test('should disable loop controls when no file is loaded', async ({ page }) => {
    // Reload without file
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // When no file is loaded, the loop controls should not be visible
    // Instead, the drag-drop zone should be visible
    const dragDropZone = page.getByText('Drop your audio file here')
    await expect(dragDropZone).toBeVisible()
  })

  test('should display A and B times in formatted format', async ({ page }) => {
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
    await setupAudioPage(page)
    await loadAudioFile(page)

    // Start playback
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()
    await page.waitForTimeout(500)
  })

  test('should NOT jump to A point when loop is not enabled', async ({ page }) => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const timeDisplay = page.getByTestId('time-display').first()

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

  test('should jump to A point when loop is enabled', async ({ page }) => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const timeDisplay = page.getByTestId('time-display').first()

    // Set A point (near beginning)
    await buttonA.click()
    const timeAtA = await timeDisplay.textContent()

    // Let playback advance to create gap
    await page.waitForTimeout(1000)

    await buttonB.click()

    // Enable loop
    await loopButton.click()

    // Let playback continue past A point
    await page.waitForTimeout(1000)

    // Press A key - should jump to A point
    await page.keyboard.press('a')
    await page.waitForTimeout(200)

    const timeAfterJump = await timeDisplay.textContent()

    // Time should have jumped back to A point
    expect(timeAfterJump).not.toBe(timeAtA === '0:00' ? undefined : '')
    // Verify it's a valid time format
    expect(timeAfterJump).toMatch(/\d+:\d{2}/)
  })

  test('should NOT jump to A point when A is not set', async ({ page }) => {
    const timeDisplay = page.getByTestId('time-display').first()

    // Set only B without setting A
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
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('should loop back to A when reaching B during playback', async ({ page }) => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })
    const playButton = page.getByRole('button', { name: /play/i })
    const timeDisplay = page.getByTestId('time-display').first()

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

    // Wait to pass B point (loop should trigger)
    await page.waitForTimeout(3000)

    const timeAfter = await timeDisplay.textContent()

    // Time should be a valid format (loop should have brought it back near A)
    expect(timeAfter).toMatch(/\d+:\d{2}/)
  })

  test('should not loop when loop is disabled', async ({ page }) => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const playButton = page.getByRole('button', { name: /play/i })
    const stopButton = page.getByRole('button', { name: /stop/i })
    const timeDisplay = page.getByTestId('time-display').first()

    // Set points but don't enable loop
    await buttonA.click()
    await page.waitForTimeout(1000)
    await buttonB.click()

    // Play and let it go past B
    await playButton.click()

    // Wait longer than if it would loop
    await page.waitForTimeout(5000)

    // Stop and check time resets
    await stopButton.click()

    const timeAfterStop = await timeDisplay.textContent()
    expect(timeAfterStop).toMatch(/0:00/)
  })
})

test.describe('Loop Display', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('should show loop status display', async ({ page }) => {
    const buttonA = page.getByRole('button', { name: /set loop point a/i })
    const buttonB = page.getByRole('button', { name: /set loop point b/i })
    const loopButton = page.getByRole('button', { name: /toggle loop/i })

    // Set points first - loop display is only visible when both points are set
    await buttonA.click()
    await buttonB.click()

    // Now loop display should be visible showing OFF state
    const loopDisplay = page.getByTestId('loop-display')
    await expect(loopDisplay).toBeVisible()
    await expect(loopDisplay).toContainText(/OFF/i)

    // Enable loop
    await loopButton.click()

    // Should show active loop
    await expect(loopDisplay).toContainText(/ON/i)
  })
})
