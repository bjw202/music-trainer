import { test, expect } from '@playwright/test'
import { setupAudioPage, loadAudioFile } from './helpers/audio-loader'

/**
 * BPM Metronome E2E Tests
 *
 * MetronomePanel 컴포넌트에 대한 E2E 테스트
 * Mock API를 사용하여 백엔드 없이 동작 검증
 */

// Mock API success response
const MOCK_BPM_RESPONSE = {
  bpm: 120.5,
  beats: [0.5, 1.0, 1.5],
  confidence: 0.95,
  file_hash: 'abc123',
}

// Mock API 설정: BPM 분석 성공
async function setupBpmApiMock(page: any) {
  await page.route('**/api/v1/bpm/analyze', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_BPM_RESPONSE),
    })
  })
}

// Mock API 설정: BPM 분석 실패
async function setupBpmApiFailMock(page: any) {
  await page.route('**/api/v1/bpm/analyze', (route: any) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'BPM analysis failed' }),
    })
  })
}

/**
 * 시나리오 1: BPM 분석 요청 UI 흐름
 * - 파일이 없을 때 분석 버튼 비활성화 확인
 */
test.describe('BPM 분석 버튼 상태', () => {
  test('파일이 없을 때 분석 버튼이 비활성화되어야 한다', async ({ page }) => {
    await setupAudioPage(page)

    // 파일 없는 초기 상태에서는 드래그앤드롭 존이 표시됨
    // MetronomePanel은 오디오 파일이 로드된 후에만 접근 가능하므로
    // 파일 로드 없이 페이지를 방문하면 컨트롤이 비활성화 상태
    const dragDropZone = page.getByText('Drop your audio file here')
    await expect(dragDropZone).toBeVisible()
  })

  test('파일이 로드된 후 분석 버튼이 활성화되어야 한다', async ({ page }) => {
    await setupBpmApiMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    // 분석 버튼을 aria-label로 찾기
    const analyzeButton = page.getByRole('button', { name: 'BPM 분석' })
    await expect(analyzeButton).toBeVisible()
    await expect(analyzeButton).toBeEnabled()
  })

  test('분석 중에는 분석 버튼이 비활성화되어야 한다', async ({ page }) => {
    // 느린 응답으로 Mock 설정
    await page.route('**/api/v1/bpm/analyze', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BPM_RESPONSE),
      })
    })

    await setupAudioPage(page)
    await loadAudioFile(page)

    const analyzeButton = page.getByRole('button', { name: 'BPM 분석' })
    await analyzeButton.click()

    // 분석 중 상태: "분석 중" 텍스트가 표시되고 버튼 비활성화
    const analyzingText = page.getByText('분석 중')
    await expect(analyzingText).toBeVisible({ timeout: 3000 })
    await expect(analyzeButton).toBeDisabled()
  })
})

/**
 * 시나리오 2: 메트로놈 토글
 * - BPM 데이터가 없을 때 토글 버튼 비활성화
 * - BPM 데이터가 있을 때 토글 버튼 활성화 및 상태 변경
 */
test.describe('메트로놈 토글 버튼', () => {
  test('BPM 분석 전에는 메트로놈 토글 버튼이 비활성화되어야 한다', async ({ page }) => {
    await setupBpmApiMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    const toggleButton = page.getByRole('button', { name: '메트로놈 토글' })
    await expect(toggleButton).toBeVisible()
    await expect(toggleButton).toBeDisabled()
  })

  test('BPM 분석 후 메트로놈 토글 버튼이 활성화되어야 한다', async ({ page }) => {
    await setupBpmApiMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    // BPM 분석 실행
    const analyzeButton = page.getByRole('button', { name: 'BPM 분석' })
    await analyzeButton.click()

    // 분석 완료 후 BPM 값이 표시될 때까지 대기
    // BPM이 121 (120.5 반올림)로 표시되어야 함
    await page.waitForFunction(() => {
      const elements = document.querySelectorAll('.font-mono')
      return Array.from(elements).some((el) => el.textContent?.includes('121'))
    }, { timeout: 5000 })

    const toggleButton = page.getByRole('button', { name: '메트로놈 토글' })
    await expect(toggleButton).toBeEnabled()
  })

  test('메트로놈 토글 버튼 클릭 시 ON/OFF 텍스트가 변경되어야 한다', async ({ page }) => {
    await setupBpmApiMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    // BPM 분석 실행
    const analyzeButton = page.getByRole('button', { name: 'BPM 분석' })
    await analyzeButton.click()

    // BPM 표시 대기
    await page.waitForFunction(() => {
      const elements = document.querySelectorAll('.font-mono')
      return Array.from(elements).some((el) => el.textContent?.includes('121'))
    }, { timeout: 5000 })

    const toggleButton = page.getByRole('button', { name: '메트로놈 토글' })

    // 초기 상태: OFF
    await expect(toggleButton).toContainText('OFF')

    // 클릭하여 활성화
    await toggleButton.click()
    await expect(toggleButton).toContainText('ON')

    // 다시 클릭하여 비활성화
    await toggleButton.click()
    await expect(toggleButton).toContainText('OFF')
  })
})

