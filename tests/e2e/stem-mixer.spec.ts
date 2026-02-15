import { test, expect } from '@playwright/test'
import { setupAudioPage, loadAudioFile } from './helpers/audio-loader'

/**
 * E2E Tests for SPEC-STEM-001: AI Stem Separation & Stem Mixer
 *
 * Tests focus on UI behavior:
 * - Separation button visibility and state
 * - Stem mixer panel UI when in stem mode
 * - Volume, mute, solo controls
 * - Mode toggle functionality
 *
 * Note: Full separation flow requires backend API.
 * These tests mock store state directly for UI component testing.
 */

/**
 * Set stem store state directly for UI testing
 * This bypasses the API and sets the store state directly
 */
async function setStemStoreState(
  page: import('@playwright/test').Page,
  state: {
    separationStatus?: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed'
    separationProgress?: number
    isStemMode?: boolean
    stems?: {
      vocals: boolean
      drums: boolean
      bass: boolean
      other: boolean
    }
  }
) {
  await page.evaluate((newState) => {
    const store = (window as unknown as Record<string, unknown>).__STEM_STORE__ as {
      getState: () => {
        setSeparationStatus: (status: string) => void
        setSeparationProgress: (progress: number) => void
        setStemMode: (enabled: boolean) => void
        setStems: (stems: Record<string, unknown>) => void
      }
    } | undefined

    if (store) {
      const actions = store.getState()
      if (newState.separationStatus !== undefined) {
        actions.setSeparationStatus(newState.separationStatus)
      }
      if (newState.separationProgress !== undefined) {
        actions.setSeparationProgress(newState.separationProgress)
      }
      if (newState.isStemMode !== undefined) {
        actions.setStemMode(newState.isStemMode)
      }
      if (newState.stems !== undefined) {
        // Create AudioBuffer-like objects (minimal mock)
        const mockBuffer = {
          duration: 180,
          length: 7938000,
          sampleRate: 44100,
          numberOfChannels: 2,
        } as unknown as AudioBuffer

        actions.setStems({
          vocals: newState.stems.vocals ? mockBuffer : null,
          drums: newState.stems.drums ? mockBuffer : null,
          bass: newState.stems.bass ? mockBuffer : null,
          other: newState.stems.other ? mockBuffer : null,
        })
      }
    }
  }, state)
}

// ============================================================================
// Scenario 1: Stem Separation Button UI Tests
// ============================================================================

test.describe('Scenario 1: Stem Separation Button UI', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('should show separate button after audio load', async ({ page }) => {
    const separateButton = page.getByTestId('separate-button')
    await expect(separateButton).toBeVisible()
    await expect(separateButton).toContainText('Separate')
  })

  test('should have enabled separate button when audio is loaded', async ({ page }) => {
    const separateButton = page.getByTestId('separate-button')
    await expect(separateButton).toBeEnabled()
  })

  test('should show Open Stem Mixer button when separation completed', async ({ page }) => {
    // Set store state to completed
    await setStemStoreState(page, {
      separationStatus: 'completed',
      separationProgress: 100,
    })

    // Wait for UI to update
    await page.waitForTimeout(300)

    const separateButton = page.getByTestId('separate-button')
    await expect(separateButton).toContainText('Open Stem Mixer')
  })

  test('should show disabled button when processing', async ({ page }) => {
    // Set store state to processing
    await setStemStoreState(page, {
      separationStatus: 'processing',
      separationProgress: 50,
    })

    await page.waitForTimeout(300)

    const separateButton = page.getByTestId('separate-button')
    await expect(separateButton).toBeDisabled()
  })
})

// ============================================================================
// Scenario 2: Stem Mixer Panel UI Tests
// ============================================================================

test.describe('Scenario 2: Stem Mixer Panel UI', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)

    // Set completed separation state and enable stem mode
    await setStemStoreState(page, {
      separationStatus: 'completed',
      separationProgress: 100,
      isStemMode: true,
      stems: {
        vocals: true,
        drums: true,
        bass: true,
        other: true,
      },
    })

    await page.waitForTimeout(500)
  })

  test('should show stem mixer panel in stem mode', async ({ page }) => {
    const mixerPanel = page.getByTestId('stem-mixer-panel')
    await expect(mixerPanel).toBeVisible({ timeout: 5000 })
  })

  test('should display 4 stem tracks', async ({ page }) => {
    const stemTracks = page.locator('[data-testid^="stem-track-"]')
    await expect(stemTracks).toHaveCount(4, { timeout: 5000 })
  })

  test('should display correct stem track names', async ({ page }) => {
    await expect(page.getByTestId('stem-track-vocals')).toBeVisible()
    await expect(page.getByTestId('stem-track-drums')).toBeVisible()
    await expect(page.getByTestId('stem-track-bass')).toBeVisible()
    await expect(page.getByTestId('stem-track-other')).toBeVisible()
  })
})

