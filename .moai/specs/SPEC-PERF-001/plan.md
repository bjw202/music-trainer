---
id: SPEC-PERF-001
document: plan
version: "2.0.0"
---

# SPEC-PERF-001 구현 계획: SoundTouch Web Worker 오프로딩

## 1. 기술 접근 방식

### 1.1 핵심 전략

SoundTouch 오디오 처리를 Web Worker로 완전히 분리하여 메인 스레드 블로킹을 제거한다. Transferable Objects를 활용하여 메인 스레드와 Worker 간 데이터 전송 시 메모리 복사 오버헤드를 없앤다.

### 1.2 기술 스택

| 기술                   | 역할                                        | 비고                                           |
| ---------------------- | ------------------------------------------- | ---------------------------------------------- |
| Web Worker API         | SoundTouch 처리를 별도 스레드에서 수행        | `type: 'module'` ESM Worker 사용                |
| Vite 6 Worker 번들링    | Worker 파일을 자동으로 번들 및 URL 생성       | `new URL(..., import.meta.url)` 패턴            |
| Transferable Objects   | Float32Array 채널 데이터 zero-copy 전송       | ArrayBuffer 소유권 이전 방식                     |
| soundtouch-ts          | 속도/피치 변환 알고리즘                       | pure TypeScript, Worker 내 import 가능           |
| crypto.randomUUID()    | 요청 고유 식별자 생성                         | 요청 취소 및 응답 매칭용                          |

### 1.3 Worker 메시지 프로토콜 설계

```typescript
// src/types/worker-messages.ts

/** 메인 스레드 -> Worker 요청 타입 */
export type SoundTouchWorkerRequest = {
  type: 'process'
  requestId: string
  channelData: Float32Array[]
  sampleRate: number
  numberOfChannels: number
  speed: number
  pitch: number
}

/** Worker -> 메인 스레드 응답 타입 (Union) */
export type SoundTouchWorkerResponse =
  | {
      type: 'complete'
      requestId: string
      processedChannelData: Float32Array[]
      processedLength: number
    }
  | {
      type: 'error'
      requestId: string
      error: string
    }
  | {
      type: 'cancelled'
      requestId: string
    }
```

### 1.4 아키텍처 변경 개요

```
[변경 전]
useSpeedPitch (200ms debounce)
  -> AudioEngine.setSpeed/setPitch()
    -> rebuildProcessedBuffer()
      -> processBuffer() [메인 스레드, 동기, 2-5초 블로킹]
        -> SoundTouch 처리

[변경 후]
useSpeedPitch (30-50ms debounce 또는 제거)
  -> AudioEngine.setSpeed/setPitch()
    -> requestWorkerProcessing()
      -> Worker.postMessage() [비동기, 즉시 반환]
        -> soundtouch.worker.ts [별도 스레드]
          -> SoundTouch 처리
          -> postMessage(result) [Transferable]
    -> onWorkerComplete()
      -> 버퍼 교체 + 재생 위치 복원
```

---

## 2. 마일스톤

### M1: Web Worker 생성 + 메시지 프로토콜 (Primary Goal)

**목표:** Worker 파일 생성, 메시지 타입 정의, 기본 통신 검증

**작업 내역:**

1. `src/types/worker-messages.ts` 생성
   - `SoundTouchWorkerRequest` 타입 정의
   - `SoundTouchWorkerResponse` 유니온 타입 정의

2. `src/core/workers/soundtouch.worker.ts` 생성
   - soundtouch-ts import 및 Worker 컨텍스트 설정
   - `onmessage` 핸들러 구현
   - 인터리브/디인터리브 로직 (현재 `soundtouch-processor.ts` 로직 이식)
   - `requestId` 기반 취소 메커니즘
   - Transferable Objects로 결과 반환
   - 에러 핸들링 (try-catch + error 메시지 전송)

3. 기본 통신 검증
   - Worker 생성 가능 여부 확인
   - postMessage / onmessage 라운드트립 테스트

**산출물:**
- `src/types/worker-messages.ts` (NEW)
- `src/core/workers/soundtouch.worker.ts` (NEW)

**의존성:** 없음

---

### M2: AudioEngine 리팩터링 (Primary Goal)

**목표:** AudioEngine을 Worker 기반 비동기 처리로 전환

**작업 내역:**

1. Worker 생명주기 관리
   - `AudioEngine` 생성자 또는 `init()` 시점에 Worker 인스턴스 생성
   - `dispose()` 시 Worker terminate
   - Worker 생성 실패 시 폴백 플래그 설정

