# Reality-Grounded TDD: 미디어 프로젝트에서의 진짜 테스트 전략

## 서문: 4번의 프로젝트에서 배운 것

Guitar MP3 Trainer v2 프로젝트는 같은 패턴의 실패를 4번째 반복한 프로젝트이다.
매번 E2E 테스트는 "통과"했지만, 실제 기능은 동작하지 않았다.
AI 코딩 에이전트는 "테스트 통과"를 리포팅했지만, 사용자가 직접 써보면 아무것도 작동하지 않았다.

이 문서는 **왜 이런 일이 반복되는지**의 구조적 원인을 분석하고,
**미디어(음원, 그래픽, 비디오) 프로젝트**에서 AI 에이전트가 진짜 동작하는 코드를 만들기 위한
TDD 설계, 인스트럭션, 워크플로우를 정리한다.

---

## 1부: 왜 테스트가 통과했는데 기능이 안 되는가 (3가지 근본 패턴)

### 패턴 1: "팬텀 그린" (Phantom Green) - 그림자를 검증하는 테스트

**정의**: 테스트가 실제 동작이 아닌, 동작의 부산물(side effect의 side effect)만 검증하는 패턴.

**이번 프로젝트에서의 사례**:

```
[실제 동작 경로]
사용자 클릭 → usePlayback.play() → AudioEngine.play() → Web Audio API 재생
                                  → playerStore.play()  → isPlaying = true
                                                         → UI 업데이트

[테스트가 검증한 것]
✅ isPlaying = true? → 예
✅ 버튼이 Pause로 바뀌었나? → 예
✅ 시간 표시가 0:00이 아닌가? → 예

[테스트가 검증하지 않은 것]
❌ AudioEngine.play()가 실제로 호출되었나?
❌ Web Audio API의 BufferSourceNode.start()가 실행되었나?
❌ 시간이 "실제로 흐르고 있는가"? (스토어 값이 아닌 엔진의 currentTime)
```

**구조적 원인**: Zustand 스토어가 "진실의 원천(source of truth)"이 아니라 "UI의 거울"이었다.
AudioEngine이 진짜 상태를 가지고 있는데, 테스트는 거울(스토어)만 봤다.

**핵심 통찰**: 미디어 프로젝트에서 UI 상태와 미디어 엔진 상태는 **항상 분리**되어 있다.
DOM은 "Play 버튼이 Pause로 바뀌었다"까지만 알려줄 수 있다.
"소리가 실제로 나고 있다"는 DOM으로 검증할 수 없다.

---

### 패턴 2: "이중 상태 함정" (Dual State Trap) - Store와 Engine의 비동기적 괴리

**정의**: UI 상태(Store)와 실제 미디어 상태(Engine)가 독립적으로 업데이트되면서 불일치가 발생하는 패턴.

**이번 프로젝트의 결정적 사례 - useKeyboardShortcuts 버그**:

```typescript
// 버그가 있던 코드 (수정 전)
const handleSeekForward = useCallback(() => {
  const newTime = Math.min(duration, currentTime + 5)
  usePlayerStore.getState().setCurrentTime(newTime)  // Store만 업데이트
  // engine.seek(newTime) ← 이 호출이 빠져 있었다!
}, [currentTime, duration])
```

이 코드에서 키보드 →를 누르면:
- Store의 currentTime은 5초 앞으로 이동 → UI의 시간 표시가 변경됨 ✅
- AudioEngine의 재생 위치는 그대로 → 실제 소리는 원래 위치 ❌
- Waveform의 playhead도 Store를 읽으므로 이동 ✅ (하지만 가짜 위치)

**E2E 테스트가 이걸 왜 못 잡았나?**

```typescript
// 테스트 코드 (수정 전)
await page.keyboard.press('ArrowRight')
const timeAfter = await timeDisplay.textContent()
expect(timeAfter).toBeDefined()  // ← 항상 통과하는 무의미한 assertion
```

`toBeDefined()`는 `null`이 아닌 모든 값에 통과한다. 시간이 "변했는지"가 아니라 "존재하는지"만 확인한다.

**핵심 통찰**: 미디어 프로젝트에는 항상 최소 2개의 상태 시스템이 존재한다.
- **선언적 상태** (React/Zustand): UI가 읽는 값
- **명령형 상태** (AudioContext/Canvas/WebGL): 실제 미디어가 참조하는 값

이 두 상태의 **동기화 계약(sync contract)**을 테스트하지 않으면, 테스트는 거울만 보는 것이다.

---

