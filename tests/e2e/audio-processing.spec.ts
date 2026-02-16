import { test, expect } from '@playwright/test'
import { setupAudioPage, loadAudioFile } from './helpers/audio-loader'

/**
 * Audio Processing Verification E2E Tests
 *
 * 실제 오디오 엔진의 내부 상태를 검증하여 속도/피치 변경이
 * UI만 아닌 오디오 처리에도 반영되는지 확인합니다.
 *
 * window.__audioEngine를 통해 AudioEngine 인스턴스에 접근합니다.
 * (dev 모드에서만 노출됨)
 */

// 엔진 상태를 안전하게 조회하는 헬퍼
async function getEngineState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const engine = (window as unknown as Record<string, unknown>).__audioEngine as {
      getSpeed: () => number
      getPitch: () => number
      getIsPlaying: () => boolean
      getDuration: () => number
    } | undefined

    if (!engine) {
      return null
    }

    return {
      speed: engine.getSpeed(),
      pitch: engine.getPitch(),
      isPlaying: engine.getIsPlaying(),
      duration: engine.getDuration(),
    }
  })
}

// processedBuffer 정보를 조회하는 헬퍼
async function getProcessedBufferInfo(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const engine = (window as unknown as Record<string, unknown>).__audioEngine as {
      ['processedBuffer']: AudioBuffer | null
      ['buffer']: AudioBuffer | null
      ['currentSpeed']: number
      ['currentPitch']: number
    } | undefined

    if (!engine) {
      return null
    }

    // private 필드에 직접 접근 (JS에서는 가능)
    const processed = (engine as unknown as Record<string, AudioBuffer | null>)['processedBuffer']
    const original = (engine as unknown as Record<string, AudioBuffer | null>)['buffer']

    return {
      hasProcessedBuffer: processed !== null,
      processedDuration: processed?.duration ?? null,
      processedLength: processed?.length ?? null,
      originalDuration: original?.duration ?? null,
      originalLength: original?.length ?? null,
    }
  })
}

// ============================================================================
// Category 1: Engine Speed/Pitch State Verification (엔진 상태 검증)
// ============================================================================

test.describe('Engine State Verification', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('engine should exist on window in dev mode', async ({ page }) => {
    const state = await getEngineState(page)
    expect(state).not.toBeNull()
    expect(state!.speed).toBe(1.0)
    expect(state!.pitch).toBe(0)
  })

  test('engine speed should change when slider is adjusted', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')

    // 속도를 1.5x로 변경
    await speedSlider.fill('1.5')
    await page.waitForTimeout(500) // 버퍼 재빌드 대기

    const state = await getEngineState(page)
    expect(state).not.toBeNull()
    expect(state!.speed).toBeCloseTo(1.5, 1)
  })

  test('engine pitch should change when slider is adjusted', async ({ page }) => {
    const pitchSlider = page.getByTestId('pitch-slider')

    // 피치를 +3 반음으로 변경
    await pitchSlider.fill('3')
    await page.waitForTimeout(500)

    const state = await getEngineState(page)
    expect(state).not.toBeNull()
    expect(state!.pitch).toBe(3)
  })

  test('engine should reflect keyboard speed change', async ({ page }) => {
    // = 키로 속도 증가 (1.0 → 1.1)
    await page.keyboard.press('Equal')
    await page.waitForTimeout(500)

    const state = await getEngineState(page)
    expect(state).not.toBeNull()
    expect(state!.speed).toBeCloseTo(1.1, 1)
  })

  test('engine should reflect keyboard pitch change', async ({ page }) => {
    // ] 키로 피치 증가 (0 → 1)
    await page.keyboard.press('BracketRight')
    await page.waitForTimeout(500)

    const state = await getEngineState(page)
    expect(state).not.toBeNull()
    expect(state!.pitch).toBe(1)
  })

  test('engine should reset on R key', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')
    const pitchSlider = page.getByTestId('pitch-slider')

    // 속도와 피치를 변경
    await speedSlider.fill('1.5')
    await page.waitForTimeout(300)
    await pitchSlider.fill('3')
    await page.waitForTimeout(500)

    // 슬라이더 포커스 해제 (input 포커스 중에는 키보드 단축키가 무시됨)
    await pitchSlider.evaluate(el => (el as HTMLElement).blur())
    await page.waitForTimeout(100)

    // R 키로 리셋
    await page.keyboard.press('r')
    await page.waitForTimeout(500)

    const state = await getEngineState(page)
    expect(state).not.toBeNull()
    expect(state!.speed).toBe(1.0)
    expect(state!.pitch).toBe(0)
  })
})

// ============================================================================
// Category 2: Processed Buffer Verification (처리된 버퍼 검증)
// ============================================================================