2. `rebuildProcessedBuffer()` 리팩터링
   - 동기 `processBuffer()` 호출을 Worker `postMessage()`로 교체
   - `latestRequestId` 추적 필드 추가
   - 바이패스 모드 (speed=1.0, pitch=0) 유지

3. Worker 응답 처리 (`onWorkerComplete`)
   - `requestId` 매칭 검증 (stale 응답 무시)
   - Float32Array 데이터 -> AudioBuffer 변환 (메인 스레드에서 수행)
   - 재생 위치 보존 및 버퍼 교체
   - 재생 중이었다면 새 버퍼로 자동 재개

4. `setSpeed()` / `setPitch()` 메서드 수정
   - `requestAnimationFrame` + `setTimeout` 패턴 제거
   - 직접 `requestWorkerProcessing()` 호출
   - 요청 중복 방지 (동일 speed/pitch 체크)

**산출물:**
- `src/core/AudioEngine.ts` (MODIFY)

**의존성:** M1 완료 필요

---

### M3: useSpeedPitch 디바운스 축소 (Secondary Goal)

**목표:** UI 응답성 개선을 위한 디바운스 시간 최적화

**작업 내역:**

1. 디바운스 시간 조정
   - 현재 200ms -> 30~50ms로 축소 또는 완전 제거
   - Worker 비동기 처리 덕분에 메인 스레드 부하 없음
   - 빠른 연속 조작은 requestId 기반 취소가 처리

2. 에러 핸들링 개선
   - Worker 에러 시 사용자 피드백 (선택적)

**산출물:**
- `src/hooks/useSpeedPitch.ts` (MODIFY)

**의존성:** M2 완료 필요

---

### M4: soundtouch-processor 정리 (Secondary Goal)

**목표:** 기존 동기 처리 모듈을 폴백 전용으로 정리

**작업 내역:**

1. 폴백 역할 명시
   - JSDoc 주석 업데이트: "폴백 전용, 일반적으로 Worker에서 처리됨"
   - export는 유지 (AudioEngine 폴백 경로에서 사용)

2. 코드 정리
   - 불필요한 주석 정리
   - 폴백 사용 시 console.warn 로깅 추가 (디버깅용)

**산출물:**
- `src/core/worklets/soundtouch-processor.ts` (MODIFY)

**의존성:** M2 완료 필요

---

### M5: 에러 핸들링 + 폴백 + 선택 기능 (Final Goal)

**목표:** 견고한 에러 처리 및 선택적 UI 피드백

**작업 내역:**

1. Worker 에러 폴백 구현
   - Worker 생성 실패 -> `useFallback = true` 플래그 설정
   - Worker 런타임 에러 -> 해당 요청만 동기 폴백 처리
   - 폴백 발생 시 console.warn 경고

2. (Optional) 로딩 인디케이터
   - Worker 처리 중 상태를 AudioEngine에서 노출
   - `isProcessing` getter 또는 콜백 추가
   - Player.tsx에서 처리 중 표시 (선택적 구현)

3. (Optional) 진행률 피드백
   - Worker에서 progress 메시지 전송 (큰 파일 처리 시)
   - UI에서 진행률 표시

**산출물:**
- `src/core/AudioEngine.ts` (MODIFY - 폴백 로직)
- `src/core/worklets/soundtouch-processor.ts` (MODIFY - 폴백 로깅)
- `src/components/Player/Player.tsx` (MODIFY - 선택적, 로딩 UI)

**의존성:** M2, M4 완료 필요

---

## 3. 마일스톤 의존성 그래프

```
M1 (Worker + 프로토콜)
 |
 v
M2 (AudioEngine 리팩터링)
 |
 +---> M3 (디바운스 축소)
 |
 +---> M4 (soundtouch-processor 정리)
 |      |
 +------+
 |
 v
M5 (에러 핸들링 + 폴백 + 선택 기능)
```

---

## 4. 리스크 분석 및 완화 전략

| ID     | 리스크                                        | 확률 | 영향도 | 완화 전략                                                                      |
| ------ | --------------------------------------------- | ---- | ------ | ----------------------------------------------------------------------------- |
| RSK-01 | soundtouch-ts Worker 호환성 문제               | 낮음 | 높음   | pure TypeScript 라이브러리로 DOM 의존성 없음. M1에서 조기 검증 수행              |
| RSK-02 | 빠른 연속 조작 시 race condition               | 중간 | 중간   | requestId 기반 무효화 + latestRequestId 비교로 stale 응답 무시                  |
| RSK-03 | Transferable Objects 소유권 이전 후 버그        | 중간 | 중간   | 전송 직후 원본 참조 제거, TypeScript 타입으로 소유권 이전 문서화                   |
| RSK-04 | Worker 생성 실패 (CSP 제한 등)                  | 낮음 | 높음   | REQ-S-003 폴백 메커니즘으로 메인 스레드 동기 처리 보장                            |
| RSK-05 | 큰 파일(10분+) 처리 시 Worker에서도 긴 처리 시간 | 낮음 | 낮음   | Worker에서 처리하므로 UI 영향 없음. 선택적으로 progress 피드백 구현 (REQ-O-002)   |
| RSK-06 | Vite Worker 번들링 이슈                         | 낮음 | 중간   | `new URL(..., import.meta.url)` 공식 패턴 사용, Vite 문서 준수                  |

