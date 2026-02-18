# SPEC-BPM-002: 메트로놈 동기화 재설계

| 항목 | 내용 |
|------|------|
| SPEC ID | SPEC-BPM-002 |
| 상태 | Completed (핵심 US-1, US-2 구현 완료) |
| 작성일 | 2026-02-17 |
| 완료일 | 2026-02-18 |
| 우선순위 | High |
| 선행 SPEC | SPEC-BPM-001 (Completed) |
| 개발 방법론 | DDD (기존 파일 수정 중심) |

---

## 목차

1. [개요](#1-개요)
2. [문제 분석](#2-문제-분석)
3. [유저 스토리 (EARS)](#3-유저-스토리-ears)
4. [기술 아키텍처](#4-기술-아키텍처)
5. [파일 영향 분석](#5-파일-영향-분석)
6. [비기능 요구사항](#6-비기능-요구사항)
7. [리스크 및 완화](#7-리스크-및-완화)
8. [대안 평가](#8-대안-평가)
9. [제약사항](#9-제약사항)
10. [범위 외](#10-범위-외)

---

## 1. 개요

SPEC-BPM-001에서 구현된 메트로놈의 시간 동기화 레이어를 재설계하여 sourcePosition의 93ms 업데이트 지연으로 인한 동기화 문제를 해결한다.

**핵심 문제:** `ScriptProcessorNode`의 버퍼 크기 4096 샘플(44.1kHz = ~93ms)로 인해 `simpleFilter.sourcePosition`이 ~93ms 간격으로만 업데이트된다. `MetronomeEngine.syncToPlaybackTime()`은 `sourceTime !== lastSourceTime`일 때만 기준점을 갱신하므로, 갱신 사이 ~93ms 동안 `syncedAcTime`이 stale 상태가 되어 스케줄 시간 계산에 드리프트가 발생한다.

**해결 방향:** sourcePosition 업데이트 사이에 `audioContext.currentTime` 델타를 사용한 시간 보간(interpolation)을 도입하여 연속적인 재생 시간 추정을 제공한다.

---

## 2. 문제 분석

### 2.1 근본 원인: sourcePosition 93ms 업데이트 지연

```
ScriptProcessorNode 버퍼: 4096 samples @ 44.1kHz = ~93ms

시간 흐름:
t=0ms    sourcePosition 업데이트 (정확)
t=16ms   rAF 호출 -> sourceTime 동일 -> syncedAcTime 갱신 안됨 (stale)
t=32ms   rAF 호출 -> sourceTime 동일 -> 드리프트 누적
t=48ms   rAF 호출 -> sourceTime 동일 -> 드리프트 증가
t=64ms   rAF 호출 -> sourceTime 동일 -> 드리프트 증가
t=80ms   rAF 호출 -> sourceTime 동일 -> 드리프트 증가
t=93ms   sourcePosition 업데이트 (정확) -> syncedAcTime 갱신
```

### 2.2 구체적 증상 3가지

**증상 1: 메트로놈 속도 변동 (Jitter)**
- `syncedAcTime` 기준점이 93ms마다만 갱신
- 갱신 직후: 정확한 스케줄링
- 갱신 직전: 최대 ~93ms의 stale 기준점으로 계산 -> 비트 타이밍 불안정
- 체감: 메트로놈 클릭 간격이 불규칙하게 느껴짐

**증상 2: 음악-메트로놈 위치 불일치 (Desync)**
- `sourcePosition`은 SoundTouch가 디코드한 위치를 반영 (읽기 위치)
- 실제 스피커에서 출력되는 위치와 ~93ms 차이
- 체감: 메트로놈이 음악보다 약간 앞서거나 뒤처짐

**증상 3: 시작 지점 정렬 실패**
- `setBeats()` 호출 시 `nextBeatIndex = 0` 리셋
- 이후 `syncToPlaybackTime()`에서 `sourceTime !== lastSourceTime` 조건 충족까지 최대 93ms 대기
- 체감: 메트로놈 시작 시 첫 비트 타이밍 부정확

### 2.3 현재 아키텍처 (정상 동작하는 부분)

다음은 변경하지 않는다:

- Web Worker + Lookahead Scheduler (Chris Wilson 패턴) - 정확
- OscillatorNode 클릭 생성 + 엔벨로프 - 정확
- Backend madmom BPM/beats 감지 - 정확
- 이진 검색 비트 인덱스 탐색 - 정확
- 원본 시간 좌표계 비트 타임스탬프 - 정확
- 메트로놈 오디오: SoundTouch 파이프라인 우회 (독립 GainNode) - 정확

---

## 3. 유저 스토리 (EARS)

### US-1: 시간 보간으로 연속적 재생 시간 추정 -- IMPLEMENTED

**While** ScriptProcessorNode의 sourcePosition이 ~93ms 간격으로만 업데이트되는 상태에서, **when** MetronomeEngine이 syncToPlaybackTime()을 호출받으면, **the system SHALL** 마지막 sourcePosition 업데이트 이후의 `audioContext.currentTime` 경과량에 현재 속도를 곱하여 보간된 재생 시간을 추정하고, 이를 비트 스케줄링의 기준으로 사용한다.

**수용 기준:**
- AC-1.1: `interpolatedSourceTime = lastKnownSourceTime + (audioContext.currentTime - lastSyncAcTime) * currentSpeed`
- AC-1.2: sourcePosition이 실제 업데이트되면 보간 기준점을 새 값으로 리셋
- AC-1.3: 보간 결과가 오디오 전체 길이를 초과하지 않도록 클램핑
- AC-1.4: 비트 스케줄링 시 보간된 시간 기준으로 `scheduleTime` 계산
- AC-1.5: 메트로놈 지터가 5ms 이하로 감소 (현재 ~93ms 변동 -> 목표 <5ms)

### US-2: 속도 변경 시 즉시 동기화 기준점 갱신 -- IMPLEMENTED

**When** 사용자가 재생 속도를 변경하면, **the system SHALL** 다음 sourcePosition 업데이트를 기다리지 않고 즉시 `syncedAcTime`과 보간 기준점을 현재 시점으로 갱신하여 속도 변경이 다음 스케줄러 사이클(25ms 이내)에 반영되도록 한다.

**수용 기준:**
- AC-2.1: AudioEngine.setSpeed() 호출 시 속도 변경 이벤트를 MetronomeEngine에 전달
- AC-2.2: MetronomeEngine이 속도 변경을 수신하면 즉시 보간 기준점 갱신
- AC-2.3: 속도 변경 후 다음 스케줄러 tick(25ms 이내)에서 새 속도 기반 스케줄링
- AC-2.4: 속도 변경 전후로 이미 스케줄된 비트는 중복 재생되지 않음
- AC-2.5: 속도 변경 적응 시간 25ms 이하 (다음 스케줄러 사이클)

### US-3: 버퍼 크기 최적화 (선택적) -- DEFERRED

> 보간(US-1)으로 지터가 충분히 감소하여 버퍼 크기 변경 없이 4096 유지. 향후 필요 시 재검토.

**Where** ScriptProcessorNode 버퍼 크기 감소가 가능한 경우, **the system SHALL** 버퍼를 4096에서 2048 샘플로 줄여 sourcePosition 업데이트 간격을 ~93ms에서 ~46ms로 단축하여 보간 오차 상한을 50% 감소시킨다.

**수용 기준:**
- AC-3.1: `SCRIPT_BUFFER_SIZE` 상수를 2048로 변경
- AC-3.2: CPU 사용률 모니터링: 2048 적용 후 오디오 글리치 없음 확인
- AC-3.3: 4096으로의 롤백 경로 보장 (상수 변경만으로 복원)
- AC-3.4: 저사양 디바이스에서 테스트 필요 (모바일 브라우저 포함)
- AC-3.5: CPU 증가가 허용 범위 초과 시 4096 유지

### US-4: AudioWorklet 마이그레이션 준비 (선택적) -- DEFERRED

> 장기 목표로 유지. 현재 보간 + One-Time Anchor 패턴으로 충분한 정밀도 확보.

**Where** ScriptProcessorNode에서 AudioWorklet으로의 마이그레이션이 가능한 경우, **the system SHALL** AudioWorklet 기반 SoundTouch 처리로 전환하여 오디오 처리를 별도 스레드로 이동하고 더 정밀한 타이밍 제어를 확보한다.

**수용 기준:**
- AC-4.1: AudioWorkletProcessor로 SoundTouch 처리 이전
- AC-4.2: AudioWorkletNode에서 sourcePosition을 포트 메시지로 메인 스레드에 전달
- AC-4.3: 기존 AudioEngine 공개 API 하위 호환성 유지
- AC-4.4: 메트로놈 동기화 로직의 변경 최소화
- AC-4.5: AudioWorklet 미지원 브라우저에서 ScriptProcessorNode 폴백

### US-5: Downbeat 감지 개선 (선택적) -- CANCELLED

> madmom이 마디 시작(downbeat)을 신뢰성 있게 감지하지 못하므로, 강박/약박 구분 자체를 제거하는 방향으로 결정. 모든 비트에 동일한 클릭음(440Hz)을 사용. `nextBeatIndex % 4 === 0` 하드코딩도 제거 완료.

**Where** 백엔드에서 다운비트 정보를 제공할 수 있는 경우, **the system SHALL** madmom `DBNDownBeatTrackingProcessor`로 다운비트 위치를 감지하여 메트로놈의 강박/약박 구분을 정확하게 한다.

**수용 기준:**
- AC-5.1: POST /api/v1/bpm/analyze 응답에 `downbeats: number[]` 필드 추가
- AC-5.2: 다운비트 위치에서 880Hz(강박), 그 외에서 440Hz(약박) 재생
- AC-5.3: 현재 `nextBeatIndex % 4 === 0` 하드코딩 제거
- AC-5.4: 다운비트 미제공 시 기존 `% 4` 로직으로 폴백
- AC-5.5: 변박(time signature 변경) 구간에서도 정확한 강박 표시

---

## 4. 기술 아키텍처

### 4.1 시간 보간 레이어 설계

```
기존 흐름:
  AudioEngine.getCurrentTime()
    = simpleFilter.sourcePosition / sampleRate  (93ms마다 계단식 업데이트)
    |
    v
  MetronomeEngine.syncToPlaybackTime(sourceTime, speed)
    if (sourceTime !== lastSourceTime) -> 기준점 갱신
    else -> stale 기준점 사용 (드리프트 발생)

개선 흐름:
  AudioEngine.getCurrentTime()
    = simpleFilter.sourcePosition / sampleRate  (93ms마다 업데이트)
    |
    v
  MetronomeEngine.syncToPlaybackTime(sourceTime, speed)
    sourceTime 변경 감지 -> 보간 앵커 포인트 갱신:
      anchorSourceTime = sourceTime
      anchorAcTime = audioContext.currentTime
    |
    보간 계산 (항상):
      elapsed = audioContext.currentTime - anchorAcTime
      interpolatedTime = anchorSourceTime + elapsed * speed
    |
    v
  scheduleTick()에서 interpolatedTime 기반 스케줄링
```

### 4.2 MetronomeEngine 변경 사항

```typescript
// 기존 상태 (제거/변경)
private currentSourceTime = 0
private syncedAcTime = 0
private lastSourceTime = -1

// 새 상태 (추가)
private anchorSourceTime = 0     // 마지막 sourcePosition 업데이트 시점의 원본 시간
private anchorAcTime = 0         // 마지막 sourcePosition 업데이트 시점의 AudioContext 시간
private currentSpeed = 1.0       // (유지)

// 보간 메서드 (신규)
private getInterpolatedTime(): number {
  const elapsed = this.audioContext.currentTime - this.anchorAcTime
  return this.anchorSourceTime + elapsed * this.currentSpeed
}
```

### 4.3 속도 변경 이벤트 전파

```
AudioEngine.setSpeed(newSpeed)
  |
  +-> this.soundtouch.tempo = newSpeed
  |
  +-> speedChangeListeners 호출 (신규)
        |
        v
      MetronomeEngine.onSpeedChange(newSpeed, currentSourceTime)
        -> anchorSourceTime = getInterpolatedTime()  // 현재 보간 위치를 새 앵커로
        -> anchorAcTime = audioContext.currentTime
        -> currentSpeed = newSpeed
        -> scheduledBeats.clear()  // 속도 변경으로 기존 스케줄 무효화
```

### 4.4 개선된 scheduleTick 로직

```typescript
private scheduleTick(): void {
  if (!this.isRunning) return

  const now = this.audioContext.currentTime
  const interpolatedTime = this.getInterpolatedTime()  // 보간된 현재 시간

  while (this.nextBeatIndex < this.beats.length) {
    const beatOriginalTime = this.beats[this.nextBeatIndex]

    // 보간된 시간 기준으로 AudioContext 스케줄 시간 계산
    const deltaOriginal = beatOriginalTime - interpolatedTime
    const scheduleTime = now + deltaOriginal / this.currentSpeed

    // 과거 비트 건너뛰기
    if (scheduleTime < now) {
      this.nextBeatIndex++
      continue
    }

    // Lookahead 윈도우 초과 시 중단
    if (scheduleTime > now + this.scheduleAheadTime) {
      break
    }

    // 중복 방지 및 클릭 스케줄링
    if (!this.scheduledBeats.has(this.nextBeatIndex)) {
      this._scheduleClick(scheduleTime, ...)
      this.scheduledBeats.add(this.nextBeatIndex)
    }

    this.nextBeatIndex++
  }
}
```

### 4.5 AudioEngine 확장 (속도 변경 리스너)

```typescript
// AudioEngine에 추가
private speedChangeListeners: Set<(speed: number, sourceTime: number) => void> = new Set()

addSpeedChangeListener(listener: (speed: number, sourceTime: number) => void): void
removeSpeedChangeListener(listener: (speed: number, sourceTime: number) => void): void

setSpeed(speed: number): void {
  // ... 기존 로직 ...
  // 속도 변경 리스너에 알림
  const currentTime = this.getCurrentTime()
  for (const listener of this.speedChangeListeners) {
    listener(clampedSpeed, currentTime)
  }
}
```

---

## 5. 파일 영향 분석

### 5.1 수정 파일 (DDD)

| 파일 | 변경 내용 | 위험도 | 예상 변경량 |
|------|----------|--------|-----------|
| `src/core/MetronomeEngine.ts` | 시간 보간 레이어 추가, syncToPlaybackTime/scheduleTick 리팩토링 | 높음 | ~60줄 변경 |
| `src/core/AudioEngine.ts` | speedChangeListener 추가, SCRIPT_BUFFER_SIZE 변경 (선택) | 중간 | ~25줄 추가 |
| `src/hooks/useMetronome.ts` | speedChangeListener 등록/해제 | 낮음 | ~15줄 추가 |

### 5.2 신규 파일 (TDD) - US-5 구현 시에만

| 파일 | 용도 | 예상 라인 |
|------|------|----------|
| `backend/app/services/bpm_service.py` (수정) | DBNDownBeatTrackingProcessor 추가 | ~30줄 추가 |

### 5.3 테스트 파일

| 파일 | 내용 |
|------|------|
| `tests/unit/MetronomeEngine.test.ts` (수정) | 보간 정확도, 속도 변경 동기화 테스트 추가 |
| `tests/e2e/bpm-metronome.spec.ts` (수정) | 드리프트 테스트 시나리오 추가 |

---

## 6. 비기능 요구사항

| 항목 | 현재 (SPEC-BPM-001) | 목표 (SPEC-BPM-002) |
|------|---------------------|---------------------|
| 메트로놈 지터 | ~93ms 변동 | < 5ms |
| Seek 재동기화 | < 100ms | < 50ms |
| 속도 변경 적응 | ~93ms (다음 sourcePosition) | < 25ms (다음 스케줄러 사이클) |
| 장시간 드리프트 | 누적 가능 | 5분 이상 재생에서 감지 불가능 |
| CPU 오버헤드 | < 2% | < 3% (보간 계산 추가) |
| 하위 호환성 | - | 기존 API 100% 유지 |

---

## 7. 리스크 및 완화

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|----------|
| 보간 누적 오차 | 중간 | 중간 | 93ms마다 sourcePosition으로 앵커 리셋. 보간은 최대 93ms(4096) 또는 46ms(2048) 동안만 유효 |
| 버퍼 2048 오디오 글리치 | 중간 | 높음 | 상수 변경만으로 롤백 가능. 저사양 디바이스 우선 테스트 |
| AudioWorklet 호환성 | 낮음 | 중간 | ScriptProcessorNode 폴백 경로 유지. Safari/Firefox 테스트 |
| 속도 변경 중 비트 중복 | 낮음 | 낮음 | scheduledBeats Set으로 중복 방지. 속도 변경 시 Set 초기화 |
| SoundTouch sourcePosition 지연 | 높음 | 중간 | 보간으로 완화. sourcePosition은 디코드 위치이므로 출력 위치와 본질적 차이 존재. 보간이 이 차이를 좁힘 |

---

## 8. 대안 평가

### 8.1 시간 동기화 전략

| 기준 | 보간 (선택) | 버퍼 크기만 감소 | AudioWorklet 전면 전환 |
|------|-----------|----------------|---------------------|
| 구현 복잡도 | 중간 | 낮음 | 높음 |
| 효과 | 지터 93ms -> <5ms | 지터 93ms -> ~46ms | 지터 -> <1ms |
| CPU 영향 | 미미 (+보간 연산) | 2배 콜백 빈도 | 별도 스레드 |
| 위험도 | 낮음 | 중간 (글리치 가능) | 높음 (대규모 리팩토링) |
| 하위 호환성 | 완전 | 완전 | ScriptProcessorNode 폴백 필요 |
| 권장 | 1순위 | 2순위 (보간과 병행) | 3순위 (장기 목표) |

**결론:** 보간을 1순위로 구현하고, 버퍼 크기 감소는 선택적으로 적용. AudioWorklet은 장기 마이그레이션 목표.

### 8.2 속도 변경 전파 방식

| 기준 | 전용 리스너 (선택) | 폴링 기반 | Zustand 구독 |
|------|-----------------|----------|------------|
| 지연 | <1ms (직접 호출) | 25ms (Worker tick) | ~16ms (React 렌더 사이클) |
| 결합도 | AudioEngine -> MetronomeEngine | 없음 | Store 의존 |
| 복잡도 | 낮음 | 낮음 | 중간 |

**결론:** AudioEngine에 speedChangeListener 패턴 추가 (기존 timeListener/seekListener 패턴과 일관성)

---

## 9. 제약사항

### 기술 제약
- `simpleFilter.sourcePosition`은 SoundTouch의 내부 디코드 포인터로, 변경 불가
- ScriptProcessorNode는 deprecated이지만 현재 soundtouchjs가 의존. 즉시 제거 불가
- AudioWorklet에서 soundtouchjs 직접 사용 불가 (메인 스레드 API 의존). wasm 포팅 필요
- 보간은 일정 속도(constant rate) 가정. 속도 변경 중간에는 앵커 리셋 필요

### 플랫폼 제약
- 기존 SPEC-BPM-001의 모든 플랫폼 제약 유지
- 버퍼 2048 사용 시 모바일 Safari에서 추가 테스트 필요

### 하위 호환성
- MetronomeEngine 공개 API (`setBeats`, `setVolume`, `start`, `stop`, `syncToPlaybackTime`, `seekTo`, `dispose`) 유지
- AudioEngine 공개 API 유지, 새 리스너 메서드만 추가
- bpmStore 인터페이스 변경 없음

---

## 10. 범위 외

- AudioWorklet 전면 마이그레이션 (US-4는 준비/설계까지만)
- soundtouchjs를 WebAssembly로 포팅
- 수동 BPM/오프셋 오버라이드 UI
- 템포 맵 시각화
- 클릭 사운드 커스터마이징
- 박자표(time signature) 감지 UI
- 메트로놈 시각적 피드백 (깜빡임/애니메이션)

---

## 구현 노트

### 구현 완료 커밋

| 커밋 | 날짜 | 설명 |
|------|------|------|
| e837ba5 | 2026-02-18 | feat(audio): 메트로놈 오디오 파이프라인 최적화 - React 지연 제거 |
| dce2f2d | 2026-02-18 | docs: SPEC-BPM-001 완료 문서 동기화 |

### 구현 항목 요약

**US-1 (시간 보간) - IMPLEMENTED:**
- MetronomeEngine에 `anchorSourceTime`/`anchorAcTime` 앵커 포인트 도입
- `getInterpolatedTime()` 메서드로 93ms 계단식 업데이트 사이 연속적 시간 추정
- scheduleTick()에서 보간된 시간 기반 스케줄링

**US-2 (속도 변경 즉시 동기화) - IMPLEMENTED:**
- AudioEngine에 `speedChangeListeners` + `addSpeedChangeListener()`/`removeSpeedChangeListener()` 추가
- MetronomeEngine에 `onSpeedChange()` 메서드 추가: 보간 앵커 즉시 갱신 + scheduledBeats 초기화
- useMetronome 훅에서 speedChangeListener 등록/해제

**One-Time Anchor 패턴 (추가 최적화):**
- AudioEngine에 `needsAnchorSync` 플래그 도입
- play/seek 시에만 1회 앵커 동기화 (매 ~93ms 버퍼 대신)
- rAF 루프에서 timeListeners 호출 제거 (~16ms 지터 원인 제거)

**playStateListeners 추가 (음원 transport 연동):**
- AudioEngine에 `playStateListeners` Set 추가
- play() -> true, pause()/stop() -> false 호출
- useMetronome에서 `audioIsPlaying` 상태 추적, 메트로놈 활성화 조건에 반영

**비트 간격 스무딩 (`_smooth_beats` 함수):**
- bpm_service.py에 이동 중앙값 필터 (window=8) 추가
- madmom 인트로 구간 바운싱 제거

**동일 클릭음 결정 (US-5 취소 배경):**
- madmom `DBNDownBeatTrackingProcessor`의 downbeat 감지 정확도가 불충분
- 강박/약박 구분이 오히려 사용자에게 오해를 줄 수 있음
- 모든 비트에 동일한 440Hz 클릭음 사용으로 결정
- `nextBeatIndex % 4 === 0` 하드코딩 제거 완료

---

*Generated by MoAI SPEC Builder (manager-spec)*
*SPEC date: 2026-02-17*
*Implementation completed: 2026-02-18*
*Predecessor: SPEC-BPM-001 (Completed)*