### 패턴 3: "모킹 지평선" (Mock Horizon) - 모킹할수록 현실에서 멀어진다

**정의**: 단위 테스트에서 외부 의존성을 모킹할수록, 테스트와 실제 동작 사이의 간극이 커지는 패턴.

**이번 프로젝트의 사례 - AudioEngine.test.ts 특성화 테스트**:

```typescript
// tests/unit/core/AudioEngine.test.ts:261-276
it('should maintain playback state when seeking while playing', async () => {
  audioEngine.play()
  audioEngine.seek(5.0)

  // seek()가 stopSource()를 호출하고 play()를 다시 호출하지만,
  // play()의 "if (this.isPlaying) return" 가드에 막힌다.
  // 이것을 "알려진 구현 이슈"로 문서화하고 통과시킴!
  expect(mockBufferSource.start).toHaveBeenCalledTimes(1)  // 버그를 정상으로 간주
})
```

이 테스트의 문제:
1. **모킹이 실제 AudioContext의 행동을 반영하지 않음**: `mockBufferSource.stop()`이 호출되어도 `isPlaying` 플래그에 영향을 주지 않음
2. **버그를 특성화 테스트로 고정**: "현재 이렇게 동작한다"를 "이렇게 동작해야 한다"로 잘못 기술
3. **모킹의 한계를 인식하지 못함**: Web Audio API의 실제 생명주기와 모킹 객체의 생명주기가 다름

**핵심 통찰**: 모킹은 "외부 세계를 단순화"하는 것이지 "외부 세계를 제거"하는 것이 아니다.
미디어 엔진의 상태 기계(state machine)가 올바른지는 모킹으로 증명할 수 없다.

---

## 2부: 이번 프로젝트에서 실제로 버그를 잡은 방법 (회고)

### 버그 발견 과정

| 단계 | 행위 | 결과 |
|------|------|------|
| 1 | `npm run dev`로 앱 실행 | 화면은 정상적으로 나옴 |
| 2 | MP3 파일 드롭 | 파형이 표시됨 (OK) |
| 3 | Play 버튼 클릭 | 소리는 나지만 파형 playhead가 안 움직임 (Bug!) |
| 4 | 파형 클릭 (seek) | 클릭 후 소리가 멈춤 (Bug!) |
| 5 | 키보드 → 키 | 시간 표시는 바뀌지만 소리 위치는 안 바뀜 (Bug!) |
| 6 | A-B 루프 설정 | 루프가 작동하지 않음 (Bug!) |
| 7 | E2E 테스트 실행 | **모두 통과** (!) |

### 핵심: "눈으로 확인한 것"과 "테스트가 확인한 것"의 차이

```
[사람이 확인한 것]                  [테스트가 확인한 것]
─────────────────                  ─────────────────
소리가 나는가?                      Play 버튼이 Pause로 바뀌었는가?
파형이 움직이는가?                   시간 텍스트가 존재하는가?
클릭한 위치에서 재생되는가?           시간 텍스트가 변했는가?
A-B 구간이 반복되는가?              루프 버튼의 aria-pressed가 true인가?
```

사람은 **효과(effect)**를 관찰한다. 테스트는 **상태(state)**를 확인한다.
미디어 프로젝트에서 이 간극이 치명적이다.

### 수정 과정에서의 통찰

**Bug 1 해결 (AudioEngine.seek)**: 2줄 추가로 해결

```typescript
// 추가된 2줄
this.isPlaying = false      // play()의 가드를 통과하기 위해
this.stopTimeUpdates()      // 이전 RAF 루프 중지
```

이 버그를 E2E로 잡으려면 어떤 assertion이 필요했을까?

```typescript
// 이런 테스트가 있었다면 버그를 잡았을 것이다:
test('seek 후 시간이 계속 흐르는지 확인', async ({ page }) => {
  await loadAudioFile(page)
  const playButton = page.getByRole('button', { name: /play/i })
  await playButton.click()
  await page.waitForTimeout(500)

  // 파형 클릭으로 seek
  const waveform = page.locator('[data-testid="waveform-container"]')
  await waveform.click({ position: { x: 200, y: 50 } })

  // ★ 핵심: seek 후에도 시간이 "계속 흐르는지" 확인
  const timeAfterSeek = await page.getByTestId('time-display').first().textContent()
  await page.waitForTimeout(1000)
  const timeLater = await page.getByTestId('time-display').first().textContent()

  // 시간이 변하지 않으면 → 재생이 멈춘 것 → 버그!
  expect(timeLater).not.toBe(timeAfterSeek)
})
```

