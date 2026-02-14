# E2E 테스트 전략 문서: 기타 MP3 트레이너 v2

## 1. 개요 (Overview)

### 목적

이 문서는 Guitar MP3 Trainer v2 프로젝트에서 발견된 실제 버그들로부터의 교훈을 기록합니다. E2E 테스트가 모두 통과했음에도 불구하고 실제 기능이 동작하지 않는 경우들을 분석하고, 이러한 테스트 갭을 방지하기 위한 종합적인 테스트 전략을 제시합니다.

### 프로젝트 기술 스택

- **Frontend**: React + TypeScript + Vite
- **Audio Engine**: Web Audio API
- **Waveform Visualization**: WaveSurfer.js
- **State Management**: Zustand
- **Testing**: Vitest (Unit), Playwright (E2E)
- **테스트 실행**: `npx playwright test`

---

## 2. 테스트 갭 분석 (Test Gap Analysis)

실제로 발견된 5가지 버그와 각각의 테스트 갭을 분석합니다.

### Gap 1: Store vs Engine 통합 검증 부재

**버그 설명**: `AudioEngine.seek(5.0)` 호출 시 예기치 않게 오작동

**근본 원인**:
- `seek()` 메서드가 `stopSource()`를 호출하고 `play()`를 다시 호출하려고 함
- `stopSource()`는 `isPlaying` 플래그를 초기화하지 않았음
- `play()` 메서드에 `if (this.isPlaying) return` 가드 조건이 있어서 조기 반환
- 결과적으로 오디오 엔진의 재생이 재개되지 않음

**코드 예제** (`src/core/AudioEngine.ts` 라인 100-130):

```
AudioEngine.seek() 실행 시:
1. stopSource() 호출 → source.stop() 실행
2. isPlaying 플래그: true 상태 유지 (리셋 안 함)
3. play() 호출 → "if (this.isPlaying) return" 조건으로 즉시 반환
4. 오디오 재생 중단, 시간만 변경됨
```

**테스트 갭**:
- E2E 테스트는 UI의 시간 표시 텍스트만 검증 (예: "2:35" → "5:00" 변경 확인)
- 실제 AudioEngine의 내부 상태는 검증하지 않음
- 시간 표시만 변경되고 오디오는 재생되지 않는 버그를 감지 못함

**해결책**:
통합 테스트에서 UI 변경뿐만 아니라 Engine의 `isPlaying` 상태를 확인해야 함.

---

### Gap 2: 무의미한 Assertion (toBeDefined 안티패턴)

**버그 설명**: `useKeyboardShortcuts` 훅이 Zustand 스토어만 업데이트하고 AudioEngine을 호출하지 않음

**근본 원인**:
- 키보드 핸들러가 `usePlayerStore.getState().setCurrentTime(time)` 호출 (스토어만 업데이트)
- `engine.seek(time)` 호출 누락
- UI는 스토어에서 시간 값을 읽으므로 텍스트 표시는 올바르게 변경됨

**E2E 테스트 문제**:

```javascript
// 나쁜 E2E 테스트 (버그를 놓침)
const timeDisplay = await page.getByTestId('time-display');
expect(timeDisplay).toBeDefined();  // 항상 통과
expect(await timeDisplay.textContent()).toBe('5:00');  // 텍스트만 확인
```

**테스트 갭**:
- `toBeDefined()`는 의미 있는 검증이 아님
- 시간 텍스트만 변경되었는지 확인하고, 실제 오디오 상태는 무시
- 키보드 단축키가 실제로 오디오를 조작하는지 검증 안 함

**해결책**:
Before/After 값 비교 및 상태 변화 검증 필수.

---

### Gap 3: Selector 취약성

**버그 설명**: Waveform 플레이헤드가 동기화되지 않음

**근본 원인**:
- `useWaveform` 훅이 `setCurrentTime` 메서드 노출
- `Player.tsx`에서 이 메서드를 호출하지 않음
- Waveform은 WaveSurfer 인스턴스를 통해서만 재생 상태를 알 수 있음

**E2E 테스트 문제**:

```javascript
// 나쁜 예: 하드코딩된 텍스트 셀렉터
const dropZone = await page.getByText('Drag & Drop Audio File');
// 실제 텍스트: 'Drop your audio file here' → 셀렉터 매칭 실패

// 나쁜 예: 다중 요소 처리 누락
const timeDisplay = await page.getByTestId('time-display');
// 현재 시간(current)과 전체 시간(duration)이 모두 이 ID 사용
await expect(timeDisplay).toContainText('5:00');
// 어느 요소인지 불명확, .first() 또는 .last() 필수
```

**테스트 갭**:
- Waveform 커서 위치를 검증하는 E2E 테스트 없음
- 시각적 회귀 테스트 미실시
- 하드코딩된 텍스트 셀렉터는 UI 변경 시 깨짐

**해결책**:
`getByRole` 사용 우선, `getByTestId` 시 `.first()` / `.last()` 반드시 사용.

---

### Gap 4: Waveform minPxPerSec 설정 오류

**버그 설명**: Waveform 표시 영역 밖으로 플레이헤드 이동

**근본 원인**:
- `minPxPerSec: 100` 설정 (너무 높음)
- 3분 길이 곡: 180초 × 100px/sec = 18,000px 너비 필요
- 화면에 표시되는 영역: ~400px (약 4초만 보임)
- 재생 중 플레이헤드는 화면 바깥으로 이동

**테스트 갭**:
- UI 시간 텍스트 검증만 수행
- Waveform 컨테이너에 곡이 맞는지 검증 없음
- 시각적 회귀 테스트 부재

**해결책**:
시각적 회귀 테스트 (Playwright screenshot) 추가.

---

### Gap 5: Unit Test 특성화 테스트 안티패턴

**버그 설명**: 버그를 "알려진 문제"로 문서화하고 버그 있는 동작을 정상으로 주장

**예시** (`tests/unit/core/AudioEngine.test.ts` 라인 261-276):

```javascript
it('seek()는 재생 중 플레이헤드를 유지해야 함', async () => {
  audioEngine.play();
  audioEngine.seek(5.0);

  // BUG: seek() 호출 후 오디오가 재개되지 않음
  // 근본 원인: stopSource()가 isPlaying을 리셋하지 않음
  expect(mockBufferSource.start).toHaveBeenCalledTimes(1);
  // 테스트가 "통과"하지만 버그를 문서화만 하고 고치지 않음
});
```

**테스트 갭**:
- 버그를 단순히 특성화하고 정상 동작으로 주장
- `it.skip` 또는 `it.todo`로 표시하지 않음
- 버그 고정 후에도 테스트를 업데이트하지 않음

**해결책**:
버그 고정 → 테스트 업데이트를 동시에 수행.

---

## 3. 테스트 피라미드 재설계 (Testing Pyramid Redesign)

### 계층별 테스트 전략

| 계층 | 도구 | 커버리지 목표 | 테스트 대상 |
|------|------|------------|-----------|
| **Unit** | Vitest | 85% | 순수 로직: AudioEngine 메서드, 스토어 리듀서, 유틸 함수 |
| **Integration** | Vitest + JSDOM | 핵심 흐름 | 훅 통합: usePlayback → AudioEngine, useKeyboardShortcuts → 재생 |
| **E2E** | Playwright | 핵심 경로 | 사용자 정의 흐름: 파일 드롭 → 재생 → 탐색 → 루프 |
| **Visual** | Playwright | 회귀 방지 | 레이아웃, Waveform 렌더링, 컴포넌트 상태 |

### 각 계층의 책임

**Unit Layer** (Vitest):
- 순수 함수와 메서드 단위 테스트
- 외부 의존성 모킹
- 예: `AudioEngine.seek()`가 올바르게 시간을 업데이트하는지 확인

**Integration Layer** (Vitest + JSDOM):
- 훅과 스토어가 함께 작동하는지 확인
- AudioEngine을 모킹하되 실제 훅 로직 검증
- 예: `usePlayback` 훅이 AudioEngine과 Zustand 스토어 둘 다를 업데이트하는지 확인

**E2E Layer** (Playwright):
- 사용자 관점의 전체 흐름 검증
- 의미 있는 Assertion만 사용
- 예: 재생 버튼 클릭 → 오디오 시간 증가 → UI 업데이트