// ============================================================================
// Scenario 3: Volume Control Tests
// ============================================================================

test.describe('Scenario 3: Volume Control', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)

    // Enable stem mode
    await setStemStoreState(page, {
      separationStatus: 'completed',
      separationProgress: 100,
      isStemMode: true,
      stems: {
        vocals: true,
        drums: true,
        bass: true,
        other: true,
      },
    })

    await page.waitForTimeout(500)
  })

  test('should have volume sliders for each stem', async ({ page }) => {
    const stemNames = ['vocals', 'drums', 'bass', 'other']

    for (const stemName of stemNames) {
      const slider = page.getByTestId(`stem-volume-${stemName}`)
      await expect(slider).toBeVisible()

      // Check default value is 100
      await expect(slider).toHaveValue('100')
    }
  })

  test('should update volume display when slider changes', async ({ page }) => {
    const vocalsSlider = page.getByTestId('stem-volume-vocals')
    const vocalsDisplay = page.getByTestId('stem-volume-display-vocals')

    // Change volume to 50
    await vocalsSlider.fill('50')

    // Display should show 50%
    await expect(vocalsDisplay).toContainText('50')
  })

  test('should have independent volume for each stem', async ({ page }) => {
    // Set vocals to 80
    await page.getByTestId('stem-volume-vocals').fill('80')
    // Set drums to 40
    await page.getByTestId('stem-volume-drums').fill('40')
    // Set bass to 60
    await page.getByTestId('stem-volume-bass').fill('60')
    // Set other to 20
    await page.getByTestId('stem-volume-other').fill('20')

    // Verify each display
    await expect(page.getByTestId('stem-volume-display-vocals')).toContainText('80')
    await expect(page.getByTestId('stem-volume-display-drums')).toContainText('40')
    await expect(page.getByTestId('stem-volume-display-bass')).toContainText('60')
    await expect(page.getByTestId('stem-volume-display-other')).toContainText('20')
  })

  test('should allow volume from 0 to 100', async ({ page }) => {
    const vocalsSlider = page.getByTestId('stem-volume-vocals')

    // Set to 0
    await vocalsSlider.fill('0')
    await expect(page.getByTestId('stem-volume-display-vocals')).toContainText('0')

    // Set to 100
    await vocalsSlider.fill('100')
    await expect(page.getByTestId('stem-volume-display-vocals')).toContainText('100')
  })
})

// ============================================================================
// Scenario 4: Mute Functionality Tests
// ============================================================================

test.describe('Scenario 4: Mute Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)

    // Enable stem mode
    await setStemStoreState(page, {
      separationStatus: 'completed',
      separationProgress: 100,
      isStemMode: true,
      stems: {
        vocals: true,
        drums: true,
        bass: true,
        other: true,
      },
    })

    await page.waitForTimeout(500)
  })

  test('should have mute buttons for each stem', async ({ page }) => {
    const stemNames = ['vocals', 'drums', 'bass', 'other']

    for (const stemName of stemNames) {
      const muteButton = page.getByTestId(`stem-mute-${stemName}`)
      await expect(muteButton).toBeVisible()
      await expect(muteButton).toContainText('M')
    }
  })

  test('should toggle mute state on click', async ({ page }) => {
    const vocalsMute = page.getByTestId('stem-mute-vocals')

    // Initial state - not muted
    await expect(vocalsMute).toHaveAttribute('data-active', 'false')

    // Click to mute
    await vocalsMute.click()

    // Should be muted now
    await expect(vocalsMute).toHaveAttribute('data-active', 'true')

    // Click again to unmute
    await vocalsMute.click()

    // Should be unmuted
    await expect(vocalsMute).toHaveAttribute('data-active', 'false')
  })

  test('should work independently for each stem', async ({ page }) => {
    const vocalsMute = page.getByTestId('stem-mute-vocals')
    const drumsMute = page.getByTestId('stem-mute-drums')

    // Mute vocals only
    await vocalsMute.click()

    await expect(vocalsMute).toHaveAttribute('data-active', 'true')
    await expect(drumsMute).toHaveAttribute('data-active', 'false')

    // Mute drums as well
    await drumsMute.click()

    await expect(vocalsMute).toHaveAttribute('data-active', 'true')
    await expect(drumsMute).toHaveAttribute('data-active', 'true')
  })

  test('should show visual indicator when muted', async ({ page }) => {
    const vocalsMute = page.getByTestId('stem-mute-vocals')

    // Mute
    await vocalsMute.click()

    // Should have red background class when muted
    await expect(vocalsMute).toHaveClass(/bg-\[#EF4444\]/)
  })
})