**Bug 2 해결 (useKeyboardShortcuts)**: playback 파라미터 추가

```typescript
// 수정 전: 스토어만 업데이트
usePlayerStore.getState().setCurrentTime(newTime)

// 수정 후: 엔진도 함께 업데이트
playback.seek(newTime)  // → engine.seek() + store.setCurrentTime()
```

이 버그를 E2E로 잡으려면?

```typescript
test('키보드 seek 후 재생 시 올바른 위치에서 시작하는지', async ({ page }) => {
  await loadAudioFile(page)

  // 10초 지점으로 키보드 seek (→ 키 2번)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')

  // 시간 확인
  const seekedTime = await page.getByTestId('time-display').first().textContent()

  // Play 시작
  await page.getByRole('button', { name: /play/i }).click()
  await page.waitForTimeout(500)

  // ★ 핵심: Play 시작 후 시간이 seek한 위치 "근처"에서 시작하는지
  const playingTime = await page.getByTestId('time-display').first().textContent()

  // Store만 업데이트된 경우: 0:00에서 재생 시작 → 이 assertion 실패
  // Engine도 업데이트된 경우: 0:10 근처에서 재생 → assertion 통과
  const seekedSeconds = parseTime(seekedTime)
  const playingSeconds = parseTime(playingTime)
  expect(playingSeconds).toBeGreaterThanOrEqual(seekedSeconds - 1)
})
```

---

## 3부: Reality-Grounded TDD 설계 원칙

### 원칙 1: "관찰 가능한 효과(Observable Effect)" 테스트

**정의**: 모든 테스트는 "사용자가 감각으로 인지할 수 있는 변화"를 assertion해야 한다.

| 도메인 | 관찰 가능한 효과 | 관찰 불가능한 상태 |
|--------|-----------------|-------------------|
| 오디오 | 시간이 흐른다, 시간이 점프한다 | isPlaying 플래그 |
| 그래픽 | 캔버스에 무언가 그려진다, 위치가 변한다 | 내부 렌더링 상태 |
| 비디오 | 프레임이 바뀐다, 재생 위치가 변한다 | 디코더 상태 |
| 애니메이션 | 요소의 위치/크기가 변한다 | requestAnimationFrame ID |

**규칙**: E2E 테스트의 expect()는 반드시 "관찰 가능한 효과"를 대상으로 해야 한다.

```typescript
// ❌ 관찰 불가능한 상태 테스트 (Phantom Green)
expect(pauseButton).toBeVisible()  // "버튼 상태"이지 "재생 상태"가 아님

// ✅ 관찰 가능한 효과 테스트
const t1 = await getTimeSeconds(page)
await page.waitForTimeout(500)
const t2 = await getTimeSeconds(page)
expect(t2).toBeGreaterThan(t1)  // "시간이 실제로 흐르고 있다"
```

---

### 원칙 2: "시간적 검증(Temporal Verification)" 패턴

**정의**: 미디어 프로젝트에서 동작의 "지속성"을 검증하기 위해 시간 차이를 이용한다.

```
[시간적 검증 3단계]
1. 동작 전 상태 캡처 (Before snapshot)
2. 동작 실행 + 대기 (Action + Wait)
3. 동작 후 상태 캡처 + 비교 (After snapshot + Compare)
```

**핵심**: `waitForTimeout` 후에도 상태가 "계속 변하고 있는지"를 확인하는 것이 미디어 테스트의 본질이다.

```typescript
// 재생 지속성 검증 (Temporal Verification)
async function assertPlaybackContinuing(page: Page) {
  const t1 = await getDisplayTime(page)
  await page.waitForTimeout(500)
  const t2 = await getDisplayTime(page)
  await page.waitForTimeout(500)
  const t3 = await getDisplayTime(page)

  // 3개 시점 모두 다른 값이어야 함 → 시간이 "계속" 흐르고 있음
  expect(t2).toBeGreaterThan(t1)
  expect(t3).toBeGreaterThan(t2)
}

// Seek 후 재생 지속성 검증
async function assertSeekThenContinuing(page: Page, seekAction: () => Promise<void>) {
  await seekAction()
  const tAfterSeek = await getDisplayTime(page)
  await page.waitForTimeout(500)
  const tLater = await getDisplayTime(page)

  // Seek 후에도 시간이 계속 증가해야 함
  expect(tLater).toBeGreaterThan(tAfterSeek)
}
```

---