**Visual Layer** (Playwright Screenshots):
- 레이아웃과 스타일 회귀 방지
- Waveform 렌더링 상태 검증
- 예: Waveform이 컨테이너 내에 정상 렌더링되는지 확인

---

## 4. E2E Assertion 가이드라인 (E2E Assertion Guidelines)

### 5가지 핵심 규칙

#### Rule 1: NEVER use toBeDefined() for meaningful values

**나쁜 예**:
```javascript
const timeDisplay = await page.getByTestId('time-display');
expect(timeDisplay).toBeDefined();  // 항상 통과, 검증 없음
```

**올바른 예**:
```javascript
const timeDisplay = await page.getByTestId('time-display').first();
const beforeText = await timeDisplay.textContent();
// 클릭, 상호작용 수행
const afterText = await timeDisplay.textContent();
expect(afterText).not.toBe(beforeText);  // 변경 확인
```

---

#### Rule 2: ALWAYS compare before/after values for state-changing actions

**나쁜 예**:
```javascript
await page.getByRole('button', { name: 'Seek to 5s' }).click();
expect(await page.getByTestId('time-display').textContent()).toBe('0:05');
// 원래 어떤 값이었는지 모름
```

**올바른 예**:
```javascript
const timeDisplay = page.getByTestId('time-display').first();
const beforeTime = await timeDisplay.textContent();
expect(beforeTime).toBe('0:00');

await page.getByRole('button', { name: 'Seek to 5s' }).click();

const afterTime = await timeDisplay.textContent();
expect(afterTime).toBe('0:05');
expect(afterTime).not.toBe(beforeTime);
```

---

#### Rule 3: ALWAYS use directional assertions for time values after seek

**나쁜 예**:
```javascript
await seek(10);
const time = parseTimeString(await page.getByTestId('time-display').textContent());
expect(time).toBeDefined();  // 아무것도 검증 안 함
```

**올바른 예**:
```javascript
const beforeTime = parseTimeString(await page.getByTestId('time-display').first().textContent());
await seek(10);
const afterTime = parseTimeString(await page.getByTestId('time-display').first().textContent());

expect(afterTime).toBeGreaterThan(beforeTime);
expect(Math.abs(afterTime - 10)).toBeLessThan(0.5);  // 허용 오차
```

---

#### Rule 4: ALWAYS use .first() or .last() when getByTestId may return multiple elements

**나쁜 예**:
```javascript
// 현재 시간: data-testid="time-display"
// 전체 시간: data-testid="time-display"
// 두 요소가 매칭됨
const timeDisplay = await page.getByTestId('time-display');
expect(await timeDisplay.textContent()).toContainText('0:05');
// 어느 요소인지 불명확
```

**올바른 예**:
```javascript
const currentTime = await page.getByTestId('time-display').first();
const totalTime = await page.getByTestId('time-display').last();

// 현재 시간 확인
expect(await currentTime.textContent()).toBe('0:05');

// 전체 시간 확인
expect(await totalTime.textContent()).toBe('3:45');
```

---

#### Rule 5: ALWAYS verify that time value actually changed

**나쁜 예**:
```javascript
await page.getByRole('button', { name: 'Play' }).click();
const time = await page.getByTestId('time-display').first().textContent();
expect(time).not.toBe('0:00');  // 단순히 0이 아니기만 하면 통과
```

**올바른 예**:
```javascript
const beforePlay = await page.getByTestId('time-display').first().textContent();
await page.getByRole('button', { name: 'Play' }).click();
await page.waitForTimeout(100);  // 재생 시간 주기

const afterPlay = await page.getByTestId('time-display').first().textContent();
const beforeSeconds = parseTimeString(beforePlay);
const afterSeconds = parseTimeString(afterPlay);

expect(afterSeconds).toBeGreaterThan(beforeSeconds);
expect(afterSeconds - beforeSeconds).toBeGreaterThan(0.05);  // 최소 변화량
```

---

## 5. Selector 전략 (Selector Strategy)

### Selector 우선순위

1. **`getByRole`** (최우선, 가장 탄력적):
   ```javascript
   await page.getByRole('button', { name: 'Play' }).click();
   await page.getByRole('slider', { name: 'Volume' }).evaluate(el => el.value = 0.5);
   ```

