---
id: SPEC-PERF-001
version: "2.0.0"
status: completed
created: 2026-02-14
updated: 2026-02-15
author: jw
priority: high
---

## HISTORY

| version | date       | author | description                                          |
| ------- | ---------- | ------ | ---------------------------------------------------- |
| 1.0.0   | 2026-02-14 | jw     | SPEC-PERF-001 초기 작성: SoundTouch Web Worker 오프로딩 |
| 2.0.0   | 2026-02-15 | jw     | 구현 완료: 아키텍처 전환 (오프라인 Worker -> 실시간 스트리밍), 라이브러리 변경 (soundtouch-ts -> soundtouchjs) |

---

# SPEC-PERF-001: SoundTouch Web Worker 오프로딩

## 1. 개요

SoundTouch 오디오 처리를 메인 스레드에서 Web Worker로 이전하여 속도/피치 제어 시 발생하는 UI 프리징을 완전히 제거한다.

### 1.1 문제 정의

현재 `AudioEngine.rebuildProcessedBuffer()`에서 `processBuffer()`를 메인 스레드에서 동기적으로 호출하고 있다. SoundTouch의 인터리브 변환, 샘플 처리, 디인터리브 과정이 오디오 파일 크기에 비례하여 2~5초간 메인 스레드를 블로킹하며, 이 동안 모든 UI 인터랙션(버튼 클릭, 슬라이더 조작, 파형 업데이트 등)이 중단된다.

### 1.2 해결 방향

Web Worker를 통해 SoundTouch 처리를 별도 스레드에서 수행하고, Transferable Objects로 메인 스레드와 Worker 간 zero-copy 데이터 전송을 구현한다.

---

## 2. Environment (환경)

| 항목                 | 값                                                  |
| -------------------- | --------------------------------------------------- |
| Runtime              | 브라우저 (Chrome 90+, Firefox 90+, Safari 15+)      |
| 빌드 도구            | Vite 6 (ESM 네이티브, Worker 번들링 지원)           |
| 오디오 처리 라이브러리 | soundtouch-ts (pure TypeScript, Worker 호환)        |
| UI 프레임워크         | React 19 + Zustand                                  |
| 오디오 API           | Web Audio API (AudioContext, AudioBuffer)            |
| 대상 파일 크기        | MP3 3~10분 (일반적인 기타 연습곡 길이)              |

---

## 3. Assumptions (가정)

| ID     | 가정                                                                                        | 신뢰도 | 근거                                                       |
| ------ | ------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| ASM-01 | soundtouch-ts는 pure TypeScript이므로 Web Worker 내에서 import 가능하다                      | 높음    | DOM API 의존성 없음, Worker는 ES Module import 지원         |
| ASM-02 | Vite 6는 `new Worker(new URL(...), { type: 'module' })` 패턴으로 Worker 번들링을 지원한다    | 높음    | Vite 공식 문서 Worker 지원 섹션                             |
| ASM-03 | Transferable Objects (Float32Array.buffer)로 채널 데이터를 zero-copy 전송할 수 있다           | 높음    | Web API 표준, 모든 모던 브라우저 지원                       |
| ASM-04 | Worker 내에서 AudioBuffer를 직접 생성할 수 없다 (AudioContext가 Worker에 없음)                 | 높음    | AudioContext는 메인 스레드 전용 API                         |
| ASM-05 | 3~10분 길이의 MP3 파일에 대한 SoundTouch 처리는 Worker에서 1~3초 내에 완료된다                 | 중간    | 현재 메인 스레드에서 2~5초 소요, Worker에서도 유사한 처리 시간 |
| ASM-06 | 빠른 연속 조작 시 이전 Worker 요청을 requestId 기반으로 무효화할 수 있다                       | 높음    | postMessage 프로토콜 설계로 구현 가능                       |

---

## 4. Requirements (요구사항)

### 4.1 Ubiquitous (항상 적용)

