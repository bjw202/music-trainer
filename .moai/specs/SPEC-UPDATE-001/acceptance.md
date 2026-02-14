---
spec-id: SPEC-UPDATE-001
type: acceptance-criteria
version: "1.0.0"
created: "2026-02-14"
updated: "2026-02-14"
author: jw
---

# SPEC-UPDATE-001 수용 기준: 고급 속도/피치 제어

## 1. Given/When/Then 시나리오

### AC-SPEED-001: 기본 속도값 확인

```gherkin
Given 오디오 파일이 로드된 상태
When 사용자가 속도 제어 UI를 확인하면
Then 속도 표시가 "1.0x"로 표시된다
```

### AC-SPEED-002: 속도 슬라이더로 느린 속도 설정

```gherkin
Given 오디오 파일이 로드된 상태
When 사용자가 속도 슬라이더를 0.5x로 조절하면
Then 속도 표시가 "0.5x"로 변경된다
  And 재생 속도가 실제로 0.5배로 느려진다
  And 피치 값은 변경 전과 동일하다
```

### AC-SPEED-003: 속도 경계값 초과 방지

```gherkin
Given 현재 속도가 2.0x인 상태
When 사용자가 + 키를 누르면
Then 속도는 2.0x에서 변경되지 않는다

Given 현재 속도가 0.5x인 상태
When 사용자가 - 키를 누르면
Then 속도는 0.5x에서 변경되지 않는다
```

### AC-PITCH-001: 기본 피치값 확인

```gherkin
Given 오디오 파일이 로드된 상태
When 사용자가 피치 제어 UI를 확인하면
Then 피치 표시가 "0"으로 표시된다
```

### AC-PITCH-002: 피치 슬라이더로 높은 피치 설정

```gherkin
Given 오디오 파일이 로드된 상태
When 사용자가 피치 슬라이더를 +6으로 조절하면
Then 피치 표시가 "+6"으로 변경된다
  And 오디오 피치가 6반음 올라간다
  And 속도 값은 변경 전과 동일하다
```

### AC-PITCH-003: 피치 경계값 초과 방지

```gherkin
Given 현재 피치가 +12인 상태
When 사용자가 ] 키를 누르면
Then 피치는 +12에서 변경되지 않는다

Given 현재 피치가 -12인 상태
When 사용자가 [ 키를 누르면
Then 피치는 -12에서 변경되지 않는다
```

### AC-INDEP-001: 속도/피치 완전 독립성

```gherkin
Given 속도가 1.0x이고 피치가 0인 상태
When 사용자가 속도를 0.8x로 변경하면
Then 피치 값은 0으로 유지된다
  And 볼륨 값은 변경 전과 동일하다

Given 속도가 0.8x이고 피치가 0인 상태
When 사용자가 피치를 +3으로 변경하면
Then 속도 값은 0.8x로 유지된다
  And 볼륨 값은 변경 전과 동일하다
```

### AC-INDEP-002: 속도/피치와 A-B 루프 독립성

```gherkin
Given A-B 루프가 활성화된 상태 (A=10s, B=20s)
When 사용자가 속도를 0.7x로 변경하면
Then A-B 루프는 여전히 활성화 상태이다
  And A 지점은 10s이다
  And B 지점은 20s이다
  And 루프 내에서 재생이 계속된다
```

### AC-GAPLESS-001: 재생 중 속도 변경 무끊김

```gherkin
Given 오디오가 재생 중인 상태
When 사용자가 속도를 1.0x에서 0.5x로 변경하면
Then 오디오 재생이 중단되지 않는다
  And 재생 상태(playing)가 유지된다
  And 시간 표시가 새 속도에 맞게 진행된다
```

### AC-UI-001: 리셋 기능

```gherkin
Given 속도가 0.7x이고 피치가 +5인 상태
When 사용자가 r 키를 누르면
Then 속도가 1.0x로 초기화된다
  And 피치가 0으로 초기화된다
  And 볼륨은 변경 전과 동일하다
  And A-B 루프 상태는 변경 전과 동일하다

Given 속도가 0.7x이고 피치가 +5이고 재생 중인 상태
When 사용자가 r 키를 누르면
Then 재생 상태(playing)가 유지된다
  And 속도가 1.0x, 피치가 0으로 초기화된다
```

### AC-KEYBOARD-001: 키보드 단축키 동작

```gherkin
Given 오디오 파일이 로드된 상태
When 사용자가 + 키를 누르면
Then 속도가 0.1x 증가한다

Given 오디오 파일이 로드된 상태
When 사용자가 - 키를 누르면
Then 속도가 0.1x 감소한다

Given 오디오 파일이 로드된 상태
When 사용자가 ] 키를 누르면
Then 피치가 1반음 증가한다

Given 오디오 파일이 로드된 상태
When 사용자가 [ 키를 누르면
Then 피치가 1반음 감소한다
```

### AC-KEYBOARD-002: 입력 필드에서 단축키 비활성화