// ============================================================================
// Scenario 5: Solo Functionality Tests
// ============================================================================

test.describe('Scenario 5: Solo Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)

    // Enable stem mode
    await setStemStoreState(page, {
      separationStatus: 'completed',
      separationProgress: 100,
      isStemMode: true,
      stems: {
        vocals: true,
        drums: true,
        bass: true,
        other: true,
      },
    })

    await page.waitForTimeout(500)
  })

  test('should have solo buttons for each stem', async ({ page }) => {
    const stemNames = ['vocals', 'drums', 'bass', 'other']

    for (const stemName of stemNames) {
      const soloButton = page.getByTestId(`stem-solo-${stemName}`)
      await expect(soloButton).toBeVisible()
      await expect(soloButton).toContainText('S')
    }
  })

  test('should toggle solo state on click', async ({ page }) => {
    const vocalsSolo = page.getByTestId('stem-solo-vocals')

    // Initial state - not soloed
    await expect(vocalsSolo).toHaveAttribute('data-active', 'false')

    // Click to solo
    await vocalsSolo.click()

    // Should be soloed now
    await expect(vocalsSolo).toHaveAttribute('data-active', 'true')

    // Click again to unsolo
    await vocalsSolo.click()

    // Should be unsoloed
    await expect(vocalsSolo).toHaveAttribute('data-active', 'false')
  })

  test('should allow multiple soloed stems', async ({ page }) => {
    const vocalsSolo = page.getByTestId('stem-solo-vocals')
    const drumsSolo = page.getByTestId('stem-solo-drums')

    // Solo both vocals and drums
    await vocalsSolo.click()
    await drumsSolo.click()

    // Both should be soloed
    await expect(vocalsSolo).toHaveAttribute('data-active', 'true')
    await expect(drumsSolo).toHaveAttribute('data-active', 'true')

    // Other stems should not be soloed
    await expect(page.getByTestId('stem-solo-bass')).toHaveAttribute('data-active', 'false')
    await expect(page.getByTestId('stem-solo-other')).toHaveAttribute('data-active', 'false')
  })

  test('should show colored background when soloed', async ({ page }) => {
    const vocalsSolo = page.getByTestId('stem-solo-vocals')

    // Solo
    await vocalsSolo.click()

    // Should have custom background color style
    const style = await vocalsSolo.evaluate(el => el.style.backgroundColor)
    // Vocals color is violet (#8B5CF6)
    expect(style).toBeTruthy()
  })
})

// ============================================================================
// Scenario 6: Mode Toggle Tests
// ============================================================================

test.describe('Scenario 6: Mode Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('should not show stem mixer panel by default', async ({ page }) => {
    const mixerPanel = page.getByTestId('stem-mixer-panel')
    await expect(mixerPanel).not.toBeVisible()
  })

  test('should enter stem mode when clicking Open Stem Mixer', async ({ page }) => {
    // Set completed state
    await setStemStoreState(page, {
      separationStatus: 'completed',
      separationProgress: 100,
    })

    await page.waitForTimeout(300)

    // Click Open Stem Mixer
    const separateButton = page.getByTestId('separate-button')
    await separateButton.click()

    // Stem mixer panel should be visible
    await expect(page.getByTestId('stem-mixer-panel')).toBeVisible({ timeout: 3000 })
  })

  test('should exit stem mode when clicking Exit Stem Mixer', async ({ page }) => {
    // Enable stem mode
    await setStemStoreState(page, {
      separationStatus: 'completed',
      separationProgress: 100,
      isStemMode: true,
      stems: {
        vocals: true,
        drums: true,
        bass: true,
        other: true,
      },
    })

    await page.waitForTimeout(500)

    // Verify stem mode is active
    await expect(page.getByTestId('stem-mixer-panel')).toBeVisible()

    // Find and click exit button
    const exitButton = page.getByRole('button', { name: /exit stem mixer/i })
    await exitButton.click()
    await page.waitForTimeout(300)

    // Stem mixer panel should no longer be visible
    await expect(page.getByTestId('stem-mixer-panel')).not.toBeVisible()
  })

  test('should show Open Stem Mixer button when separation completed but not in stem mode', async ({ page }) => {
    // Set completed state but not in stem mode
    await setStemStoreState(page, {
      separationStatus: 'completed',
      separationProgress: 100,
      isStemMode: false,
    })

    await page.waitForTimeout(300)

    // Should show Open Stem Mixer button at bottom
    const openButton = page.getByRole('button', { name: /open stem mixer/i })
    await expect(openButton).toBeVisible()
  })
})