| ID        | 요구사항                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------ |
| REQ-U-001 | SoundTouch 오디오 처리(`processBuffer`)는 **항상** Web Worker에서 수행해야 한다 (폴백 제외)         |
| REQ-U-002 | 처리 중에도 UI 인터랙션은 **항상** 50ms 이내에 응답해야 한다                                       |
| REQ-U-003 | 메인 스레드와 Worker 간 오디오 데이터 전송은 **항상** Transferable Objects로 zero-copy 전송해야 한다 |

### 4.2 Event-Driven (이벤트 기반)

| ID        | 요구사항                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-E-001 | **WHEN** 사용자가 속도를 변경하면 **THEN** Worker에 처리 요청을 전송하고, 완료 시 처리된 버퍼로 교체하여 재생을 재개한다                    |
| REQ-E-002 | **WHEN** 사용자가 피치를 변경하면 **THEN** Worker에 처리 요청을 전송하고, 완료 시 처리된 버퍼로 교체하여 재생을 재개한다                    |
| REQ-E-003 | **WHEN** Worker가 처리 완료 메시지를 전송하면 **THEN** 현재 재생 위치를 보존하면서 처리된 버퍼로 교체한다                                   |
| REQ-E-004 | **WHEN** 사용자가 빠르게 연속으로 속도/피치를 조작하면 **THEN** 이전 처리 요청을 취소하고 최신 요청만 처리한다 (requestId 무효화 방식)       |

### 4.3 State-Driven (상태 기반)

| ID        | 요구사항                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| REQ-S-001 | **IF** Worker가 처리 중이면 **THEN** 기존 버퍼(원본 또는 이전 처리된 버퍼)로 끊김 없이 재생을 유지한다                         |
| REQ-S-002 | **IF** speed === 1.0 이고 pitch === 0 이면 **THEN** 바이패스 모드로 동작하여 Worker 호출을 건너뛴다                            |
| REQ-S-003 | **IF** Worker 생성 또는 실행 중 오류가 발생하면 **THEN** 메인 스레드의 동기 `processBuffer()`로 폴백 처리한다                   |

### 4.4 Unwanted (금지 사항)

| ID        | 요구사항                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| REQ-N-001 | 메인 스레드에서 `processBuffer()`를 직접 호출**하지 않아야 한다** (REQ-S-003 폴백 경우 제외)                              |
| REQ-N-002 | 200ms 이상의 인위적 디바운스를 적용**하지 않아야 한다** (현재 200ms 디바운스를 30~50ms로 축소 또는 제거)                    |
| REQ-N-003 | Transferable Objects로 전송한 후 원본 ArrayBuffer를 참조**하지 않아야 한다** (소유권 이전 후 접근 불가)                     |

### 4.5 Optional (선택 사항)

| ID        | 요구사항                                                                                  |
| --------- | ----------------------------------------------------------------------------------------- |
| REQ-O-001 | **가능하면** Worker 처리 중 로딩 인디케이터를 UI에 표시한다                                  |
| REQ-O-002 | **가능하면** Worker 처리 진행률을 사용자에게 피드백한다                                       |

---

## 5. Specifications (상세 사양)

### 5.1 Worker 메시지 프로토콜

#### 요청 메시지 (메인 -> Worker)

```typescript
interface WorkerProcessRequest {
  type: 'process'
  requestId: string
  channelData: Float32Array[]  // Transferable로 전송
  sampleRate: number
  numberOfChannels: number
  speed: number
  pitch: number
}
```

#### 응답 메시지 (Worker -> 메인)

```typescript
interface WorkerProcessComplete {
  type: 'complete'
  requestId: string
  processedChannelData: Float32Array[]  // Transferable로 반환
  processedLength: number
}

interface WorkerProcessError {
  type: 'error'
  requestId: string
  error: string
}

interface WorkerProcessCancelled {
  type: 'cancelled'
  requestId: string
}
```

### 5.2 파일 구조

