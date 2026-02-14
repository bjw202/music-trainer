---
id: SPEC-UPDATE-001
version: "1.1.0"
status: completed
created: "2026-02-14"
updated: "2026-02-14"
author: jw
priority: high
---

# SPEC-UPDATE-001: Phase 2 - 고급 속도/피치 제어

## HISTORY

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0.0 | 2026-02-14 | jw | 초기 SPEC 작성 |
| 1.1.0 | 2026-02-14 | jw | 구현 완료 - 오프라인 버퍼 처리 방식 채택 (AudioWorklet 대신) |

---

## 1. Environment (환경)

### 1.1 현재 시스템 상태

- **오디오 그래프**: `BufferSource -> GainNode -> AnalyserNode -> Destination`
- **상태 관리**: `controlStore`에 volume/muted만 존재, speed/pitch 상태 없음
- **훅**: `usePlayback` (play/pause/stop/seek), `useKeyboardShortcuts` (Space/Arrow/I/O/A/M)
- **패턴**: Guard clauses (`if (!engine || !buffer) return`), Zustand `.getState()` 패턴

### 1.2 기술 스택

- React 19 + TypeScript 5.x + Vite 6.x
- Web Audio API + wavesurfer.js 7.x
- Zustand (상태 관리)
- soundtouch-ts (신규 의존성 - 속도/피치 독립 제어)
- AudioWorklet (메인 스레드 분리 오디오 처리)

### 1.3 대상 브라우저

- Chrome 90+, Firefox 90+, Safari 15+, Edge 90+
- AudioWorklet API 지원 필수

---

## 2. Assumptions (가정)

### 2.1 기술 가정

- [A-TECH-001] soundtouch-ts 라이브러리가 AudioWorklet 환경에서 정상 동작한다
- [A-TECH-002] AudioWorklet은 모든 대상 브라우저에서 지원된다
- [A-TECH-003] 속도 0.5x~2.0x, 피치 -12~+12 반음 범위에서 soundtouch-ts가 허용 가능한 음질을 제공한다
- [A-TECH-004] AudioWorkletNode를 통한 실시간 처리 시 지각 가능한 레이턴시가 없다
- [A-TECH-005] 기존 wavesurfer.js 파형 시각화는 새 오디오 그래프와 호환된다

### 2.2 사용자 가정

- [A-USER-001] 사용자는 속도와 피치를 독립적으로 조절하길 원한다 (일반 플레이어의 연동 방식이 아님)
- [A-USER-002] 속도 0.1x 단위, 피치 1반음 단위의 정밀도가 사용자 요구를 충족한다
- [A-USER-003] 기존 키보드 단축키 사용자가 새 단축키를 자연스럽게 학습할 수 있다

### 2.3 제약 가정

- [A-CONST-001] 속도/피치 변경 중 오디오 끊김은 허용 불가 (무끊김 재생 필수)
- [A-CONST-002] 속도/피치/볼륨 세 파라미터는 완전히 독립적이어야 한다
- [A-CONST-003] 기존 Phase 1 기능 (A-B 루프, 볼륨, 기본 재생)에 영향을 주지 않아야 한다

---

## 3. Requirements (요구사항)

### Module 1: 속도 제어 (Speed Control)

#### REQ-SPEED-001 [Ubiquitous]
시스템은 **항상** 속도 값을 0.5x~2.0x 범위 내로 클램핑해야 한다.

#### REQ-SPEED-002 [Event-Driven]
**WHEN** 사용자가 속도 슬라이더를 조절하면 **THEN** 시스템은 오디오 재생 속도를 실시간으로 변경하고 UI에 현재 속도를 표시한다.

#### REQ-SPEED-003 [Event-Driven]
**WHEN** 사용자가 `+`/`=` 키를 누르면 **THEN** 시스템은 속도를 0.1x 증가시키고, **WHEN** `-`/`_` 키를 누르면 **THEN** 0.1x 감소시킨다.

#### REQ-SPEED-004 [Unwanted]
시스템은 속도 변경 시 피치를 변경**하지 않아야 한다** (속도와 피치의 완전한 독립).

#### REQ-SPEED-005 [State-Driven]
**IF** 속도가 경계값(0.5x 또는 2.0x)에 도달한 상태 **THEN** 시스템은 해당 방향의 추가 변경을 무시한다.

#### REQ-SPEED-006 [Event-Driven]
**WHEN** 재생 중 속도를 변경하면 **THEN** 재생 상태(playing)가 유지되며 끊김 없이 새 속도로 전환된다.

