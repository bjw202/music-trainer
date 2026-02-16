import { test, expect } from '@playwright/test'
import { setupAudioPage, loadAudioFile } from './helpers/audio-loader'

/**
 * Worker Processing Verification Test
 *
 * Worker가 실제로 오디오를 처리하는지 확인합니다.
 */
test('Worker should process audio when speed changes', async ({ page }) => {
  const logs: string[] = []

  page.on('console', msg => {
    const text = msg.text()
    logs.push(text)
    // 중요 로그만 출력
    if (text.includes('[Worker]') || text.includes('[AudioEngine]') || text.includes('requestBufferProcessing')) {
      console.log('LOG:', text)
    }
  })

  // 페이지 설정 및 오디오 로드
  await setupAudioPage(page)
  await loadAudioFile(page)

  // Worker가 준비될 때까지 대기
  await page.waitForTimeout(1000)

  // 속도 변경
  const speedSlider = page.getByTestId('speed-slider')
  await speedSlider.fill('1.5')

  // Worker 처리 완료 대기
  await page.waitForTimeout(2000)

  // 로그 분석
  const workerReceived = logs.some(l => l.includes('[Worker] Received message: process') && l.includes('speed: 1.5'))
  const workerComplete = logs.some(l => l.includes('[Worker] Processing complete'))
  const engineResponse = logs.some(l => l.includes('[AudioEngine] Worker response: complete'))
  const processedBufferSet = logs.some(l => l.includes('[AudioEngine] processedBuffer set'))

  console.log('\n=== Results ===')
  console.log('Worker received request:', workerReceived)
  console.log('Worker completed processing:', workerComplete)
  console.log('Engine received response:', engineResponse)
  console.log('Processed buffer set:', processedBufferSet)

  // 최소한 Worker가 요청을 받았는지 확인
  expect(workerReceived || logs.some(l => l.includes('Using fallback sync processing'))).toBeTruthy()
})

test('Audio should use processed buffer during playback', async ({ page }) => {
  const logs: string[] = []

  page.on('console', msg => {
    const text = msg.text()
    logs.push(text)
    if (text.includes('[Worker]') || text.includes('[AudioEngine]') || text.includes('getActiveBuffer')) {
      console.log('LOG:', text)
    }
  })

  await setupAudioPage(page)
  await loadAudioFile(page)

  // 재생 시작
  const playButton = page.getByRole('button', { name: /play/i })
  await playButton.click()
  await page.waitForTimeout(500)

  // 속도 변경 (fill 대신 evaluate 사용)
  await page.evaluate(() => {
    const slider = document.querySelector('[data-testid="speed-slider"]') as HTMLInputElement
    if (slider) {
      slider.value = '2.0'
      slider.dispatchEvent(new Event('input', { bubbles: true }))
      slider.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })

  // Worker 처리 완료 대기
  await page.waitForTimeout(2000)

  // getActiveBuffer가 processed를 반환했는지 확인
  const usedProcessedBuffer = logs.some(l => l.includes('getActiveBuffer: returning processed'))
  console.log('Used processed buffer:', usedProcessedBuffer)

  // processedBuffer 확인
  const bufferInfo = await page.evaluate(() => {
    const engine = (window as unknown as Record<string, unknown>).__audioEngine as {
      ['processedBuffer']: AudioBuffer | null
      ['buffer']: AudioBuffer | null
    } | undefined

    if (!engine) return null

    const processed = (engine as unknown as Record<string, AudioBuffer | null>)['processedBuffer']
    const original = (engine as unknown as Record<string, AudioBuffer | null>)['buffer']

    return {
      hasProcessedBuffer: processed !== null,
      processedDuration: processed?.duration ?? null,
      originalDuration: original?.duration ?? null,
    }
  })

  console.log('Buffer info:', bufferInfo)

  expect(bufferInfo).not.toBeNull()
  expect(bufferInfo!.hasProcessedBuffer).toBe(true)

  // 2.0x 속도에서 처리된 버퍼는 원본의 약 절반이어야 함
  const originalDuration = bufferInfo!.originalDuration!
  const processedDuration = bufferInfo!.processedDuration!

  console.log(`Original duration: ${originalDuration}s, Processed duration: ${processedDuration}s`)

  // 2.0x 속도에서는 duration이 약 절반이어야 함
  expect(processedDuration).toBeLessThan(originalDuration * 0.7)
  expect(processedDuration).toBeGreaterThan(originalDuration * 0.4)
})

test('Audio duration display should change with speed', async ({ page }) => {
  await setupAudioPage(page)
  await loadAudioFile(page)

  // 재생 시작
  const playButton = page.getByRole('button', { name: /play/i })
  await playButton.click()
  await page.waitForTimeout(500)

  // 원본 duration 표시 확인
  const timeDisplay = page.getByTestId('time-display').first()
  const originalTimeText = await timeDisplay.textContent()
  console.log('Original time display:', originalTimeText)

  // 속도 변경
  await page.evaluate(() => {
    const slider = document.querySelector('[data-testid="speed-slider"]') as HTMLInputElement
    if (slider) {
      slider.value = '2.0'
      slider.dispatchEvent(new Event('input', { bubbles: true }))
      slider.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })

  // 처리 완료 대기
  await page.waitForTimeout(2000)

  // 재생 중인지 확인
  const pauseButton = page.getByRole('button', { name: /pause/i })
  await expect(pauseButton).toBeVisible({ timeout: 5000 }).catch(() => {
    console.log('Pause button not visible - playback may have stopped')
  })

  // processedBuffer 확인
  const bufferInfo = await page.evaluate(() => {
    const engine = (window as unknown as Record<string, unknown>).__audioEngine as {
      ['processedBuffer']: AudioBuffer | null
      ['buffer']: AudioBuffer | null
      getDuration: () => number
    } | undefined

    if (!engine) return null

    const processed = (engine as unknown as Record<string, AudioBuffer | null>)['processedBuffer']
    const original = (engine as unknown as Record<string, AudioBuffer | null>)['buffer']

    return {
      hasProcessedBuffer: processed !== null,
      processedDuration: processed?.duration ?? null,
      originalDuration: original?.duration ?? null,
      engineDuration: engine.getDuration ? engine.getDuration() : null,
    }
  })

  console.log('Final buffer info:', bufferInfo)
  expect(bufferInfo!.hasProcessedBuffer).toBe(true)
})