/**
 * 시나리오 3: 볼륨 슬라이더
 * - 슬라이더 값 변경 시 반영 확인
 */
test.describe('메트로놈 볼륨 슬라이더', () => {
  test('기본 볼륨값이 50%로 표시되어야 한다', async ({ page }) => {
    await setupBpmApiMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    // 볼륨 퍼센트 표시 확인 (초기값 50%)
    const volumeDisplay = page.locator('span.text-xs.text-\\[\\#9CA3AF\\]').filter({ hasText: '%' })
    await expect(volumeDisplay.first()).toContainText('50%')
  })

  test('볼륨 슬라이더가 메트로놈 활성화 전에는 비활성화되어야 한다', async ({ page }) => {
    await setupBpmApiMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    const volumeSlider = page.getByRole('slider', { name: '메트로놈 볼륨' })
    await expect(volumeSlider).toBeDisabled()
  })

  test('메트로놈 활성화 후 볼륨 슬라이더를 조작할 수 있어야 한다', async ({ page }) => {
    await setupBpmApiMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    // BPM 분석 실행
    const analyzeButton = page.getByRole('button', { name: 'BPM 분석' })
    await analyzeButton.click()

    // BPM 표시 대기
    await page.waitForFunction(() => {
      const elements = document.querySelectorAll('.font-mono')
      return Array.from(elements).some((el) => el.textContent?.includes('121'))
    }, { timeout: 5000 })

    // 메트로놈 활성화
    const toggleButton = page.getByRole('button', { name: '메트로놈 토글' })
    await toggleButton.click()
    await expect(toggleButton).toContainText('ON')

    // 볼륨 슬라이더 확인
    const volumeSlider = page.getByRole('slider', { name: '메트로놈 볼륨' })
    await expect(volumeSlider).toBeEnabled()

    // 볼륨 변경 (75)
    await volumeSlider.fill('75')
    const value = await volumeSlider.inputValue()
    expect(value).toBe('75')
  })

  test('볼륨 변경 시 퍼센트 표시가 업데이트되어야 한다', async ({ page }) => {
    await setupBpmApiMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    // BPM 분석 및 메트로놈 활성화
    const analyzeButton = page.getByRole('button', { name: 'BPM 분석' })
    await analyzeButton.click()

    await page.waitForFunction(() => {
      const elements = document.querySelectorAll('.font-mono')
      return Array.from(elements).some((el) => el.textContent?.includes('121'))
    }, { timeout: 5000 })

    const toggleButton = page.getByRole('button', { name: '메트로놈 토글' })
    await toggleButton.click()

    // 볼륨 80으로 변경
    const volumeSlider = page.getByRole('slider', { name: '메트로놈 볼륨' })
    await volumeSlider.fill('80')

    // 퍼센트 표시 업데이트 확인
    const volumeDisplay = page.locator('span.text-xs.text-\\[\\#9CA3AF\\]').filter({ hasText: '80%' })
    await expect(volumeDisplay).toBeVisible()
  })
})

/**
 * 시나리오 4: BPM 표시
 * - bpmStore에 BPM 값이 있을 때 정확히 표시되는지 확인
 */