| 파일                                        | 변경 유형 | 역할                                       |
| ------------------------------------------- | --------- | ------------------------------------------ |
| `src/core/workers/soundtouch.worker.ts`     | NEW       | SoundTouch 처리를 수행하는 Web Worker        |
| `src/core/AudioEngine.ts`                   | MODIFY    | Worker 통합, 비동기 처리 패턴 적용           |
| `src/hooks/useSpeedPitch.ts`                | MODIFY    | 디바운스 200ms -> 30~50ms 축소 또는 제거     |
| `src/core/worklets/soundtouch-processor.ts` | MODIFY    | 폴백 전용으로 역할 변경, export 유지          |
| `src/types/worker-messages.ts`              | NEW       | Worker 메시지 타입 정의                      |

### 5.3 Worker 생성 패턴 (Vite 호환)

```typescript
const worker = new Worker(
  new URL('./workers/soundtouch.worker.ts', import.meta.url),
  { type: 'module' }
)
```

### 5.4 요청 취소 메커니즘

- 각 요청에 고유 `requestId` (crypto.randomUUID 또는 카운터 기반) 부여
- 새 요청 발생 시 `latestRequestId`를 갱신
- Worker 완료 메시지의 `requestId`가 `latestRequestId`와 불일치하면 결과를 무시
- Worker 내부에서도 처리 시작 전 `requestId` 유효성 확인

### 5.5 성능 목표

| 지표                  | 현재 상태         | 목표              |
| --------------------- | ----------------- | ----------------- |
| UI 프리징             | 2~5초             | 0ms               |
| 속도/피치 변경 응답    | 200ms + 수초 블로킹 | 30~50ms (비동기)  |
| 메인 스레드 블로킹     | 수초              | < 50ms            |
| 메모리 오버헤드        | N/A               | < 10MB 추가       |

---

## 6. Traceability (추적성)

| 요구사항 ID | 마일스톤 | 수용 기준          | 관련 파일                                 |
| ----------- | -------- | ------------------ | ----------------------------------------- |
| REQ-U-001   | M1       | ACC-U-001          | soundtouch.worker.ts                      |
| REQ-U-002   | M2       | ACC-U-002          | AudioEngine.ts                            |
| REQ-U-003   | M1       | ACC-U-003          | soundtouch.worker.ts, AudioEngine.ts      |
| REQ-E-001   | M2       | ACC-E-001          | AudioEngine.ts                            |
| REQ-E-002   | M2       | ACC-E-002          | AudioEngine.ts                            |
| REQ-E-003   | M2       | ACC-E-003          | AudioEngine.ts                            |
| REQ-E-004   | M2, M3   | ACC-E-004          | AudioEngine.ts, useSpeedPitch.ts          |
| REQ-S-001   | M2       | ACC-S-001          | AudioEngine.ts                            |
| REQ-S-002   | M2       | ACC-S-002          | AudioEngine.ts                            |
| REQ-S-003   | M5       | ACC-S-003          | AudioEngine.ts, soundtouch-processor.ts   |
| REQ-N-001   | M2       | ACC-N-001          | AudioEngine.ts                            |
| REQ-N-002   | M3       | ACC-N-002          | useSpeedPitch.ts                          |
| REQ-N-003   | M1       | ACC-N-003          | AudioEngine.ts, soundtouch.worker.ts      |
| REQ-O-001   | M5       | ACC-O-001          | Player.tsx (UI)                           |
| REQ-O-002   | M5       | ACC-O-002          | soundtouch.worker.ts, Player.tsx          |

---

## 7. Implementation Notes (구현 노트)

### 7.1 아키텍처 전환 결정

원래 SPEC에서 계획한 **오프라인 Web Worker 전체 버퍼 처리** 방식은 구현 과정에서 근본적인 문제가 발견되어 **실시간 스트리밍 처리** 방식으로 전면 전환되었다.

#### 7.1.1 원래 계획의 문제점 (3-에이전트 팀 조사 결과)