```gherkin
Given 텍스트 입력 필드에 포커스가 있는 상태
When 사용자가 +, -, [, ], r 키를 누르면
Then 속도/피치 값이 변경되지 않는다
  And 키 입력이 텍스트 필드에 정상적으로 입력된다
```

### AC-TIME-001: 속도별 시간 표시 정확도

```gherkin
Given 오디오가 0:00에서 재생 시작된 상태
When 속도를 0.5x로 설정하고 실제 2초가 경과하면
Then 시간 표시는 약 1초를 나타낸다 (허용 오차: 0.5초)

Given 오디오가 0:00에서 재생 시작된 상태
When 속도를 2.0x로 설정하고 실제 2초가 경과하면
Then 시간 표시는 약 4초를 나타낸다 (허용 오차: 0.5초)
```

### AC-PERSIST-001: 상태 지속성

```gherkin
Given 속도가 0.8x이고 피치가 +3인 상태
When 사용자가 seek 동작을 수행하면
Then 속도는 0.8x로 유지된다
  And 피치는 +3으로 유지된다

Given 속도가 0.8x이고 피치가 +3인 상태
When 사용자가 볼륨을 변경하면
Then 속도는 0.8x로 유지된다
  And 피치는 +3으로 유지된다

Given 속도가 0.8x이고 피치가 +3인 상태
When 사용자가 뮤트 토글을 수행하면
Then 속도는 0.8x로 유지된다
  And 피치는 +3으로 유지된다
```

### AC-RAPID-001: 빠른 연속 조작

```gherkin
Given 오디오가 재생 중인 상태
When 사용자가 + 키를 5회 빠르게 연속으로 누르면
Then 속도가 정확히 0.5x 증가한다 (1.0x -> 1.5x)
  And 오디오 재생이 끊기지 않는다

Given 오디오가 재생 중인 상태
When 사용자가 ] 키를 3회, [ 키를 1회 빠르게 연속으로 누르면
Then 피치가 +2로 정확하게 설정된다
  And 오디오 재생이 끊기지 않는다
```

---

## 2. E2E 테스트 파일 구조

### `tests/e2e/speed-pitch.spec.ts` (~42개 케이스)

```
describe('Speed/Pitch Control')
  |
  +-- describe('Category 1: Speed Control Basic') [5 tests]
  |   +-- 기본 속도가 1.0x인지 확인
  |   +-- 속도 슬라이더를 0.5x로 변경
  |   +-- 속도 슬라이더를 2.0x로 변경
  |   +-- 속도 경계값 초과 방지 (0.5x 이하, 2.0x 이상)
  |   +-- 속도 표시가 현재 값 반영
  |
  +-- describe('Category 2: Pitch Control Basic') [5 tests]
  |   +-- 기본 피치가 0인지 확인
  |   +-- 피치 슬라이더를 +6으로 변경
  |   +-- 피치 슬라이더를 -6으로 변경
  |   +-- 피치 경계값 초과 방지 (-12 이하, +12 이상)
  |   +-- 피치 표시가 +/- 부호와 함께 표시
  |
  +-- describe('Category 3: Speed/Pitch Independence') [4 tests]
  |   +-- 속도 변경이 피치에 영향 없음
  |   +-- 피치 변경이 속도에 영향 없음
  |   +-- 속도 변경이 볼륨에 영향 없음
  |   +-- 피치 변경이 볼륨에 영향 없음
  |
  +-- describe('Category 4: Speed/Pitch + Playback') [5 tests]
  |   +-- 재생 중 속도 변경 시 재생 상태 유지
  |   +-- 재생 중 피치 변경 시 재생 상태 유지
  |   +-- pause/resume 후 속도/피치 유지
  |   +-- 0.5x 속도에서 시간 진행 검증
  |   +-- 2.0x 속도에서 시간 진행 검증
  |
  +-- describe('Category 5: Speed/Pitch + A-B Loop') [3 tests]
  |   +-- 속도 변경 시 루프 비활성화 안됨
  |   +-- 피치 변경 시 루프 비활성화 안됨
  |   +-- 다른 속도에서 루프 경계 타이밍 정확성
  |
  +-- describe('Category 6: Speed/Pitch Reset') [3 tests]
  |   +-- 리셋 버튼으로 속도 1.0x, 피치 0 복원
  |   +-- 재생 중 리셋 시 재생 상태 유지
  |   +-- 리셋 시 볼륨과 루프 상태 유지
  |
  +-- describe('Category 7: Keyboard Shortcuts') [5 tests]
  |   +-- +/- 키로 속도 변경
  |   +-- [/] 키로 피치 변경
  |   +-- r 키로 속도/피치 리셋
  |   +-- 입력 필드에서 단축키 비동작
  |   +-- 단축키가 경계값 준수
  |
  +-- describe('Category 8: Compound Independence') [6 tests]
  |   +-- 속도 + 볼륨 독립성
  |   +-- 피치 + 볼륨 독립성
  |   +-- 속도 + A-B 루프 독립성
  |   +-- 피치 + A-B 루프 독립성
  |   +-- 속도 + Seek 독립성
  |   +-- 피치 + Seek 독립성
  |
  +-- describe('Category 9: State Persistence') [3 tests]
  |   +-- seek 후 속도 유지
  |   +-- 볼륨 변경 후 피치 유지
  |   +-- 뮤트 토글 후 속도/피치 유지
  |
  +-- describe('Category 10: Rapid Operations') [3 tests]
      +-- 빠른 속도 변경 정확성
      +-- 빠른 피치 변경 정확성
      +-- 빠른 속도+피치+재생 전환
```