2. **`getByTestId`** (여러 요소 존재 시 `.first()` 또는 `.last()` 필수):
   ```javascript
   const currentTime = await page.getByTestId('time-display').first();
   const totalTime = await page.getByTestId('time-display').last();
   ```

3. **`getByText`** (정규표현식만 사용, 정확한 문자열 금지):
   ```javascript
   // 나쁜 예
   await page.getByText('Drop your audio file here').click();  // UI 변경 시 깨짐

   // 올바른 예
   await page.getByText(/drop.*audio.*file/i).click();  // 유연함
   ```

4. **CSS 클래스 셀렉터** (마지막 선택지):
   ```javascript
   // 피해야 함
   await page.locator('.waveform-container').click();
   ```

### 텍스트 콘텐츠 기반 테스트 규칙

**DragDrop Zone**:
```javascript
// 나쁜 예: 하드코딩된 텍스트
await page.getByText('Drag & Drop Audio File');

// 올바른 예: data-testid 사용
await page.getByTestId('drag-drop-zone');

// 또는 역할 사용
await page.getByRole('region', { name: /upload/i });
```

**TimeDisplay**:
```javascript
// 항상 .first() 또는 .last() 명시
const currentTime = page.getByTestId('time-display').first();
const duration = page.getByTestId('time-display').last();
```

---

## 6. 통합(Hook) 테스트 레이어 추가 방안

### 새로운 통합 테스트 파일 구조

**필요한 테스트 파일**:

1. **`tests/integration/usePlayback.test.ts`**
   - 목적: Play/Pause/Seek 호출 시 AudioEngine과 Zustand 스토어 모두 업데이트되는지 확인
   - 방식: AudioEngine을 모킹하되 실제 훅 로직 실행
   - 예시:
     ```typescript
     describe('usePlayback Hook Integration', () => {
       it('play() should update both AudioEngine and Zustand store', () => {
         const { result } = renderHook(() => usePlayback());

         act(() => {
           result.current.play();
         });

         expect(mockAudioEngine.play).toHaveBeenCalled();
         expect(result.current.isPlaying).toBe(true);
       });
     });
     ```

2. **`tests/integration/useKeyboardShortcuts.test.ts`**
   - 목적: 키보드 핸들러가 스토어뿐만 아니라 실제 재생을 호출하는지 확인
   - 방식: 키 이벤트 트리거 → AudioEngine 호출 검증
   - 예시:
     ```typescript
     describe('useKeyboardShortcuts Integration', () => {
       it('spacebar should call AudioEngine.play(), not just store', () => {
         renderHook(() => useKeyboardShortcuts());

         fireEvent.keyDown(document, { code: 'Space' });

         expect(mockAudioEngine.play).toHaveBeenCalled();
         expect(usePlayerStore.getState().isPlaying).toBe(true);
       });
     });
     ```

3. **`tests/integration/useWaveform.test.ts`**
   - 목적: setCurrentTime 호출이 WaveSurfer 인스턴스를 업데이트하는지 확인
   - 방식: WaveSurfer 모킹, 훅 내 메서드 호출 검증
   - 예시:
     ```typescript
     describe('useWaveform Integration', () => {
       it('setCurrentTime should update WaveSurfer instance', async () => {
         const { result } = renderHook(() => useWaveform());

         act(() => {
           result.current.setCurrentTime(5.0);
         });

         expect(mockWaveSurfer.seekTo).toHaveBeenCalledWith(5.0);
       });
     });
     ```

### 테스트 접근 방식

```typescript
// Vitest + JSDOM 조합
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayback } from '@/hooks/usePlayback';

// AudioEngine을 부분 모킹 (실제 로직은 유지, 외부 호출은 모킹)
vi.mock('@/core/AudioEngine', () => ({
  AudioEngine: vi.fn().mockImplementation(() => ({
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    // ... 기타 메서드
  }))
}));

describe('usePlayback Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('훅이 호출되면 AudioEngine과 스토어 모두 업데이트', () => {
    const { result } = renderHook(() => usePlayback());

    act(() => {
      result.current.play();
    });

    // 두 가지 모두 확인
    expect(mockAudioEngine.play).toHaveBeenCalled();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });
});
```

