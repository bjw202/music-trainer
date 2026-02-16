import { test, expect } from '@playwright/test'

test('Worker logs verification', async ({ page }) => {
  const logs: string[] = []
  
  page.on('console', msg => {
    logs.push(msg.text())
    console.log('Browser console:', msg.text())
  })
  
  // 페이지 로드
  await page.goto('http://localhost:5173')
  await page.waitForTimeout(1000)
  
  // 오디오 파일 로드 (테스트 파일 사용)
  const fileInput = page.locator('input[type="file"]')
  const testFile = 'tests/fixtures/test-audio.mp3'
  
  // 파일이 있는지 확인
  const fs = await import('fs')
  if (fs.existsSync(testFile)) {
    await fileInput.setInputFiles(testFile)
    await page.waitForTimeout(2000)
    
    // 속도 변경
    const speedSlider = page.getByTestId('speed-slider')
    await speedSlider.fill('1.5')
    await page.waitForTimeout(2000)
  }
  
  // Worker 관련 로그 확인
  const workerLogs = logs.filter(l => 
    l.includes('[Worker]') || 
    l.includes('[AudioEngine]') ||
    l.includes('Worker')
  )
  
  console.log('\n=== Worker-related logs ===')
  workerLogs.forEach(l => console.log(l))
  
  // 검증
  expect(workerLogs.some(l => l.includes('ready') || l.includes('Worker'))).toBeTruthy()
})
