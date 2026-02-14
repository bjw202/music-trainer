import { test, expect } from '@playwright/test'
import { setupAudioPage, waitForAudioEngine } from './helpers/audio-loader'

/**
 * YouTube URL -> MP3 변환 -> 실제 재생 E2E 테스트
 *
 * [필수 조건]
 * - 백엔드 서버: http://localhost:8000 (uvicorn)
 * - 프론트엔드: http://localhost:5173 (vite dev)
 * - ffmpeg 시스템 설치
 * - 인터넷 연결 (실제 YouTube 다운로드)
 *
 * 실행: npx playwright test youtube-conversion
 */

// 실제 YouTube 변환은 시간이 오래 걸릴 수 있음
test.setTimeout(300_000) // 5분 타임아웃

test.describe('YouTube 전체 파이프라인 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
  })

  test('E2E-1: 실제 YouTube URL로 전체 파이프라인 검증', async ({ page }) => {
    const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

    // YouTube URL 입력 필드가 보이는지 확인
    const urlInput = page.getByTestId('youtube-url-input')
    await expect(urlInput).toBeVisible()

    // URL 입력
    await urlInput.fill(YOUTUBE_URL)

    // 변환 버튼 클릭
    const convertButton = page.getByTestId('youtube-convert-button')
    await expect(convertButton).toBeEnabled()
    await convertButton.click()

    // 프로그레스 바가 표시되어야 함
    const progressBar = page.getByTestId('youtube-progress-bar')
    await expect(progressBar).toBeVisible({ timeout: 30_000 })

    // 변환 완료 대기 (프로그레스 바 사라짐 = 변환 완료 + 오디오 로드)
    // 또는 파형이 나타남
    await page.waitForSelector('[data-testid="waveform-container"]', {
      timeout: 300_000, // 최대 5분 대기
    })

    // 파형이 렌더링되었는지 확인
    const waveform = page.getByTestId('waveform-container')
    await expect(waveform).toBeVisible()

    // 재생 버튼이 활성화되었는지 확인
    const playButton = page.getByRole('button', { name: /play/i })
    await expect(playButton).toBeEnabled()

    // AudioEngine 준비 대기
    await waitForAudioEngine(page)

    // 재생 시작
    await playButton.click()

    // AudioContext가 running 상태인지 확인
    const audioState = await page.evaluate(() => {
      const engine = (window as unknown as Record<string, unknown>).__audioEngine as {
        getIsPlaying: () => boolean
        getCurrentTime: () => number
      } | undefined

      return {
        isPlaying: engine?.getIsPlaying() ?? false,
      }
    })
    expect(audioState.isPlaying).toBe(true)

    // 3초 대기 후 실제 재생 확인
    await page.waitForTimeout(3000)

    // 재생 위치가 0보다 크면 실제로 재생된 것
    const currentTime = await page.evaluate(() => {
      const engine = (window as unknown as Record<string, unknown>).__audioEngine as {
        getCurrentTime: () => number
      } | undefined
      return engine?.getCurrentTime() ?? 0
    })
    expect(currentTime).toBeGreaterThan(0)

    // 일시정지
    const pauseButton = page.getByRole('button', { name: /pause/i })
    await pauseButton.click()

    // 일시정지 확인
    const afterPause = await page.evaluate(() => {
      const engine = (window as unknown as Record<string, unknown>).__audioEngine as {
        getIsPlaying: () => boolean
        getCurrentTime: () => number
      } | undefined
      return {
        isPlaying: engine?.getIsPlaying() ?? true,
        currentTime: engine?.getCurrentTime() ?? 0,
      }
    })
    expect(afterPause.isPlaying).toBe(false)
    expect(afterPause.currentTime).toBeGreaterThan(0)
  })

  test('E2E-2: YouTube 단축 URL로 전체 파이프라인 검증', async ({ page }) => {
    const SHORT_URL = 'https://youtu.be/dQw4w9WgXcQ'

    const urlInput = page.getByTestId('youtube-url-input')
    await urlInput.fill(SHORT_URL)

    const convertButton = page.getByTestId('youtube-convert-button')
    await convertButton.click()

    // 프로그레스 바 표시 확인
    const progressBar = page.getByTestId('youtube-progress-bar')
    await expect(progressBar).toBeVisible({ timeout: 30_000 })

    // 변환 완료 대기 (파형 나타남)
    await page.waitForSelector('[data-testid="waveform-container"]', {
      timeout: 300_000,
    })

    // 파형 렌더링 확인
    const waveform = page.getByTestId('waveform-container')
    await expect(waveform).toBeVisible()

    // 재생 가능 상태 확인
    const playButton = page.getByRole('button', { name: /play/i })
    await expect(playButton).toBeEnabled()
  })

  test('E2E-3: 변환된 오디오에 속도/피치 제어 적용 검증', async ({ page }) => {
    const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

    // URL 입력 → 변환 → 오디오 로드
    const urlInput = page.getByTestId('youtube-url-input')
    await urlInput.fill(YOUTUBE_URL)
    await page.getByTestId('youtube-convert-button').click()

    // 변환 완료 대기
    await page.waitForSelector('[data-testid="waveform-container"]', {
      timeout: 300_000,
    })

    await waitForAudioEngine(page)

    // 재생 시작
    const playButton = page.getByRole('button', { name: /play/i })
    await playButton.click()
    await page.waitForTimeout(1000)

    // 현재 재생 위치 기록
    const posBeforeSpeed = await page.evaluate(() => {
      const engine = (window as unknown as Record<string, unknown>).__audioEngine as {
        getCurrentTime: () => number
      } | undefined
      return engine?.getCurrentTime() ?? 0
    })

    // 속도 슬라이더를 0.75로 변경
    const speedSlider = page.getByTestId('speed-slider')
    if (await speedSlider.isVisible()) {
      await speedSlider.fill('0.75')
      await speedSlider.dispatchEvent('input')
    }

    // 속도 변경 후 재생 위치가 점프하지 않아야 함
    await page.waitForTimeout(500)
    const posAfterSpeed = await page.evaluate(() => {
      const engine = (window as unknown as Record<string, unknown>).__audioEngine as {
        getCurrentTime: () => number
        getSpeed: () => number
      } | undefined
      return {
        currentTime: engine?.getCurrentTime() ?? 0,
        speed: engine?.getSpeed() ?? 1,
      }
    })

    // 재생 위치가 급격히 점프하지 않아야 함 (±5초 이내)
    expect(Math.abs(posAfterSpeed.currentTime - posBeforeSpeed)).toBeLessThan(5)

    // 피치 슬라이더를 +3으로 변경
    const pitchSlider = page.getByTestId('pitch-slider')
    if (await pitchSlider.isVisible()) {
      await pitchSlider.fill('3')
      await pitchSlider.dispatchEvent('input')
    }

    await page.waitForTimeout(500)

    // 피치 변경 후에도 재생이 계속되어야 함
    const afterPitch = await page.evaluate(() => {
      const engine = (window as unknown as Record<string, unknown>).__audioEngine as {
        getIsPlaying: () => boolean
        getCurrentTime: () => number
      } | undefined
      return {
        isPlaying: engine?.getIsPlaying() ?? false,
        currentTime: engine?.getCurrentTime() ?? 0,
      }
    })
    expect(afterPitch.isPlaying).toBe(true)
    expect(afterPitch.currentTime).toBeGreaterThan(posBeforeSpeed)
  })
})

test.describe('YouTube UI 에러 시나리오', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioPage(page)
  })

  test('잘못된 URL 입력 시 클라이언트 에러 표시', async ({ page }) => {
    const urlInput = page.getByTestId('youtube-url-input')
    await urlInput.fill('https://example.com/not-youtube')

    const convertButton = page.getByTestId('youtube-convert-button')
    await convertButton.click()

    // 에러 메시지가 표시되어야 함
    await expect(page.getByText(/유효한 YouTube URL/)).toBeVisible()
  })

  test('빈 URL로 변환 시도 시 검증 에러', async ({ page }) => {
    const convertButton = page.getByTestId('youtube-convert-button')

    // 빈 URL 상태에서 버튼이 비활성화되어야 함
    await expect(convertButton).toBeDisabled()
  })
})