1. **soundtouch-ts API 오용 문제**: SoundTouch는 스트리밍 프로세서이므로, 단일 `process()` 호출로는 거의 제로에 가까운 출력만 생성된다. 반복적인 루프 호출이 필요한 구조인데, 원래 설계는 이를 고려하지 않았다.
2. **Null 폴백 버그**: `processedBuffer`가 null일 때 원본 버퍼로 폴백하지만, `toProcessedTime()` 변환이 여전히 적용되어 재생 위치가 점프하는 문제가 있었다.
3. **시간 추적 오염**: `getCurrentTime()`이 원본 버퍼 재생 시에도 `elapsed * speed`를 반환하여 실제 재생 위치와 불일치하는 문제가 있었다.

#### 7.1.2 실시간 스트리밍 방식의 장점

- **즉각적인 파라미터 반영**: `soundtouch.tempo = speed`, `soundtouch.pitchSemitones = pitch`로 즉시 적용, 재처리 대기 시간 없음
- **정확한 시간 추적**: `simpleFilter.sourcePosition / sampleRate`로 항상 정확한 원본 기준 위치 계산
- **아키텍처 단순화**: Worker 통신 프로토콜, requestId 관리, Transferable Objects 등 복잡한 메커니즘 불필요
- **메모리 효율성**: 전체 버퍼 사본 불필요, 오디오 콜백당 ~4096 샘플만 처리

### 7.2 라이브러리 변경

| 항목         | 원래 계획                    | 실제 구현                        |
| ------------ | --------------------------- | -------------------------------- |
| 라이브러리    | soundtouch-ts               | soundtouchjs                     |
| 처리 방식     | 오프라인 전체 버퍼 처리       | 실시간 스트리밍 (~4096 샘플/콜백) |
| 파라미터 변경 | 전체 버퍼 재처리 필요         | 즉시 반영                        |
| 시간 추적     | 복잡한 위치 변환 로직 필요    | sourcePosition 기반 직접 계산     |

### 7.3 실제 구현 아키텍처

```
[실제 구현된 아키텍처]
WebAudioBufferSource
  -> SimpleFilter(SoundTouch 인스턴스)
    -> ScriptProcessorNode (onaudioprocess 콜백, ~4096 샘플)
      -> GainNode
        -> AnalyserNode
          -> AudioContext.destination

[파라미터 변경 시]
soundtouch.tempo = newSpeed      // 즉시 반영
soundtouch.pitchSemitones = pitch  // 즉시 반영
// 재처리/Worker 통신 불필요
```

### 7.4 범위 변경 사항

#### 7.4.1 원래 SPEC에서 구현되지 않은 항목

| 항목                               | 이유                                              |
| ---------------------------------- | ------------------------------------------------- |
| Web Worker (soundtouch.worker.ts)  | 실시간 스트리밍 방식으로 Worker 자체가 불필요       |
| worker-messages.ts 타입 정의        | Worker 미사용으로 메시지 프로토콜 불필요            |
| Transferable Objects zero-copy 전송 | Worker 미사용으로 스레드 간 데이터 전송 불필요      |
| requestId 기반 취소 메커니즘         | 즉각적 파라미터 반영으로 요청 취소 개념 불필요      |
| 메인 스레드 폴백 메커니즘            | Worker 미사용으로 폴백 경로 자체가 불필요           |
| 로딩 인디케이터/진행률 (REQ-O-001/002) | 처리가 실시간이므로 별도 로딩 표시 불필요          |

#### 7.4.2 원래 SPEC 범위를 초과하여 구현된 항목

| 항목                                  | 설명                                                        |
| ------------------------------------- | ----------------------------------------------------------- |
| soundtouchjs 실시간 스트리밍 아키텍처  | ScriptProcessorNode 콜백 기반 실시간 처리                    |
| soundtouchjs.d.ts 타입 선언            | soundtouchjs 라이브러리의 TypeScript 타입 정의 파일 신규 작성 |
| SpeedControl.tsx UI 변경               | 슬라이더 -> +/- 버튼 방식으로 변경                           |
| PitchControl.tsx UI 변경               | 슬라이더 -> +/- 버튼 방식으로 변경                           |
| 속도 단계 정밀도 변경                   | 0.1 단위 -> 0.01 단위 (1% 단위 제어)                        |
| Player.tsx 키보드 단축키 힌트 업데이트  | 변경된 UI에 맞춘 안내 텍스트 갱신                            |

