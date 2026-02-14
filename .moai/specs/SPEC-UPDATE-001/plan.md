---
spec-id: SPEC-UPDATE-001
type: implementation-plan
version: "1.0.0"
created: "2026-02-14"
updated: "2026-02-14"
author: jw
---

# SPEC-UPDATE-001 구현 계획: 고급 속도/피치 제어

## 1. 기술 스택

### 신규 의존성

| 패키지 | 용도 | 비고 |
|--------|------|------|
| soundtouch-ts | Time-Stretching + Pitch-Shifting | SoundTouch 알고리즘 TypeScript 바인딩 |

### 기존 기술 (변경 없음)

- React 19, TypeScript 5.x, Vite 6.x
- Web Audio API (AudioWorklet 추가 활용)
- Zustand (상태 확장)
- Playwright (E2E 테스트 추가)

---

## 2. 아키텍처 설계

### 2.1 오디오 그래프 변경

**현재 (Phase 1)**:
```
BufferSource -> GainNode -> AnalyserNode -> Destination
```

**목표 (Phase 2)**:
```
BufferSource -> AudioWorkletNode(SoundTouch) -> GainNode -> AnalyserNode -> Destination
```

### 2.2 AudioWorklet 설계

`soundtouch-processor.ts`는 AudioWorklet 스레드에서 실행되며:
1. 메인 스레드에서 `port.postMessage()`로 speed/pitch 파라미터 수신
2. SoundTouch 알고리즘으로 오디오 샘플 실시간 처리
3. 바이패스 모드: speed=1.0 AND pitch=0일 때 입력을 그대로 출력

### 2.3 시간 추적 전략

속도 변경 시 `context.currentTime`은 실제 경과 시간(벽시계)을 반영하므로:

```
wallClockElapsed = context.currentTime - startTime
audioTimeElapsed = wallClockElapsed * currentSpeed
currentPosition = pauseTime + audioTimeElapsed
```

속도가 중간에 변경될 경우:
- 변경 시점의 `currentPosition`을 새로운 `pauseTime`으로 저장
- `startTime`을 현재 `context.currentTime`으로 갱신
- 새 속도로 이후 시간을 계산

### 2.4 상태 관리 확장

```
controlStore 확장:
  speed: number (0.5 ~ 2.0, 기본값 1.0)
  pitch: number (-12 ~ +12, 기본값 0)
  setSpeed(speed): 범위 클램핑 후 저장 + AudioEngine 호출
  setPitch(pitch): 범위 클램핑 후 저장 + AudioEngine 호출
  resetSpeedPitch(): speed=1.0, pitch=0으로 초기화
```

---

## 3. 마일스톤 (우선순위 기반)

### M1: 핵심 오디오 인프라 [Priority High]

**목표**: AudioWorklet + soundtouch-ts 통합, 속도/피치 독립 제어 엔진 구축

**작업 목록**:

| 순서 | 작업 | 파일 | 의존성 |
|------|------|------|--------|
| 1-1 | soundtouch-ts 의존성 추가 | package.json | 없음 |
| 1-2 | SPEED_PITCH 상수 정의 | src/utils/constants.ts | 없음 |
| 1-3 | SoundTouch AudioWorklet processor 구현 | src/core/worklets/soundtouch-processor.ts | 1-1 |
| 1-4 | AudioEngine에 setSpeed/setPitch 메서드 추가 | src/core/AudioEngine.ts | 1-3 |
| 1-5 | AudioEngine 오디오 그래프 재구성 | src/core/AudioEngine.ts | 1-3, 1-4 |
| 1-6 | 시간 추적 로직 수정 (속도 반영) | src/core/AudioEngine.ts | 1-4 |
| 1-7 | 바이패스 모드 구현 | src/core/AudioEngine.ts | 1-5 |

**검증 기준**:
- AudioWorklet이 정상 로드되고 오디오 처리 수행
- 속도 변경 시 피치 유지 확인
- 피치 변경 시 속도 유지 확인
- 바이패스 모드에서 원본 음질 유지

### M2: 상태 관리 및 훅 [Priority High]

**목표**: Zustand 스토어 확장 및 React 훅 통합

**작업 목록**:

| 순서 | 작업 | 파일 | 의존성 |
|------|------|------|--------|
| 2-1 | controlStore에 speed/pitch 상태 추가 | src/stores/controlStore.ts | M1 완료 |
| 2-2 | useSpeedPitch 훅 구현 | src/hooks/useSpeedPitch.ts | 2-1 |
| 2-3 | useKeyboardShortcuts에 속도/피치 단축키 추가 | src/hooks/useKeyboardShortcuts.ts | 2-1 |

**검증 기준**:
- 스토어 상태 변경이 AudioEngine에 전달
- 키보드 단축키로 속도/피치 조절 가능
- 텍스트 입력 필드에서 단축키 비활성화

### M3: UI 컴포넌트 [Priority Medium]

**목표**: SpeedPitch 패널 UI 구현 및 Player 통합

**작업 목록**:

| 순서 | 작업 | 파일 | 의존성 |
|------|------|------|--------|
| 3-1 | SpeedControl 슬라이더 컴포넌트 | src/components/SpeedPitch/SpeedControl.tsx | M2 완료 |
| 3-2 | PitchControl 슬라이더 컴포넌트 | src/components/SpeedPitch/PitchControl.tsx | M2 완료 |
| 3-3 | SpeedPitchPanel 컨테이너 (리셋 버튼 포함) | src/components/SpeedPitch/SpeedPitchPanel.tsx | 3-1, 3-2 |
| 3-4 | Barrel export 파일 | src/components/SpeedPitch/index.ts | 3-3 |
| 3-5 | Player.tsx에 SpeedPitchPanel 통합 | src/components/Player/Player.tsx | 3-3 |

**검증 기준**:
- 슬라이더로 속도/피치 실시간 조절 가능
- 현재 값 표시 (속도: X.Xx, 피치: +/-N)
- 리셋 버튼으로 기본값 복원
- 기존 Player 레이아웃과 조화

### M4: E2E 테스트 [Priority High]

**목표**: ~42개 E2E 테스트 케이스로 전체 기능 검증

**작업 목록**:

| 순서 | 작업 | 파일 | 의존성 |
|------|------|------|--------|
| 4-1 | speed-pitch.spec.ts 작성 (10개 카테고리, ~42개 케이스) | tests/e2e/speed-pitch.spec.ts | M3 완료 |
| 4-2 | compound-independence.spec.ts 확장 (6개 케이스) | tests/e2e/compound-independence.spec.ts | M3 완료 |

**검증 기준**:
- testing-strategy.md 가이드라인 준수
- toBeDefined() 미사용
- Before/After 값 비교 패턴 적용
- getByTestId 사용 시 .first()/.last() 명시

---

## 4. 리스크 분석 및 완화

### R1: soundtouch-ts AudioWorklet 호환성

- **리스크**: soundtouch-ts가 AudioWorklet 환경에서 동작하지 않을 수 있음
- **영향도**: High (핵심 기능 불가)
- **완화 전략**:
  - 구현 초기에 Proof of Concept 수행
  - 대안: ScriptProcessorNode (deprecated이지만 폴백으로 사용 가능)
  - 대안: 메인 스레드에서 직접 처리 (성능 저하 감수)

### R2: 시간 추적 정확도

- **리스크**: 속도 변경 시 재생 위치 계산이 부정확할 수 있음
- **영향도**: Medium (사용자 경험 저하)
- **완화 전략**:
  - 속도 변경 시점마다 스냅샷 저장
  - 정밀 시간 비교 E2E 테스트 작성
  - 허용 오차 범위 정의 (0.5초 이내)

### R3: A-B 루프와의 상호작용

- **리스크**: 속도 변경 시 A-B 루프 경계 타이밍이 어긋날 수 있음
- **영향도**: Medium (기존 기능 회귀)
- **완화 전략**:
  - 루프 경계 체크를 오디오 시간 기준으로 수행
  - compound-independence.spec.ts에 속도/피치 + A-B 루프 테스트 추가

### R4: UI 레이아웃 변경 충돌

- **리스크**: SpeedPitchPanel 추가로 기존 레이아웃이 깨질 수 있음
- **영향도**: Low (CSS 수정으로 해결 가능)
- **완화 전략**:
  - visual.spec.ts 스크린샷 비교 테스트 업데이트
  - 반응형 레이아웃 테스트

### R5: 빠른 연속 조작으로 인한 상태 불일치

- **리스크**: 사용자가 속도/피치를 빠르게 반복 변경 시 상태 불일치 발생 가능
- **영향도**: Medium (사용자 경험 저하)
- **완화 전략**:
  - Debounce/throttle 적용 (AudioEngine 호출)
  - Zustand 상태는 즉시 반영, AudioEngine 호출은 스로틀링

---

## 5. 구현 의존성 그래프

```
package.json (soundtouch-ts)
    |
constants.ts (SPEED_PITCH 상수)
    |
soundtouch-processor.ts (AudioWorklet)
    |
AudioEngine.ts (setSpeed/setPitch, 그래프 재구성, 시간 추적)
    |
controlStore.ts (speed/pitch 상태)
    |
    +-- useSpeedPitch.ts (훅)
    |       |
    |       +-- SpeedControl.tsx
    |       +-- PitchControl.tsx
    |       +-- SpeedPitchPanel.tsx
    |               |
    |               +-- Player.tsx (통합)
    |
    +-- useKeyboardShortcuts.ts (단축키 확장)
    |
    +-- speed-pitch.spec.ts (E2E 테스트)
    +-- compound-independence.spec.ts (독립성 테스트 확장)
```

---

## 6. 비기능 요구사항

### 성능

- AudioWorklet 처리 레이턴시: 10ms 이내
- 속도/피치 변경 시 오디오 끊김: 0회
- UI 반응 시간: 파라미터 변경 후 100ms 이내 화면 반영

### 접근성

- 슬라이더에 적절한 aria-label 및 aria-valuetext
- 키보드로 모든 속도/피치 조작 가능
- 현재 값이 스크린 리더에 전달

### 호환성

- 기존 Phase 1 기능에 대한 회귀 없음
- 기존 E2E 테스트 모두 통과
- 기존 키보드 단축키 동작 유지

---

## 7. 다음 단계

구현 완료 후:
- `/moai:2-run SPEC-UPDATE-001`로 구현 시작
- 구현 후 `/moai:3-sync SPEC-UPDATE-001`로 문서 동기화
- Phase 3 (음원 분리) SPEC 준비