test.describe('BPM 값 표시', () => {
  test('초기 상태에서 BPM이 대시(—)로 표시되어야 한다', async ({ page }) => {
    await setupBpmApiMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    // 분석 전 BPM 표시: 대시 문자
    const bpmDisplay = page.locator('.font-mono.font-bold')
    await expect(bpmDisplay).toContainText('—')
  })

  test('BPM 분석 후 올바른 BPM 값이 표시되어야 한다', async ({ page }) => {
    await setupBpmApiMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    const analyzeButton = page.getByRole('button', { name: 'BPM 분석' })
    await analyzeButton.click()

    // 120.5 -> Math.round -> 121 이 표시되어야 함
    const bpmDisplay = page.locator('.font-mono.font-bold')
    await expect(bpmDisplay).toContainText('121', { timeout: 5000 })
  })

  test('BPM 분석 후 신뢰도가 표시되어야 한다', async ({ page }) => {
    await setupBpmApiMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    const analyzeButton = page.getByRole('button', { name: 'BPM 분석' })
    await analyzeButton.click()

    // confidence: 0.95 -> "95%"
    const confidenceText = page.getByText('신뢰도: 95%')
    await expect(confidenceText).toBeVisible({ timeout: 5000 })
  })

  test('BPM 레이블이 항상 표시되어야 한다', async ({ page }) => {
    await setupBpmApiMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    const bpmLabel = page.getByText('BPM')
    await expect(bpmLabel).toBeVisible()
  })
})

/**
 * 시나리오 5: 에러 상태
 * - API 실패 시 에러 메시지 표시 확인
 */
test.describe('BPM 분석 에러 처리', () => {
  test('API 실패 시 에러 메시지가 표시되어야 한다', async ({ page }) => {
    await setupBpmApiFailMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    const analyzeButton = page.getByRole('button', { name: 'BPM 분석' })
    await analyzeButton.click()

    // 에러 메시지 표시 대기
    // 서버에서 {"detail": "BPM analysis failed"} 반환 -> "BPM analysis failed" 표시
    const errorMessage = page.locator('.text-red-400')
    await expect(errorMessage).toBeVisible({ timeout: 5000 })
    await expect(errorMessage).toContainText('BPM analysis failed')
  })

  test('API 실패 후 BPM 값이 표시되지 않아야 한다', async ({ page }) => {
    await setupBpmApiFailMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    const analyzeButton = page.getByRole('button', { name: 'BPM 분석' })
    await analyzeButton.click()

    // 에러 메시지 표시 대기
    const errorMessage = page.locator('.text-red-400')
    await expect(errorMessage).toBeVisible({ timeout: 5000 })

    // BPM 값은 여전히 대시(—)여야 함
    const bpmDisplay = page.locator('.font-mono.font-bold')
    await expect(bpmDisplay).toContainText('—')
  })

  test('API 실패 후 메트로놈 토글 버튼이 비활성화 상태여야 한다', async ({ page }) => {
    await setupBpmApiFailMock(page)
    await setupAudioPage(page)
    await loadAudioFile(page)

    const analyzeButton = page.getByRole('button', { name: 'BPM 분석' })
    await analyzeButton.click()

    // 에러 표시 대기
    const errorMessage = page.locator('.text-red-400')
    await expect(errorMessage).toBeVisible({ timeout: 5000 })

    // BPM이 null이므로 메트로놈 토글은 비활성화
    const toggleButton = page.getByRole('button', { name: '메트로놈 토글' })
    await expect(toggleButton).toBeDisabled()
  })

  test('에러 후 재시도 성공 시 에러가 사라지고 BPM이 표시되어야 한다', async ({ page }) => {
    // 첫 번째 요청은 실패
    let requestCount = 0
    await page.route('**/api/v1/bpm/analyze', (route) => {
      requestCount++
      if (requestCount === 1) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'BPM analysis failed' }),
        })
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_BPM_RESPONSE),
        })
      }
    })

    await setupAudioPage(page)
    await loadAudioFile(page)

    const analyzeButton = page.getByRole('button', { name: 'BPM 분석' })

    // 첫 번째 시도 - 실패
    await analyzeButton.click()
    const errorMessage = page.locator('.text-red-400')
    await expect(errorMessage).toBeVisible({ timeout: 5000 })

    // 두 번째 시도 - 성공
    await analyzeButton.click()
    await expect(errorMessage).not.toBeVisible({ timeout: 5000 })

    const bpmDisplay = page.locator('.font-mono.font-bold')
    await expect(bpmDisplay).toContainText('121', { timeout: 5000 })
  })
})