---

## 7. 단위 테스트 안티패턴 방지 (Unit Test Anti-Pattern Prevention)

### 특성화 테스트의 올바른 사용

**규칙 1: 버그 있는 동작을 특성화하면 안 됨**

**나쁜 예** (`tests/unit/core/AudioEngine.test.ts` 라인 261-276):
```typescript
it('seek()는 재생 중 플레이헤드를 유지해야 함', async () => {
  // 버그: seek() 호출 후 오디오가 재개되지 않음
  // 그런데도 이를 "특성화"하고 그냥 두기
  audioEngine.play();
  audioEngine.seek(5.0);
  expect(mockBufferSource.start).toHaveBeenCalledTimes(1);  // 버그를 정상으로 주장
});
```

**올바른 예**:
```typescript
// 방법 1: it.skip 사용 (버그 수정 대기 중)
it.skip('seek()는 재생 중 플레이헤드를 유지해야 함', async () => {
  // 구현 예정
});

// 방법 2: it.todo 사용
it.todo('AudioEngine.seek() 재개 기능 구현');

// 방법 3: 버그 고정 후 올바른 테스트로 변경
it('seek()는 재생 중 플레이헤드를 유지하고 오디오를 재개해야 함', async () => {
  audioEngine.play();
  const beforeStartCalls = mockBufferSource.start.mock.calls.length;

  audioEngine.seek(5.0);

  // 버그 수정 후: 두 번 호출됨 (초기 재생 + seek 후 재개)
  expect(mockBufferSource.start.mock.calls.length).toBe(beforeStartCalls + 1);
});
```

**규칙 2: 버그 고정 시 테스트도 함께 업데이트**

```typescript
// 버그 고정 이전 (버그 존재)
it('AudioEngine.seek() while playing - BUG: 오디오 재개 안 됨', ...);

// 버그 고정 이후
it('AudioEngine.seek() while playing - 오디오 재개되어야 함', ...);
// 테스트 내용 수정: expect(mockBufferSource.start).toHaveBeenCalledTimes(2);
```

**규칙 3: "Known Issue" 주석은 it.skip과 함께**

```typescript
// 나쁜 예: 그냥 주석만 달고 테스트 유지
describe('AudioEngine.seek', () => {
  it('should restart playback when seeking', () => {
    // Known issue: seek() doesn't restart playback
    audioEngine.play();
    audioEngine.seek(5);
    expect(mockBufferSource.start).toHaveBeenCalledTimes(1);  // 버그를 정상으로 주장
  });
});

// 올바른 예: it.skip과 명확한 설명
describe('AudioEngine.seek', () => {
  it.skip('should restart playback when seeking - PENDING: isPlaying flag reset needed', () => {
    audioEngine.play();
    audioEngine.seek(5);
    expect(mockBufferSource.start).toHaveBeenCalledTimes(2);  // 예상되는 올바른 동작
  });
});
```

---

## 8. 배포 전 체크리스트 (Pre-Deployment Checklist)

### 배포 전 필수 검증 항목

```
배포 전 체크리스트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

타입 검증
[ ] npx tsc --noEmit 성공
  └─ TypeScript 타입 오류 없음

빌드 검증
[ ] npx vite build 성공
  └─ 프로덕션 번들 생성됨

테스트 검증
[ ] npx vitest (Unit 테스트 모두 통과)
  └─ 85% 이상 커버리지
  └─ npm run test:coverage 실행

[ ] npx playwright test (E2E 테스트 모두 통과)
  └─ headed 모드: npx playwright test --headed

Assertion 품질 검증
[ ] E2E 테스트에서 toBeDefined() 사용 없음
  └─ grep -r "toBeDefined()" tests/e2e/ 로 확인

[ ] getByTestId('time-display') 사용 시 .first() 또는 .last() 명시
  └─ grep -r "getByTestId('time-display')" tests/e2e/ 로 확인

[ ] 모든 시간 값 비교 시 directional assertion 사용
  └─ toBeGreaterThan, toBeLessThan 등 확인

수동 테스트
[ ] 오디오 파일 드롭 및 재생 정상
[ ] 재생 중 탐색(seek) 정상
[ ] 루프 재생 정상
[ ] 키보드 단축키(spacebar, arrow) 정상
[ ] 볼륨 조절 정상
[ ] Waveform 시각화 정상 (화면 내 표시)
```