### Module 2: 피치 제어 (Pitch Control)

#### REQ-PITCH-001 [Ubiquitous]
시스템은 **항상** 피치 값을 -12~+12 반음 범위 내로 클램핑해야 한다.

#### REQ-PITCH-002 [Event-Driven]
**WHEN** 사용자가 피치 슬라이더를 조절하면 **THEN** 시스템은 오디오 피치를 실시간으로 변경하고 UI에 현재 피치를 부호(+/-)와 함께 표시한다.

#### REQ-PITCH-003 [Event-Driven]
**WHEN** 사용자가 `]` 키를 누르면 **THEN** 시스템은 피치를 +1 반음 올리고, **WHEN** `[` 키를 누르면 **THEN** -1 반음 내린다.

#### REQ-PITCH-004 [Unwanted]
시스템은 피치 변경 시 재생 속도를 변경**하지 않아야 한다** (피치와 속도의 완전한 독립).

#### REQ-PITCH-005 [State-Driven]
**IF** 피치가 경계값(-12 또는 +12)에 도달한 상태 **THEN** 시스템은 해당 방향의 추가 변경을 무시한다.

#### REQ-PITCH-006 [Event-Driven]
**WHEN** 재생 중 피치를 변경하면 **THEN** 재생 상태(playing)가 유지되며 끊김 없이 새 피치로 전환된다.

### Module 3: 속도/피치 독립성 (Independence)

#### REQ-INDEP-001 [Ubiquitous]
시스템은 **항상** 속도, 피치, 볼륨 세 파라미터를 완전히 독립적으로 관리해야 한다.

#### REQ-INDEP-002 [Event-Driven]
**WHEN** 속도를 변경하면 **THEN** 피치 값과 볼륨 값은 변경 전과 동일하게 유지된다.

#### REQ-INDEP-003 [Event-Driven]
**WHEN** 피치를 변경하면 **THEN** 속도 값과 볼륨 값은 변경 전과 동일하게 유지된다.

#### REQ-INDEP-004 [Event-Driven]
**WHEN** 속도 또는 피치를 변경하면 **THEN** A-B 루프 상태(활성화 여부, A/B 지점)는 변경 전과 동일하게 유지된다.

#### REQ-INDEP-005 [Event-Driven]
**WHEN** seek 동작을 수행하면 **THEN** 속도와 피치 값은 변경 전과 동일하게 유지된다.

### Module 4: 무끊김 재생 (Gapless Playback)

#### REQ-GAPLESS-001 [Ubiquitous]
시스템은 **항상** 속도/피치 파라미터 변경 시 오디오 끊김 없이 부드러운 전환을 제공해야 한다.

#### REQ-GAPLESS-002 [Event-Driven]
**WHEN** AudioWorkletNode를 통해 SoundTouch 파라미터가 변경되면 **THEN** 메인 스레드 블로킹 없이 오디오 처리가 계속된다.

#### REQ-GAPLESS-003 [State-Driven]
**IF** 속도가 1.0x이고 피치가 0인 상태 **THEN** 시스템은 SoundTouch 처리를 바이패스하여 원본 오디오 품질을 유지한다.

#### REQ-GAPLESS-004 [Ubiquitous]
시스템은 **항상** 정확한 시간 추적을 유지해야 한다. 시간 계산 공식: `currentPosition = pauseTime + (context.currentTime - startTime) * currentSpeed`.

### Module 5: UI/UX 및 키보드 단축키

#### REQ-UI-001 [Ubiquitous]
시스템은 **항상** 현재 속도를 `X.Xx` 형식으로, 피치를 `+N`/`-N`/`0` 형식으로 UI에 표시해야 한다.

#### REQ-UI-002 [Event-Driven]
**WHEN** 사용자가 `r` 키를 누르면 **THEN** 속도를 1.0x, 피치를 0으로 초기화한다 (볼륨과 루프 상태는 유지).

#### REQ-UI-003 [Optional]
**가능하면** SpeedPitchPanel 컴포넌트에 리셋 버튼을 제공하여 마우스 사용자도 초기화할 수 있도록 한다.

#### REQ-UI-004 [Unwanted]
시스템은 input, textarea 등 텍스트 입력 필드에 포커스가 있을 때 키보드 단축키가 동작**하지 않아야 한다**.

#### REQ-UI-005 [Event-Driven]
**WHEN** 속도/피치 리셋이 재생 중 수행되면 **THEN** 재생 상태는 유지되며 값만 초기화된다.

---

## 4. Specifications (기술 사양)

### 4.1 오디오 그래프 변경