test.describe('Processed Buffer Verification', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('should have no processed buffer at default speed/pitch', async ({ page }) => {
    const bufferInfo = await getProcessedBufferInfo(page)
    expect(bufferInfo).not.toBeNull()
    expect(bufferInfo!.hasProcessedBuffer).toBe(false)
    expect(bufferInfo!.originalDuration).toBeGreaterThan(0)
  })

  test('should create processed buffer when speed changes', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')

    // 속도를 2.0x로 변경
    await speedSlider.fill('2')
    await page.waitForTimeout(1000) // 오프라인 버퍼 처리 대기

    const bufferInfo = await getProcessedBufferInfo(page)
    expect(bufferInfo).not.toBeNull()
    expect(bufferInfo!.hasProcessedBuffer).toBe(true)
    expect(bufferInfo!.processedDuration).toBeGreaterThan(0)
  })

  test('processed buffer duration should be shorter at 2.0x speed', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')

    // 속도를 2.0x로 변경
    await speedSlider.fill('2')
    await page.waitForTimeout(1000)

    const bufferInfo = await getProcessedBufferInfo(page)
    expect(bufferInfo).not.toBeNull()
    expect(bufferInfo!.hasProcessedBuffer).toBe(true)

    const originalDuration = bufferInfo!.originalDuration!
    const processedDuration = bufferInfo!.processedDuration!

    // 2.0x 속도에서 처리된 버퍼는 원본의 약 절반 길이여야 함
    // SoundTouch 처리 특성상 10% 오차 허용
    const expectedDuration = originalDuration / 2.0
    expect(processedDuration).toBeGreaterThan(expectedDuration * 0.8)
    expect(processedDuration).toBeLessThan(expectedDuration * 1.2)
  })

  test('processed buffer duration should be longer at 0.5x speed', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')

    // 속도를 0.5x로 변경
    await speedSlider.fill('0.5')
    await page.waitForTimeout(1500) // 느린 속도 = 더 긴 버퍼 = 더 많은 처리 시간

    const bufferInfo = await getProcessedBufferInfo(page)
    expect(bufferInfo).not.toBeNull()
    expect(bufferInfo!.hasProcessedBuffer).toBe(true)

    const originalDuration = bufferInfo!.originalDuration!
    const processedDuration = bufferInfo!.processedDuration!

    // 0.5x 속도에서 처리된 버퍼는 원본의 약 2배 길이여야 함
    const expectedDuration = originalDuration / 0.5
    expect(processedDuration).toBeGreaterThan(expectedDuration * 0.8)
    expect(processedDuration).toBeLessThan(expectedDuration * 1.2)
  })

  test('processed buffer should exist for pitch change', async ({ page }) => {
    const pitchSlider = page.getByTestId('pitch-slider')

    // 피치를 +6 반음으로 변경
    await pitchSlider.fill('6')
    await page.waitForTimeout(1000)

    const bufferInfo = await getProcessedBufferInfo(page)
    expect(bufferInfo).not.toBeNull()
    expect(bufferInfo!.hasProcessedBuffer).toBe(true)
    expect(bufferInfo!.processedDuration).toBeGreaterThan(0)

    // 피치만 변경하면 duration은 유사해야 함 (속도 변경 없음)
    const originalDuration = bufferInfo!.originalDuration!
    const processedDuration = bufferInfo!.processedDuration!
    expect(processedDuration).toBeGreaterThan(originalDuration * 0.8)
    expect(processedDuration).toBeLessThan(originalDuration * 1.2)
  })

  test('processed buffer should be cleared after reset', async ({ page }) => {
    const speedSlider = page.getByTestId('speed-slider')

    // 속도를 변경
    await speedSlider.fill('1.5')
    await page.waitForTimeout(1000)

    // processedBuffer 존재 확인
    let bufferInfo = await getProcessedBufferInfo(page)
    expect(bufferInfo!.hasProcessedBuffer).toBe(true)

    // 슬라이더 포커스 해제 후 리셋
    await speedSlider.evaluate(el => (el as HTMLElement).blur())
    await page.waitForTimeout(100)
    await page.keyboard.press('r')
    await page.waitForTimeout(500)

    // processedBuffer가 null이어야 함
    bufferInfo = await getProcessedBufferInfo(page)
    expect(bufferInfo!.hasProcessedBuffer).toBe(false)
  })
})

// ============================================================================
// Category 3: Audio Processing During Playback (재생 중 처리 검증)
// ============================================================================

test.describe('Audio Processing During Playback', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
    await loadAudioFile(page)
  })

  test('speed change during playback should update engine state', async ({ page }) => {
    // 재생 시작
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()
    await page.waitForTimeout(500)

    // 재생 중 확인
    let state = await getEngineState(page)
    expect(state!.isPlaying).toBe(true)

    // 재생 중 속도 변경
    const speedSlider = page.getByTestId('speed-slider')
    await speedSlider.fill('1.5')
    await page.waitForTimeout(500)

    // 엔진 상태 확인
    state = await getEngineState(page)
    expect(state!.speed).toBeCloseTo(1.5, 1)
    expect(state!.isPlaying).toBe(true) // 재생이 유지되어야 함
  })

  test('pitch change during playback should update engine state', async ({ page }) => {
    // 재생 시작
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()
    await page.waitForTimeout(500)

    // 재생 중 피치 변경
    const pitchSlider = page.getByTestId('pitch-slider')
    await pitchSlider.fill('4')
    await page.waitForTimeout(500)

    // 엔진 상태 확인
    const state = await getEngineState(page)
    expect(state!.pitch).toBe(4)
    expect(state!.isPlaying).toBe(true)
  })

  test('processed buffer should exist during playback with changed speed', async ({ page }) => {
    // 재생 시작
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()
    await page.waitForTimeout(300)

    // 속도 변경
    const speedSlider = page.getByTestId('speed-slider')
    await speedSlider.fill('1.8')
    await page.waitForTimeout(1000)

    // 처리된 버퍼가 존재해야 함
    const bufferInfo = await getProcessedBufferInfo(page)
    expect(bufferInfo!.hasProcessedBuffer).toBe(true)
    expect(bufferInfo!.processedDuration).toBeGreaterThan(0)
  })
})