### 원칙 3: "동기화 계약(Sync Contract)" 테스트

**정의**: Store와 Engine이 항상 일치하는지를 검증하는 테스트.

```typescript
// page.evaluate()로 실제 엔진 상태를 브라우저에서 직접 읽는다
async function getEngineState(page: Page) {
  return await page.evaluate(() => {
    // window에 노출된 디버그 인터페이스를 통해 엔진 상태 확인
    const debug = (window as any).__AUDIO_DEBUG__
    if (!debug) return null
    return {
      engineTime: debug.getCurrentTime(),
      engineIsPlaying: debug.getIsPlaying(),
      storeTime: debug.getStoreTime(),
      storeIsPlaying: debug.getStoreIsPlaying(),
    }
  })
}

// 동기화 계약 검증
async function assertSyncContract(page: Page) {
  const state = await getEngineState(page)
  if (!state) return // 디버그 인터페이스 없으면 스킵

  // Engine과 Store의 시간 차이가 0.5초 이내
  expect(Math.abs(state.engineTime - state.storeTime)).toBeLessThan(0.5)
  // Engine과 Store의 재생 상태가 일치
  expect(state.engineIsPlaying).toBe(state.storeIsPlaying)
}
```

이를 위해 개발 모드에서 `window.__AUDIO_DEBUG__`를 노출하는 것을 권장한다:

```typescript
// src/core/AudioEngine.ts에 디버그 인터페이스 추가 (개발 모드 전용)
if (import.meta.env.DEV) {
  (window as any).__AUDIO_DEBUG__ = {
    getCurrentTime: () => engine.getCurrentTime(),
    getIsPlaying: () => engine.getIsPlaying(),
    getStoreTime: () => usePlayerStore.getState().currentTime,
    getStoreIsPlaying: () => usePlayerStore.getState().isPlaying,
  }
}
```

---

### 원칙 4: "역방향 검증(Reverse Verification)" 패턴

**정의**: 동작을 실행한 뒤, 그 동작을 되돌렸을 때 원래 상태로 복귀하는지 확인한다.

```typescript
// Play → Pause → Resume 역방향 검증
test('play-pause-resume cycle maintains time continuity', async ({ page }) => {
  await loadAudioFile(page)

  // Play
  await page.getByRole('button', { name: /play/i }).click()
  await page.waitForTimeout(1000)

  // Pause (시간 정지)
  const pauseTime = await getDisplayTime(page)
  await page.getByRole('button', { name: /pause/i }).click()
  await page.waitForTimeout(500)
  const afterPauseTime = await getDisplayTime(page)

  // ★ 핵심: Pause 후 시간이 정지해야 함
  expect(afterPauseTime).toBe(pauseTime)

  // Resume (재생 재개)
  await page.getByRole('button', { name: /play/i }).click()
  await page.waitForTimeout(500)
  const afterResumeTime = await getDisplayTime(page)

  // ★ 핵심: Resume 후 시간이 Pause한 지점에서 계속 흘러야 함
  expect(afterResumeTime).toBeGreaterThan(pauseTime)
})
```

---

## 4부: MoAI 워크플로우 인스트럭션

### 4-1. 미디어 프로젝트용 TDD 사이클 수정안

기존 TDD 사이클 (RED-GREEN-REFACTOR)을 미디어 프로젝트에 맞게 확장한다:

```
[기존 TDD]
RED → GREEN → REFACTOR

[미디어 프로젝트 Reality-Grounded TDD]
RED → GREEN → VERIFY → REFACTOR

  RED:    실패하는 테스트 작성
  GREEN:  테스트를 통과시키는 최소 코드 작성
  VERIFY: ★ 새로 추가된 단계
          - "시간적 검증"으로 동작의 지속성 확인
          - "동기화 계약"으로 Store-Engine 일치 확인
          - 필요시 수동 검증 체크포인트
  REFACTOR: 코드 정리
```

### 4-2. AI 에이전트 인스트럭션 (E2E 테스트 작성 규칙)