---

## 5. 기술적 고려사항

### 5.1 Transferable Objects 사용 패턴

```typescript
// 메인 스레드 -> Worker 전송
const channelData = [leftChannel, rightChannel]
const transferables = channelData.map(ch => ch.buffer)
worker.postMessage(request, transferables)
// 전송 후 channelData의 ArrayBuffer는 neutered (접근 불가)

// Worker -> 메인 스레드 반환
const transferables = processedChannelData.map(ch => ch.buffer)
self.postMessage(response, transferables)
```

### 5.2 AudioBuffer 생성 제약

Worker 내에서는 `AudioContext`를 사용할 수 없으므로:
- Worker는 처리된 `Float32Array[]` 채널 데이터만 반환
- 메인 스레드에서 `context.createBuffer()`로 `AudioBuffer` 생성
- 채널 데이터를 `AudioBuffer.copyToChannel()`로 복사

### 5.3 메모리 관리

- Worker 처리 중 원본 버퍼와 처리된 버퍼가 동시에 메모리에 존재
- 스테레오 44.1kHz 5분 곡 기준: ~50MB (원본) + ~50MB (처리 중) = 최대 ~100MB
- 처리 완료 후 이전 processedBuffer는 GC 대상
- Worker 자체 메모리는 별도 관리 (Worker terminate 시 해제)

### 5.4 바이패스 모드 최적화

speed === 1.0 이고 pitch === 0 일 때:
- Worker 호출 건너뜀
- processedBuffer를 null로 설정
- 원본 buffer를 직접 재생
- 이 로직은 현재 구현과 동일하게 유지

---

## 6. 추적성 태그

- SPEC: `SPEC-PERF-001`
- 요구사항: `REQ-U-001` ~ `REQ-O-002`
- 수용 기준: `ACC-U-001` ~ `ACC-O-002` (acceptance.md 참조)

---

## 7. Implementation Reality (실제 구현 결과)

### 7.1 마일스톤별 실제 대응

#### M1: Web Worker 생성 + 메시지 프로토콜 -> 미구현 (대체됨)

**원래 계획:** `soundtouch.worker.ts` 및 `worker-messages.ts` 생성, Worker 통신 검증

**실제 결과:** 아키텍처가 실시간 스트리밍으로 전환되어 Web Worker 자체가 불필요해졌다. Worker 파일, 메시지 타입 정의, 통신 프로토콜 모두 구현하지 않았다.

**대체 구현:** soundtouchjs 라이브러리를 설치하고 `src/types/soundtouchjs.d.ts` 타입 선언 파일을 작성하여 TypeScript 통합을 완료했다.

---

#### M2: AudioEngine 리팩터링 -> 전면 재작성 (방식 변경)

**원래 계획:** Worker 기반 비동기 처리로 전환, `rebuildProcessedBuffer()` 리팩터링, Worker 응답 처리

**실제 결과:** AudioEngine.ts를 전면 재작성하여 soundtouchjs 기반 실시간 스트리밍 아키텍처를 구현했다.

**주요 변경 내역:**

- `processBuffer()` / `rebuildProcessedBuffer()` 메서드 제거
- SoundTouch + SimpleFilter + ScriptProcessorNode 파이프라인 구축
- `onaudioprocess` 콜백 내에서 ~4096 샘플 단위 실시간 처리
- `soundtouch.tempo` / `soundtouch.pitchSemitones` 속성으로 즉각적 파라미터 반영
- `simpleFilter.sourcePosition / sampleRate` 기반 정확한 시간 추적
- `toProcessedTime()` / `fromProcessedTime()` 변환 로직 제거

---

#### M3: useSpeedPitch 디바운스 축소 -> 단순화 (디바운스 완전 제거)

**원래 계획:** 디바운스 200ms -> 30~50ms 축소 또는 제거

**실제 결과:** 디바운스를 완전히 제거했다. 실시간 스트리밍 방식에서는 파라미터 변경이 즉시 반영되므로 디바운스가 전혀 필요하지 않다. useSpeedPitch 훅이 크게 단순화되었다.