### `tests/e2e/compound-independence.spec.ts` 확장 (+6개 케이스)

기존 compound-independence.spec.ts에 다음 테스트 추가:

```
describe('Speed/Pitch Compound Independence')
  +-- 속도 + 볼륨 Pairwise 독립성
  +-- 피치 + 볼륨 Pairwise 독립성
  +-- 속도 + A-B 루프 Sequential 독립성
  +-- 피치 + A-B 루프 Sequential 독립성
  +-- 속도 + Seek State Persistence
  +-- 피치 + Seek State Persistence
```

---

## 3. 테스트 가이드라인 준수사항

### testing-strategy.md 필수 규칙

1. **toBeDefined() 금지**: 항상 의미 있는 비교 assertion 사용
2. **Before/After 비교 필수**: 상태 변경 액션 후 반드시 이전 값과 비교
3. **Selector 우선순위**: `getByRole` > `getByTestId(.first())` > `getByText(regex)`
4. **다중 요소 주의**: `getByTestId('time-display')`는 반드시 `.first()` 또는 `.last()` 명시
5. **방향성 assertion**: 시간 값은 `toBeGreaterThan` / `toBeLessThan` 사용

### 테스트 data-testid 규약

| 요소 | data-testid |
|------|-------------|
| 속도 슬라이더 | `speed-slider` |
| 속도 표시 | `speed-display` |
| 피치 슬라이더 | `pitch-slider` |
| 피치 표시 | `pitch-display` |
| 속도/피치 리셋 버튼 | `speed-pitch-reset` |
| SpeedPitch 패널 | `speed-pitch-panel` |

---

## 4. Quality Gate (TRUST 5)

### Tested (테스트됨)

- [ ] 신규 E2E 테스트 ~42개 케이스 작성 완료
- [ ] compound-independence.spec.ts 확장 6개 케이스 추가
- [ ] 기존 E2E 테스트 (playback, controls, abloop, visual) 모두 통과
- [ ] toBeDefined() 사용 없음 확인
- [ ] 단위 테스트 커버리지 85% 이상

### Readable (읽기 쉬움)

- [ ] 모든 신규 함수/변수에 명확한 이름 사용
- [ ] 한국어 주석으로 복잡한 로직 설명
- [ ] TypeScript strict mode 준수

### Unified (통일됨)

- [ ] 기존 코드 패턴 (Guard clause, Zustand .getState()) 준수
- [ ] ESLint + Prettier 통과
- [ ] 기존 컴포넌트 구조와 일관된 파일 구성

### Secured (보안됨)

- [ ] 사용자 입력값 범위 검증 (speed 0.5-2.0, pitch -12~+12)
- [ ] AudioWorklet에서의 입력 유효성 검사

### Trackable (추적 가능)

- [ ] 모든 커밋 메시지에 SPEC-UPDATE-001 참조
- [ ] Conventional Commits 형식 준수
- [ ] PR 설명에 변경 파일 목록 포함

---

## 5. 성능 기준

| 지표 | 목표값 | 측정 방법 |
|------|--------|-----------|
| AudioWorklet 레이턴시 | 10ms 이내 | Chrome DevTools Performance |
| 속도/피치 변경 시 끊김 | 0회 | 수동 청취 + E2E 재생 상태 검증 |
| UI 반응 시간 | 100ms 이내 | E2E waitForTimeout 기반 검증 |
| 메모리 누수 | 없음 | 오디오 파일 로드/언로드 반복 테스트 |
| 바이패스 모드 오버헤드 | 0% | speed=1.0, pitch=0에서 CPU 사용량 비교 |

---

## 6. Definition of Done (완료 정의)

다음 조건이 모두 충족되면 SPEC-UPDATE-001 구현이 완료된 것으로 판단:

1. spec.md의 모든 요구사항(REQ-*)이 구현됨
2. 모든 Given/When/Then 시나리오가 E2E 테스트로 자동화됨
3. 기존 E2E 테스트 (playback, controls, abloop, compound-independence, visual) 모두 통과
4. `npx tsc --noEmit` 성공 (TypeScript 타입 오류 없음)
5. `npx vite build` 성공 (프로덕션 빌드 정상)
6. ESLint + Prettier 검사 통과
7. testing-strategy.md 가이드라인 100% 준수
8. TRUST 5 품질 게이트 모든 항목 체크 완료