### 7.5 SPEC 요구사항 충족 분석

| 요구사항 ID | 원래 의도                        | 실제 달성 여부 | 달성 방식                                          |
| ----------- | ------------------------------- | ------------- | -------------------------------------------------- |
| REQ-U-001   | SoundTouch 처리를 Worker에서 수행 | 대체 달성      | 실시간 스트리밍으로 메인 스레드 블로킹 자체 제거      |
| REQ-U-002   | 처리 중 UI 50ms 이내 응답         | 달성           | 처리가 오디오 콜백 내에서만 발생, UI 블로킹 없음      |
| REQ-U-003   | Transferable Objects 사용         | 해당 없음      | Worker 미사용으로 스레드 간 전송 불필요               |
| REQ-E-001   | 속도 변경 -> Worker 요청 -> 재개   | 대체 달성      | tempo 속성 변경으로 즉시 반영, 재처리 불필요          |
| REQ-E-002   | 피치 변경 -> Worker 요청 -> 재개   | 대체 달성      | pitchSemitones 속성 변경으로 즉시 반영               |
| REQ-E-003   | Worker 완료 -> 재생 위치 보존      | 대체 달성      | 실시간 처리로 위치 변환 자체가 불필요                |
| REQ-E-004   | 빠른 연속 조작 -> 이전 요청 취소   | 대체 달성      | 즉각 반영으로 취소 메커니즘 자체가 불필요            |
| REQ-S-001   | Worker 처리 중 기존 버퍼 재생     | 해당 없음      | 실시간 처리로 "처리 중" 상태 자체가 없음             |
| REQ-S-002   | 바이패스 모드                    | 달성           | speed=1.0, pitch=0 바이패스 로직 유지                |
| REQ-S-003   | Worker 오류 시 폴백              | 해당 없음      | Worker 미사용으로 폴백 경로 불필요                   |
| REQ-N-001   | 메인 스레드 processBuffer 금지   | 대체 달성      | processBuffer 자체가 제거됨 (실시간 처리로 대체)      |
| REQ-N-002   | 200ms 디바운스 금지              | 달성           | 디바운스 완전 제거 (useSpeedPitch 단순화)            |
| REQ-N-003   | Transferable 후 원본 참조 금지   | 해당 없음      | Worker 미사용으로 Transferable Objects 불필요         |

### 7.6 삭제된 파일 및 디렉토리

| 삭제 대상                                        | 이유                                    |
| ------------------------------------------------ | --------------------------------------- |
| `src/core/workers/soundtouch.worker.ts`          | 실시간 스트리밍으로 Worker 불필요        |
| `src/core/worklets/soundtouch-processor.ts`      | soundtouchjs로 대체되어 기존 처리기 불필요 |
| `src/types/worker-messages.ts`                   | Worker 미사용으로 메시지 타입 불필요      |
| `src/core/workers/` 디렉토리                     | Worker 파일 전체 제거                    |
| `src/core/worklets/` 디렉토리                    | Worklet 파일 전체 제거                   |

### 7.7 핵심 기술적 결정 요약

1. **실시간 스트리밍 vs 오프라인 처리**: SoundTouch의 본질적 특성(스트리밍 프로세서)에 맞는 실시간 처리 방식을 채택하여 모든 근본적 문제를 해결했다.
2. **soundtouchjs 선택**: soundtouch-ts 대비 SimpleFilter/ScriptProcessorNode 통합이 자연스러우며, Web Audio API와의 직접적인 연동을 지원한다.
3. **디바운스 완전 제거**: 실시간 파라미터 반영으로 디바운스가 불필요해졌으며, UI 응답성이 극대화되었다.
4. **UI 개선 (버튼 방식)**: 속도/피치 제어를 슬라이더에서 +/- 버튼으로 변경하여 정밀한 값 조정이 가능해졌다 (0.01 단위).