---

#### M4: soundtouch-processor 정리 -> 삭제

**원래 계획:** 폴백 전용으로 역할 변경, JSDoc 주석 업데이트

**실제 결과:** `soundtouch-processor.ts` 파일 자체를 삭제했다. soundtouchjs 실시간 스트리밍 방식으로 전환하면서 기존 처리 모듈이 완전히 대체되었기 때문이다. `worklets/` 디렉토리도 함께 제거했다.

---

#### M5: 에러 핸들링 + 폴백 + 선택 기능 -> 해당 없음

**원래 계획:** Worker 에러 폴백 구현, 로딩 인디케이터, 진행률 피드백

**실제 결과:** Worker를 사용하지 않으므로 Worker 에러 폴백 메커니즘이 불필요해졌다. 실시간 처리 방식에서는 "처리 중" 상태 자체가 존재하지 않아 로딩 인디케이터나 진행률 피드백도 불필요하다.

---

### 7.2 실제 파일 변경 목록

#### 수정된 파일

| 파일                                  | 변경 유형       | 변경 내용                                               |
| ------------------------------------- | -------------- | ------------------------------------------------------- |
| `src/core/AudioEngine.ts`            | 전면 재작성     | soundtouchjs 기반 실시간 스트리밍 아키텍처로 완전 교체    |
| `src/hooks/useSpeedPitch.ts`         | 단순화         | 디바운스 완전 제거, 직접 AudioEngine 메서드 호출          |
| `src/components/Player/Player.tsx`   | UI 업데이트     | 키보드 단축키 힌트 텍스트 갱신                           |
| `src/components/Player/SpeedControl.tsx` | UI 변경     | 슬라이더 -> +/- 버튼, 0.01 단위 정밀 제어               |
| `src/components/Player/PitchControl.tsx` | UI 변경     | 슬라이더 -> +/- 버튼                                    |

#### 신규 생성 파일

| 파일                                  | 역할                                                    |
| ------------------------------------- | ------------------------------------------------------- |
| `src/types/soundtouchjs.d.ts`        | soundtouchjs 라이브러리 TypeScript 타입 선언              |

#### 삭제된 파일

| 파일                                          | 삭제 이유                                   |
| --------------------------------------------- | ------------------------------------------- |
| `src/core/workers/soundtouch.worker.ts`       | 실시간 스트리밍으로 Worker 불필요             |
| `src/core/worklets/soundtouch-processor.ts`   | soundtouchjs로 완전 대체                     |
| `src/types/worker-messages.ts`                | Worker 미사용으로 메시지 타입 불필요           |
| `src/core/workers/` 디렉토리                  | Worker 관련 파일 전체 제거                    |
| `src/core/worklets/` 디렉토리                 | Worklet 관련 파일 전체 제거                   |

### 7.3 실제 구현된 아키텍처

```
[원래 계획]
AudioBuffer -> Worker(SoundTouch, 전체 버퍼) -> processedBuffer -> AudioBufferSourceNode
  - 메인 스레드: postMessage(channelData, [transferables])
  - Worker: SoundTouch 처리 (수초 소요)
  - 메인 스레드: onmessage -> AudioBuffer 생성 -> 재생 재개

[실제 구현]
WebAudioBufferSource
  -> SimpleFilter(SoundTouch 인스턴스)
    -> ScriptProcessorNode (onaudioprocess, ~4096 샘플/콜백)
      -> GainNode
        -> AnalyserNode
          -> AudioContext.destination

  - 파라미터 변경: soundtouch.tempo = speed (즉시 반영)
  - 시간 추적: simpleFilter.sourcePosition / sampleRate (항상 정확)
  - 재처리/통신 오버헤드: 없음
```

### 7.4 원래 계획 대비 개선점

| 측면            | 원래 계획 (Worker 오프라인)         | 실제 구현 (실시간 스트리밍)           |
| --------------- | --------------------------------- | ----------------------------------- |
| 파라미터 반영    | 전체 버퍼 재처리 필요 (수초 대기)   | 즉시 반영 (0ms)                     |
| 메모리 사용      | 원본 + 처리 버퍼 동시 보유 (~100MB) | 원본 버퍼만 보유 (~50MB)             |
| 코드 복잡도      | Worker 프로토콜, 취소 로직, 폴백 등 | 단일 오디오 파이프라인               |
| 시간 추적 정확도 | 복잡한 위치 변환 필요              | sourcePosition 직접 계산             |
| 에러 처리        | Worker 에러 + 폴백 메커니즘 필요   | 표준 Web Audio API 에러 처리만 필요  |