### 배포 전 스크립트

```bash
#!/bin/bash
# pre-deploy.sh

echo "1. TypeScript 검증..."
npx tsc --noEmit || exit 1

echo "2. 빌드 검증..."
npx vite build || exit 1

echo "3. Unit 테스트..."
npx vitest run || exit 1

echo "4. E2E 테스트..."
npx playwright test || exit 1

echo "5. 코드 품질 검증..."
echo "   - toBeDefined() 사용 확인..."
if grep -r "toBeDefined()" tests/e2e/; then
  echo "   경고: toBeDefined() 사용 발견"
  exit 1
fi

echo "6. 모든 검증 통과!"
```

---

## 9. 다음 단계 (Next Steps)

### 우선순위별 액션 아이템

**P0 - 긴급 (배포 전 해결)**

- [ ] `AudioEngine.seek()` 버그 수정
  - 대상: `src/core/AudioEngine.ts` 라인 100-130
  - 수정 사항: `stopSource()` 메서드에서 `isPlaying = false` 추가
  - 테스트: `tests/unit/core/AudioEngine.test.ts` 라인 261-276 업데이트

- [ ] `useKeyboardShortcuts` 통합 테스트 추가
  - 파일: `tests/integration/useKeyboardShortcuts.test.ts`
  - 확인 사항: 키보드 핸들러가 `engine.seek()` 호출하는지 검증

- [ ] `AudioEngine.test.ts`의 특성화 테스트 수정
  - 파일: `tests/unit/core/AudioEngine.test.ts`
  - 수정 사항: `it.skip` 또는 `it.todo`로 변경, 올바른 동작 예상값으로 업데이트

**P1 - 높은 우선순위 (1주일 내)**

- [ ] Waveform 시각적 회귀 테스트 추가
  - 도구: Playwright screenshot comparison
  - 테스트: Waveform이 컨테이너 내에 정상 렌더링되는지 확인
  - 구현: `tests/e2e/waveform-visual.spec.ts`

- [ ] E2E 테스트에서 toBeDefined() 대체
  - 대상: `tests/e2e/**/*.spec.ts` 모든 파일
  - 변경 사항: Meaningful assertions로 교체

- [ ] `data-testid` 추가
  - 대상: DragDropZone 컴포넌트 (`src/components/DragDropZone.tsx`)
  - 추가: `data-testid="drag-drop-zone"`

**P2 - 중간 우선순위 (2주일 내)**

- [ ] 시간 값 비교 헬퍼 함수 작성
  - 파일: `tests/utils/time-helpers.ts`
  - 기능: "M:SS" 포맷 파싱 및 비교 유틸

- [ ] `usePlayback` 통합 테스트 추가
  - 파일: `tests/integration/usePlayback.test.ts`
  - 확인: Play/Pause/Seek이 Engine과 Store 모두 업데이트

- [ ] `useWaveform` 통합 테스트 추가
  - 파일: `tests/integration/useWaveform.test.ts`
  - 확인: setCurrentTime이 WaveSurfer와 Store 모두 업데이트

---

## 10. 추가 참고사항

### 테스트 실행 명령어

```bash
# Unit 테스트만 실행
npm run test

# Unit 테스트 + 커버리지
npm run test:coverage

# E2E 테스트 (headless)
npx playwright test

# E2E 테스트 (UI 포함)
npx playwright test --headed

# 특정 E2E 테스트만 실행
npx playwright test player.spec.ts

# E2E 디버그 모드
npx playwright test --debug
```

### 참고 자료

- AudioEngine 구현: `src/core/AudioEngine.ts`
- Unit 테스트: `tests/unit/core/AudioEngine.test.ts`
- 스토어 구현: `src/stores/playerStore.ts`
- 훅 구현: `src/hooks/usePlayback.ts`, `src/hooks/useKeyboardShortcuts.ts`

---

**문서 작성일**: 2026-02-14
**프로젝트**: Guitar MP3 Trainer v2
**담당**: Testing & QA Team