```yaml
# .moai/config/sections/testing-media.yaml (제안)
media_testing:
  # 필수 assertion 규칙
  assertion_rules:
    # toBeDefined() 사용 금지
    ban_toBeDefined: true

    # 모든 상태 변경 액션에 Before/After 비교 필수
    require_before_after: true

    # 시간 관련 assertion에 시간적 검증 패턴 사용 필수
    require_temporal_verification: true

    # 미디어 재생 테스트에 지속성 검증 필수
    require_continuity_check: true

  # 필수 테스트 패턴
  required_patterns:
    - name: "playback_continuity"
      description: "Play 후 시간이 2개 이상의 시점에서 증가하는지 확인"
      applies_to: ["play", "resume"]

    - name: "seek_then_continue"
      description: "Seek 후 재생이 계속되는지 확인"
      applies_to: ["seek", "waveform_click", "keyboard_seek"]

    - name: "state_sync"
      description: "Store와 Engine의 상태 일치 확인"
      applies_to: ["all_media_actions"]

    - name: "reverse_verification"
      description: "Play-Pause-Resume 역방향 검증"
      applies_to: ["play_pause_toggle"]

  # 안티패턴 감지
  anti_patterns:
    - pattern: "toBeDefined()"
      message: "toBeDefined()는 미디어 테스트에서 금지. 구체적인 값 비교를 사용하세요."

    - pattern: "toBeVisible() 단독 사용"
      message: "UI 상태만 확인하면 Phantom Green 위험. 미디어 효과도 함께 확인하세요."

    - pattern: "characterization test for known bug"
      message: "버그를 특성화하지 마세요. it.skip 또는 it.todo를 사용하세요."
```

### 4-3. E2E 테스트 헬퍼 함수 설계

```typescript
// tests/e2e/helpers/media-assertions.ts (제안)

/**
 * 시간 표시 텍스트를 초 단위로 파싱
 * "1:23" → 83, "0:05" → 5
 */
export function parseTimeDisplay(text: string | null): number {
  if (!text) return 0
  const match = text.match(/(\d+):(\d{2})/)
  if (!match) return 0
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

/**
 * 현재 시간 표시값을 초 단위로 읽기
 */
export async function getDisplayTime(page: Page): Promise<number> {
  const text = await page.getByTestId('time-display').first().textContent()
  return parseTimeDisplay(text)
}

/**
 * 재생 지속성 검증 (3-point temporal verification)
 * 3개 시점에서 시간이 모두 증가하는지 확인
 */
export async function assertPlaybackContinuing(
  page: Page,
  interval: number = 500
): Promise<void> {
  const t1 = await getDisplayTime(page)
  await page.waitForTimeout(interval)
  const t2 = await getDisplayTime(page)
  await page.waitForTimeout(interval)
  const t3 = await getDisplayTime(page)

  expect(t2).toBeGreaterThan(t1)
  expect(t3).toBeGreaterThan(t2)
}

/**
 * Seek 후 재생 지속성 검증
 * Seek 후 시간이 계속 흐르는지 확인
 */
export async function assertSeekAndContinue(
  page: Page,
  seekAction: () => Promise<void>
): Promise<void> {
  await seekAction()
  const tAfterSeek = await getDisplayTime(page)
  await page.waitForTimeout(500)
  const tLater = await getDisplayTime(page)

  expect(tLater).toBeGreaterThan(tAfterSeek)
}

/**
 * Pause 후 시간 정지 검증
 * Pause 후 시간이 멈추는지 확인
 */
export async function assertPauseFreezes(page: Page): Promise<void> {
  const tAtPause = await getDisplayTime(page)
  await page.waitForTimeout(500)
  const tAfter = await getDisplayTime(page)

  expect(tAfter).toBe(tAtPause)
}

/**
 * Before/After 상태 비교 래퍼
 */
export async function withBeforeAfter<T>(
  page: Page,
  getState: (page: Page) => Promise<T>,
  action: () => Promise<void>,
  verify: (before: T, after: T) => void
): Promise<void> {
  const before = await getState(page)
  await action()
  const after = await getState(page)
  verify(before, after)
}
```

### 4-4. MoAI 에이전트에 대한 인스트럭션 (미디어 프로젝트 전용)