// ============================================================================
// Scenario 7: Progress Display Tests
// ============================================================================

test.describe('Scenario 7: Progress Display', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('should show progress panel when processing', async ({ page }) => {
    await setStemStoreState(page, {
      separationStatus: 'processing',
      separationProgress: 50,
    })

    await page.waitForTimeout(300)

    const progressPanel = page.getByTestId('separation-progress')
    await expect(progressPanel).toBeVisible()
    await expect(progressPanel).toContainText('50')
  })

  test('should show upload status when uploading', async ({ page }) => {
    await setStemStoreState(page, {
      separationStatus: 'uploading',
      separationProgress: 0,
    })

    await page.waitForTimeout(300)

    const progressPanel = page.getByTestId('separation-progress')
    await expect(progressPanel).toBeVisible()
  })

  test('should show completed message when done', async ({ page }) => {
    await setStemStoreState(page, {
      separationStatus: 'completed',
      separationProgress: 100,
    })

    await page.waitForTimeout(300)

    const progressPanel = page.getByTestId('separation-progress')
    await expect(progressPanel).toBeVisible()
    await expect(progressPanel).toContainText('100')
  })

  test('should show error message when failed', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>).__STEM_STORE__ as {
        getState: () => {
          setSeparationStatus: (status: string) => void
          setErrorMessage: (message: string) => void
        }
      } | undefined

      if (store) {
        const actions = store.getState()
        actions.setSeparationStatus('failed')
        actions.setErrorMessage('Test error message')
      }
    })

    await page.waitForTimeout(300)

    const progressPanel = page.getByTestId('separation-progress')
    await expect(progressPanel).toBeVisible()
    // Check for either English "failed" or Korean "실패" (localized)
    await expect(progressPanel).toContainText(/failed|실패/)
  })
})

// ============================================================================
// Accessibility Tests
// ============================================================================

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)

    // Enable stem mode
    await setStemStoreState(page, {
      separationStatus: 'completed',
      separationProgress: 100,
      isStemMode: true,
      stems: {
        vocals: true,
        drums: true,
        bass: true,
        other: true,
      },
    })

    await page.waitForTimeout(500)
  })

  test('should have proper aria labels on volume sliders', async ({ page }) => {
    const vocalsSlider = page.getByTestId('stem-volume-vocals')
    const ariaLabel = await vocalsSlider.getAttribute('aria-label')
    expect(ariaLabel?.toLowerCase()).toContain('vocals')
    expect(ariaLabel?.toLowerCase()).toContain('volume')
  })

  test('should have proper aria labels on mute buttons', async ({ page }) => {
    const vocalsMute = page.getByTestId('stem-mute-vocals')
    const ariaLabel = await vocalsMute.getAttribute('aria-label')
    expect(ariaLabel?.toLowerCase()).toContain('vocals')
    expect(ariaLabel?.toLowerCase()).toContain('mute')
  })

  test('should have proper aria labels on solo buttons', async ({ page }) => {
    const vocalsSolo = page.getByTestId('stem-solo-vocals')
    const ariaLabel = await vocalsSolo.getAttribute('aria-label')
    expect(ariaLabel?.toLowerCase()).toContain('vocals')
    expect(ariaLabel?.toLowerCase()).toContain('solo')
  })

  test('should have aria-pressed on mute/solo buttons', async ({ page }) => {
    const vocalsMute = page.getByTestId('stem-mute-vocals')

    // Not pressed initially
    await expect(vocalsMute).toHaveAttribute('aria-pressed', 'false')

    // Click to mute
    await vocalsMute.click()

    // Should be pressed
    await expect(vocalsMute).toHaveAttribute('aria-pressed', 'true')
  })

  test('should have aria-pressed on solo buttons', async ({ page }) => {
    const vocalsSolo = page.getByTestId('stem-solo-vocals')

    // Not pressed initially
    await expect(vocalsSolo).toHaveAttribute('aria-pressed', 'false')

    // Click to solo
    await vocalsSolo.click()

    // Should be pressed
    await expect(vocalsSolo).toHaveAttribute('aria-pressed', 'true')
  })
})