**기존 (Phase 1)**:
```
BufferSource -> GainNode -> AnalyserNode -> Destination
```

**변경 후 (Phase 2)**:
```
BufferSource -> AudioWorkletNode(SoundTouch) -> GainNode -> AnalyserNode -> Destination
```

- 바이패스 모드: speed=1.0 AND pitch=0일 때 SoundTouch 처리 생략

### 4.2 상태 확장 (controlStore)

```typescript
interface ControlState {
  // 기존
  volume: number       // 0-100
  muted: boolean
  previousVolume: number

  // 신규
  speed: number        // 0.5-2.0, 기본값 1.0
  pitch: number        // -12 ~ +12, 기본값 0

  // 신규 Actions
  setSpeed: (speed: number) => void
  setPitch: (pitch: number) => void
  resetSpeedPitch: () => void
}
```

### 4.3 키보드 단축키 확장

| 키 | 동작 | 범위 |
|----|------|------|
| `+` / `=` | 속도 +0.1x | 최대 2.0x |
| `-` / `_` | 속도 -0.1x | 최소 0.5x |
| `]` | 피치 +1 반음 | 최대 +12 |
| `[` | 피치 -1 반음 | 최소 -12 |
| `r` | 속도/피치 초기화 | speed=1.0, pitch=0 |

### 4.4 시간 추적 공식

```
wallClockElapsed = context.currentTime - startTime
audioTimeElapsed = wallClockElapsed * currentSpeed
currentPosition = pauseTime + audioTimeElapsed
```

### 4.5 파일 목록

**신규 파일 (7개)**:
1. `src/core/worklets/soundtouch-processor.ts` - AudioWorklet processor
2. `src/components/SpeedPitch/SpeedControl.tsx` - 속도 슬라이더 (0.5x-2.0x)
3. `src/components/SpeedPitch/PitchControl.tsx` - 피치 슬라이더 (-12 ~ +12)
4. `src/components/SpeedPitch/SpeedPitchPanel.tsx` - 패널 컨테이너 (리셋 버튼 포함)
5. `src/components/SpeedPitch/index.ts` - Barrel export
6. `src/hooks/useSpeedPitch.ts` - 속도/피치 훅
7. `tests/e2e/speed-pitch.spec.ts` - E2E 테스트 (~42개 케이스)

**수정 파일 (6개)**:
1. `src/core/AudioEngine.ts` - setSpeed/setPitch 추가, AudioWorklet 통합, 시간 추적 수정
2. `src/stores/controlStore.ts` - speed/pitch 상태 및 액션 추가
3. `src/hooks/useKeyboardShortcuts.ts` - 속도/피치 단축키 추가
4. `src/components/Player/Player.tsx` - SpeedPitchPanel 통합
5. `src/utils/constants.ts` - SPEED_PITCH 상수 추가
6. `package.json` - soundtouch-ts 의존성 추가

---

## 5. Traceability (추적성)

| 요구사항 ID | 계획 참조 | 수용 기준 참조 |
|-------------|-----------|---------------|
| REQ-SPEED-001~006 | plan.md M1 | acceptance.md AC-SPEED-* |
| REQ-PITCH-001~006 | plan.md M2 | acceptance.md AC-PITCH-* |
| REQ-INDEP-001~005 | plan.md M3 | acceptance.md AC-INDEP-* |
| REQ-GAPLESS-001~004 | plan.md M1 | acceptance.md AC-GAPLESS-* |
| REQ-UI-001~005 | plan.md M4 | acceptance.md AC-UI-* |

---

## 6. Edge Cases (경계 케이스)

1. 속도가 정확한 경계값(0.5x, 2.0x)일 때의 동작
2. 피치가 정확한 경계값(-12, +12)일 때의 동작
3. seek 동작 중 속도/피치 변경
4. 음소거된 상태에서 속도/피치 변경
5. A-B 루프 활성화 중 속도/피치 초기화
6. 재생 중 속도 변경 시 시간 표시 정확도
7. 빠른 연속 속도/피치 변경 (rapid oscillation)
8. 0.5x 속도 + 긴 오디오 = 매우 느린 시간 진행
9. 2.0x 속도 + 오디오 끝 근처 = 오버슈트 가능성
10. 속도/피치 변경 후 AudioContext resume 필요 여부

---

## 7. Expert Consultation (전문가 자문 권장)

- **expert-frontend**: SpeedPitch UI 컴포넌트 설계, Pencil 디자인 시스템 연동
- **expert-backend**: AudioWorklet 아키텍처 설계, soundtouch-ts 통합 패턴