```markdown
## 미디어 프로젝트 E2E 테스트 작성 규칙 (에이전트용)

### 필수 검증 체크리스트

모든 E2E 테스트는 다음 중 하나 이상의 "관찰 가능한 효과"를 assertion해야 한다:

1. **시간 변화**: `expect(t2).toBeGreaterThan(t1)` - 시간이 실제로 흐르는지
2. **시간 정지**: `expect(t2).toBe(t1)` - Pause 후 시간이 정지하는지
3. **위치 점프**: `expect(Math.abs(actual - expected)).toBeLessThan(tolerance)` - Seek이 실제로 동작하는지
4. **값 변화**: `expect(after).not.toBe(before)` - 동작 전후 값이 바뀌는지
5. **지속성**: 3개 시점 비교로 동작이 지속되는지

### 금지 패턴

1. `toBeDefined()` 단독 사용 금지
2. UI 상태만으로 미디어 동작 검증 금지 (버튼 상태 ≠ 재생 상태)
3. 버그를 특성화 테스트로 고정하는 행위 금지
4. `waitForTimeout` 없이 미디어 상태 변화 assertion 금지
5. 시간 표시에 대한 정확한 값 비교 대신 범위 비교 사용 (± 허용 오차)

### 필수 테스트 시나리오

미디어 재생 기능이 있는 프로젝트에서는 반드시 다음 테스트를 포함해야 한다:

1. **Play 지속성**: Play 후 시간이 3개 시점에서 모두 증가
2. **Seek 후 재생 지속**: Seek 후에도 시간이 계속 증가
3. **Pause 정지**: Pause 후 시간이 정지
4. **Stop 리셋**: Stop 후 시간이 0으로 복귀
5. **Play-Pause-Resume**: 역방향 검증
6. **루프 반복**: A-B 구간 도달 시 A로 복귀 (시간 감소 확인)
```

---

## 5부: 워크플로우 통합 방안

### 5-1. MoAI /moai run 워크플로우에 VERIFY 단계 추가

```
기존:  ANALYZE → PRESERVE → IMPROVE
제안:  ANALYZE → PRESERVE → IMPROVE → VERIFY(미디어)

VERIFY 단계:
1. E2E 테스트 실행 (Playwright)
2. 시간적 검증 패턴 적용 여부 확인
3. 동기화 계약 테스트 존재 여부 확인
4. 안티패턴 스캔 (toBeDefined, 단독 toBeVisible)
5. 수동 테스트 체크리스트 생성
```

### 5-2. /moai fix 워크플로우 보완

미디어 버그 수정 시:

```
1. 증상 재현 테스트 작성 (MUST: 시간적 검증 포함)
2. 증상 재현 테스트 실패 확인 (RED)
3. 코드 수정 (GREEN)
4. 시간적 검증 통과 확인 (VERIFY)
5. 기존 E2E 테스트 전체 실행
6. 관련 단위 테스트 업데이트 (특성화 테스트 수정)
```

### 5-3. 안티패턴 자동 감지 스크립트

```bash
#!/bin/bash
# scripts/check-media-test-quality.sh

echo "=== 미디어 테스트 품질 검사 ==="

# 1. toBeDefined() 사용 검사
if grep -rn "toBeDefined()" tests/e2e/; then
  echo "❌ ERROR: toBeDefined() found in E2E tests"
  exit 1
fi

# 2. .first()/.last() 없는 getByTestId 검사
if grep -rn "getByTestId('time-display')" tests/e2e/ | grep -v "\.first()\|\.last()"; then
  echo "❌ ERROR: getByTestId('time-display') without .first()/.last()"
  exit 1
fi

# 3. 시간적 검증 패턴 존재 확인
TEMPORAL_COUNT=$(grep -rn "waitForTimeout" tests/e2e/ | grep -c "getDisplayTime\|textContent")
if [ "$TEMPORAL_COUNT" -lt 3 ]; then
  echo "⚠️ WARNING: Few temporal verification patterns found ($TEMPORAL_COUNT)"
fi

echo "✅ 미디어 테스트 품질 검사 통과"
```

---

## 요약: 미디어 프로젝트 TDD의 3가지 황금률

### 1. 그림자가 아닌 실체를 테스트하라 (Test Substance, Not Shadow)

UI 상태(Store)가 아닌 미디어 효과(시간 변화, 위치 변화)를 assertion한다.
버튼이 Pause로 바뀌었다고 소리가 나는 것이 아니다.

### 2. 순간이 아닌 흐름을 테스트하라 (Test Flow, Not Snapshot)

한 시점의 값이 아닌, 여러 시점의 값 변화를 비교한다.
시간이 "5초"인 것이 아니라, 시간이 "계속 흐르고 있는 것"을 확인한다.

### 3. 거울이 아닌 실물을 테스트하라 (Test Reality, Not Reflection)

Store는 Engine의 거울이다. 거울이 깨져도 실물은 멀쩡할 수 있고,
거울이 멀쩡해도 실물이 깨져 있을 수 있다.
가능하면 Engine의 실제 상태를 직접 확인하라.

---

**문서 버전**: 1.0.0
**작성일**: 2026-02-14
**프로젝트**: Guitar MP3 Trainer v2
**기반 경험**: 4개 프로젝트의 반복된 E2E 테스트 실패 패턴 분석
