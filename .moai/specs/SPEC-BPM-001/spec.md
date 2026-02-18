# SPEC-BPM-001: 자동 BPM 감지 및 메트로놈 기능

| 항목 | 내용 |
|------|------|
| SPEC ID | SPEC-BPM-001 |
| 상태 | Completed |
| 작성일 | 2026-02-17 |
| 완료일 | 2026-02-17 |
| 개발 방법론 | Hybrid (신규 파일 TDD, 기존 파일 수정 DDD) |
| 아키텍처 | 하이브리드 (백엔드 madmom 분석 + 프론트엔드 Web Worker Lookahead Scheduler) |

---

## 목차

1. [개요](#1-개요)
2. [유저 스토리 (EARS)](#2-유저-스토리-ears)
3. [기술 아키텍처](#3-기술-아키텍처)
4. [API 계약](#4-api-계약)
5. [파일 영향 분석](#5-파일-영향-분석)
6. [구현 단계](#6-구현-단계)
7. [엣지 케이스](#7-엣지-케이스)
8. [비기능 요구사항](#8-비기능-요구사항)
9. [테스트 전략](#9-테스트-전략)
10. [리스크 및 완화](#10-리스크-및-완화)
11. [대안 평가](#11-대안-평가)
12. [제약사항](#12-제약사항)

---

## 1. 개요

기타 MP3 트레이너에 자동 BPM 감지 및 메트로놈 클릭 기능을 추가한다.

**핵심 흐름:**
1. 사용자가 오디오 파일을 로드하면 백엔드(madmom)가 BPM과 비트 타임스탬프를 분석
2. 분석 결과를 Zustand 스토어에 저장
3. 사용자가 메트로놈을 활성화하면 Web Worker Lookahead Scheduler가 비트 위치에 OscillatorNode 클릭을 스케줄링
4. 속도 변경, Seek, A-B 루프와 자동 동기화

**핵심 설계 원칙:**
- 메트로놈 오디오는 SoundTouch 파이프라인을 우회 (독립 GainNode -> Destination)
- 비트 타임스탬프는 원본 시간 기준 (`simpleFilter.sourcePosition / sampleRate`와 동일)
- 동일 AudioContext 공유 (동기화의 기반)

---

## 2. 유저 스토리 (EARS)

### US-1: 오디오 로드 시 자동 BPM 분석

**When** 사용자가 오디오 파일을 로드하면 (파일 선택, 드래그앤드롭, YouTube 변환), **the system SHALL** 백엔드 BPM 분석 엔드포인트에 자동으로 요청을 보내고 분석 중 로딩 표시를 제공한다.

**수용 기준:**
- AC-1.1: `audioStore.buffer`에 오디오가 로드되면 BPM 분석 요청이 자동 트리거
- AC-1.2: 분석 중 `bpmStore.isAnalyzing === true`이고 UI에 스피너 표시
- AC-1.3: 기존 `apiClient.post()` 패턴으로 `POST /api/v1/bpm/analyze` 호출
- AC-1.4: 오디오 파일은 FormData로 전송 (스템 분리 업로드와 동일 패턴)

### US-2: BPM 결과 표시

**When** BPM 분석이 성공적으로 완료되면, **the system SHALL** 감지된 BPM 값, 신뢰도 점수를 표시하고 비트 타임스탬프를 메트로놈용으로 저장한다.

**수용 기준:**
- AC-2.1: `bpmStore`에 저장: `bpm` (number), `beats` (number[]), `confidence` (0-1)
- AC-2.2: MetronomePanel UI에 BPM 표시 (예: "120.0 BPM")
- AC-2.3: 비트 타임스탬프는 원본 오디오 시간 기준
- AC-2.4: 분석 실패 시 에러 메시지 표시, 메트로놈 비활성 유지

### US-3: 메트로놈 토글 및 클릭 재생

**When** 사용자가 메트로놈 토글을 활성화하고 BPM 데이터가 있으면, **the system SHALL** 오디오 재생 중 감지된 비트 위치에 동기화된 클릭 사운드를 재생한다.

**수용 기준:**
- AC-3.1: Web Worker Lookahead Scheduler (25ms setTimeout 간격, 100ms 스케줄 어헤드 윈도우)
- AC-3.2: OscillatorNode로 클릭 생성 (모든 비트 동일 440Hz, 30ms 지속) - madmom이 마디 시작을 정확히 감지하지 못하므로 강박/약박 구분 제거
- AC-3.3: 메트로놈 오디오: OscillatorNode -> GainNode(metronome) -> Destination (SoundTouch 우회)
- AC-3.4: 음원 재생 중일 때만 클릭 재생 (playStateListeners 연동으로 transport 상태 추적)
- AC-3.5: 메트로놈 비활성화 시 모든 스케줄된 오실레이터 취소

### US-4: 속도 변경 자동 조정

**When** 메트로놈이 활성 상태에서 사용자가 재생 속도를 변경하면, **the system SHALL** 비트 동기화를 유지하도록 메트로놈 타이밍을 자동 조정한다.

**수용 기준:**
- AC-4.1: 스케줄 시간 = `audioContext.currentTime + (beatTime - currentTime) / currentSpeed`
- AC-4.2: 유효 BPM 표시 = `originalBPM * currentSpeed`
- AC-4.3: 비트 타임스탬프는 원본 시간 유지 (재계산 불필요)
- AC-4.4: 속도 변경은 다음 스케줄러 사이클 (25ms 이내) 반영
- AC-4.5: 속도 범위 0.5x-2.0x (기존 `SPEED_PITCH` 상수와 동일)

### US-5: Seek 재동기화

**When** 사용자가 새 위치로 Seek하면 (파형 클릭 또는 방향키), **the system SHALL** 새 위치에서 가장 가까운 다음 비트부터 메트로놈을 재동기화한다.

**수용 기준:**
- AC-5.1: Seek 시 모든 대기 중인 스케줄된 오실레이터 취소
- AC-5.2: 정렬된 `beats[]` 배열에서 이진 검색으로 다음 비트 >= 새 위치 찾기
- AC-5.3: 다음 스케줄러 사이클에서 해당 비트부터 재개
- AC-5.4: Seek 중 더블 클릭이나 글리치 없음

### US-6: A-B 루프 메트로놈 재시작

**When** A-B 루프가 루프백을 트리거하면 (currentTime >= loopB), **the metronome SHALL** loopA 이후 첫 번째 비트부터 재시작한다.

**수용 기준:**
- AC-6.1: 기존 `useAudioEngine.ts` onTimeUpdate 콜백의 루프백 감지 활용
- AC-6.2: 루프백 시 비트 인덱스를 첫 번째 비트 >= loopA로 리셋
- AC-6.3: 루프 활성 중 `[loopA, loopB)` 범위 내 비트만 스케줄링
- AC-6.4: 루프 비활성화 시 전체 비트 배열 사용

### US-7: 독립 메트로놈 볼륨

**When** 사용자가 메트로놈 볼륨 슬라이더를 조정하면, **the system SHALL** 마스터 오디오 볼륨과 독립적으로 클릭 크기를 변경한다.

**수용 기준:**
- AC-7.1: AudioEngine의 마스터 `gainNode`와 별도인 메트로놈 전용 GainNode
- AC-7.2: 메트로놈 볼륨 범위: 0-100 (`bpmStore.metronomeVolume`)
- AC-7.3: 마스터 볼륨/뮤트 변경이 메트로놈에 영향 없음
- AC-7.4: 메트로놈 뮤트는 마스터 뮤트와 독립

---

## 3. 기술 아키텍처

### 3.1 전체 데이터 흐름

```
[사용자 오디오 로드]
     |
     v
[Backend] POST /api/v1/bpm/analyze (FormData)
     |  madmom DBNBeatTracker (primary)
     |  librosa beat_track (fallback)
     |  SHA256 파일 해시 캐싱
     |  Response: { bpm, beats[], confidence, file_hash }
     v
[Frontend] bpmStore (Zustand)에 저장
     |
     v
[재생 중: onTimeUpdate 콜백 ~60fps]
     |
     v
[MetronomeEngine.syncToPlaybackTime(sourceTime, speed)]
     |  Lookahead: 다음 100ms 내 비트 탐색
     |  scheduleTime = audioContext.currentTime + (beatTime - sourceTime) / speed
     v
[OscillatorNode.start(정밀시간)] -> GainNode(metronome) -> Destination
```

### 3.2 오디오 그래프

```
기존 파이프라인 (스템/오디오):
  ScriptProcessorNode -> GainNode(master) -> AnalyserNode -> context.destination

메트로놈 파이프라인 (별도 경로):
  OscillatorNode(440Hz, 30ms) -> GainNode(metronome) -> context.destination
```

**SoundTouch 우회 이유:**
- 메트로놈 클릭은 피치/속도 변환 불필요
- 독립적 볼륨 제어 필요
- ScriptProcessorNode의 ~93ms 청크 처리에 영향받지 않아야 함

### 3.3 Lookahead Scheduler 패턴

```
Web Worker (백그라운드 탭에서도 동작)
  |  setTimeout 25ms 루프
  |
  +---> postMessage("tick") --> 메인 스레드
                                    |
                                    +---> [now, now+100ms] 범위 내 비트 탐색
                                    |       OscillatorNode.start(정밀_AudioContext_시간)
                                    |       osc.stop(시간 + 0.03)
                                    v
                                 (jitter 무관: 스케줄링이 재생 시점보다 충분히 앞서 발생)
```

### 3.4 속도 변경 동기화

```
비트 타임스탬프: 원본 시간 기준 (속도 무관)
beats = [0.52, 1.02, 1.52, ...]

현재 위치: 원본 시간
currentTime = simpleFilter.sourcePosition / sampleRate

AudioContext 시간으로 변환 (속도 반영):
scheduleTime = audioContext.currentTime + (beatTime - currentTime) / currentSpeed

예: 속도 0.8x, 다음 비트까지 원본 0.5초 -> 실제 0.625초 후 재생
```

### 3.5 상태 관리 (bpmStore)

```typescript
interface BpmState {
  // 분석 결과
  bpm: number | null
  beats: number[]
  confidence: number | null
  fileHash: string | null

  // 분석 상태
  isAnalyzing: boolean
  analysisError: string | null

  // 메트로놈 제어
  metronomeEnabled: boolean
  metronomeVolume: number  // 0-100

  // 액션
  analyzeBpm: (file: File) => Promise<void>
  toggleMetronome: () => void
  setMetronomeVolume: (volume: number) => void
  reset: () => void
}
```

### 3.6 MetronomeEngine 인터페이스

```typescript
class MetronomeEngine {
  constructor(context: AudioContext)

  setBeats(beats: number[]): void
  setVolume(value: number): void

  start(): void
  stop(): void
  syncToPlaybackTime(sourceTime: number, speed: number): void

  dispose(): void
}
```

### 3.7 이벤트 동기화 매트릭스

| 이벤트 | MetronomeEngine 동작 |
|--------|---------------------|
| Play | `start()` - Worker 시작, 스케줄링 시작. playStateListeners(true) 호출 -> 메트로놈 활성화 |
| Pause | `stop()` - Worker 중단, nextBeatIndex 보존. playStateListeners(false) 호출 -> 메트로놈 비활성화 |
| Stop | `stop()` - Worker 중단. playStateListeners(false) 호출 -> 메트로놈 비활성화 |
| Seek | `syncToPlaybackTime(newTime, speed)` - 이진 검색으로 다음 비트 찾기, scheduledBeats 초기화 |
| Speed Change | 자동 반영 (다음 `syncToPlaybackTime` 호출 시 새 speed 사용) |
| A-B Loop Reset | `syncToPlaybackTime(loopA, speed)` - 루프 시작 비트로 리셋 |
| Volume Change | `setVolume(v)` - GainNode.gain.value 변경 |
| New Audio Load | `stop()` + `setBeats([])` + `bpmStore.reset()` |

---

## 4. API 계약

### POST /api/v1/bpm/analyze

**Request:** `multipart/form-data`
```
file: <audio file> (audio/mpeg, audio/wav, audio/flac)
```

**Response (200 OK):**
```json
{
  "bpm": 120.0,
  "beats": [0.52, 1.02, 1.52, 2.02, 2.52, 3.02],
  "confidence": 0.95,
  "file_hash": "sha256hex..."
}
```

**에러 응답:**
| 코드 | 설명 |
|------|------|
| 400 | 지원하지 않는 오디오 형식 |
| 413 | 파일 크기 초과 |
| 500 | BPM 분석 처리 실패 |

**캐싱:** SHA256 파일 해시 -> `/tmp/bpm_cache/{hash}.json` (separation_service.py와 동일 패턴)

**동기식 선택 이유:** madmom BPM 분석은 3-8초 소요 (Demucs 수 분 대비). 단순 요청/응답으로 충분.

### 백엔드 서비스

```python
class BpmService:
    async def analyze(self, file_path: str) -> BpmResult
    # madmom primary, librosa fallback (try/except)
    # run_in_executor로 비동기 실행 (CPU 집약적)
    # SHA256 캐싱
```

### 프론트엔드 API 클라이언트

```typescript
// src/api/bpm.ts
interface BpmAnalysisResponse {
  bpm: number
  beats: number[]
  confidence: number
  file_hash: string
}

async function analyzeBpm(file: File): Promise<BpmAnalysisResponse>
```

---

## 5. 파일 영향 분석

### 5.1 신규 파일 - 프론트엔드 (6개, TDD)

| 파일 | 용도 | 예상 라인 |
|------|------|----------|
| `src/core/MetronomeEngine.ts` | Lookahead Scheduler, OscillatorNode, 동기화 로직 | ~200 |
| `src/stores/bpmStore.ts` | BPM/beats/metronome 상태 (Zustand) | ~80 |
| `src/hooks/useMetronome.ts` | MetronomeEngine 라이프사이클, AudioEngine 연동 | ~100 |
| `src/api/bpm.ts` | BPM 분석 API 클라이언트 | ~50 |
| `src/components/Metronome/MetronomePanel.tsx` | BPM 표시, 토글, 볼륨 UI | ~120 |
| `src/workers/metronome-worker.ts` | Web Worker 타이머 (25ms 루프) | ~30 |

### 5.2 신규 파일 - 백엔드 (3개, TDD)

| 파일 | 용도 | 예상 라인 |
|------|------|----------|
| `backend/app/routes/bpm.py` | POST /api/v1/bpm/analyze 엔드포인트 | ~80 |
| `backend/app/services/bpm_service.py` | madmom/librosa BPM 감지, 캐싱 | ~150 |
| `backend/tests/test_bpm.py` | BPM API 및 서비스 pytest | ~120 |

### 5.3 수정 파일 (7개, DDD)

| 파일 | 변경 내용 | 위험도 |
|------|----------|--------|
| `src/core/AudioEngine.ts` | `getContext()` public getter 추가 (~3줄) | 낮음 |
| `src/core/index.ts` | MetronomeEngine export 추가 (~1줄) | 낮음 |
| `src/hooks/useAudioEngine.ts` | onTimeUpdate에 메트로놈 sync 호출 추가 (~5줄) | 중간 |
| `src/hooks/usePlayback.ts` | play/pause/stop에 메트로놈 start/stop 연동 (~6줄) | 중간 |
| `src/utils/constants.ts` | METRONOME 상수 블록 추가 (~10줄) | 낮음 |
| `src/components/Player/Player.tsx` | MetronomePanel import 및 섹션 추가 (~15줄) | 낮음 |
| `backend/requirements.txt` | madmom, librosa 의존성 추가 (~2줄) | 중간 |

---

## 6. 구현 단계

### Phase 1-3: 병렬 실행 (의존성 없음)

| Phase | 작업 | 도메인 | 방법론 |
|-------|------|--------|--------|
| 1 | Backend BPM API + Service | Python/FastAPI | TDD |
| 2 | bpmStore (Zustand) | Frontend/State | TDD |
| 3 | MetronomeEngine + Worker | Frontend/Core | TDD |

### Phase 4-8: 순차 실행

| Phase | 작업 | 의존성 | 방법론 |
|-------|------|--------|--------|
| 4 | API 클라이언트 (`src/api/bpm.ts`) | Phase 1 | TDD |
| 5 | useMetronome 훅 | Phase 2, 3 | TDD |
| 6 | AudioEngine 통합 (getContext, onTimeUpdate, usePlayback) | Phase 5 | DDD |
| 7 | MetronomePanel UI + Player.tsx 통합 | Phase 2, 4, 5 | TDD (신규) + DDD (Player.tsx) |
| 8 | A-B 루프 통합 + 엣지 케이스 | Phase 6 | DDD |

### 의존성 그래프

```
Phase 1 (Backend API) ────────┐
Phase 2 (bpmStore) ───────────┤── 병렬
Phase 3 (MetronomeEngine) ────┘
         |
Phase 4 (API client) ← Phase 1
         |
Phase 5 (useMetronome) ← Phase 2, 3
         |
Phase 6 (AudioEngine 통합) ← Phase 5
         |
Phase 7 (MetronomePanel UI) ← Phase 2, 4, 5
         |
Phase 8 (A-B Loop + Edge) ← Phase 6
```

---

## 7. 엣지 케이스

| ID | 엣지 케이스 | 처리 방법 |
|----|------------|----------|
| EC-1 | 변박 곡 | 중앙값 BPM 표시. madmom 비트 타임스탬프는 변박에서도 정확 |
| EC-2 | 극단적 BPM (<40 또는 >220) | 수용하되 낮은 신뢰도 경고 표시 |
| EC-3 | 비트 없는 곡 (앰비언트, 음성) | confidence < 0.3이면 경고. 메트로놈 활성화는 허용 |
| EC-4 | 활성 메트로놈 중 Seek | 대기 오실레이터 즉시 취소, 이진 검색으로 다음 비트 찾기 |
| EC-5 | 활성 메트로놈 중 속도 변경 | scheduledBeats 초기화, 새 speed로 재스케줄링 |
| EC-6 | 백그라운드 탭 | Web Worker 타이머 계속 동작 (Chrome 쓰로틀링 회피) |
| EC-7 | 빠른 토글 연타 | 100ms 디바운스, stop 시 모든 대기 오실레이터 정리 |
| EC-8 | BPM 분석 중 네트워크 실패 | 30초 타임아웃, 수동 재시도 버튼, 자동 재시도 없음 |
| EC-9 | 대용량 파일 (>10분) | 비결정적 스피너 표시. 비트 배열 크기 무시 가능 (~10KB) |
| EC-10 | A-B 루프 경계가 비트와 불일치 | 정상 동작: [loopA, loopB) 범위 내 원본 비트 위치에서 클릭 |
| EC-11 | StemMixer 모드 | 동일 AudioContext 공유, SoundTouch 우회이므로 정상 동작 |

---

## 8. 비기능 요구사항

| 항목 | 요구사항 |
|------|---------|
| **성능** | BPM 분석 < 10초 (5분 곡 기준) |
| **타이밍 정밀도** | < 5ms 지터 (AudioContext 하드웨어 클럭 보장) |
| **UI 반응성** | BPM 분석이 UI 스레드 차단하지 않음 (비동기 API) |
| **CPU 사용** | 메트로놈 < 2% CPU (Web Worker + 경량 OscillatorNode) |
| **보안** | 오디오 MIME 타입만 허용, 기존 업로드 제한 준수 |
| **접근성** | 키보드 접근 가능, 화면 판독기 상태 알림 |
| **신뢰성** | BPM 데이터 없어도 크래시 없음. 백엔드 불가 시 안내 메시지 |
| **메모리** | OscillatorNode 자동 GC (stop 후), 비트 배열 ~10KB (무시 가능) |

---

## 9. 테스트 전략

### 9.1 단위 테스트 (TDD - 신규 코드)

| 대상 | 테스트 항목 |
|------|-----------|
| MetronomeEngine | Mock AudioContext로 OscillatorNode 스케줄링 검증, 이진 검색, 속도 조정 |
| bpmStore | 상태 전이, analyzeBpm 액션, reset |
| bpm.ts API | Mock fetch, FormData 구성, 에러 핸들링 |
| metronome-worker | 메시지 프로토콜 (start/stop/tick) |

### 9.2 통합 테스트 (DDD - 기존 코드 수정)

| 대상 | 테스트 항목 |
|------|-----------|
| useMetronome | React Testing Library + Mock AudioContext, 라이프사이클 |
| useAudioEngine | onTimeUpdate에서 MetronomeEngine.syncToPlaybackTime 호출 검증 |
| usePlayback | play/pause/stop이 메트로놈 start/stop 트리거 검증 |

### 9.3 백엔드 테스트 (pytest)

| 대상 | 테스트 항목 |
|------|-----------|
| bpm_service.py | Mock madmom/librosa, 폴백 로직, 캐싱 |
| bpm.py (route) | Mock 오디오 파일 업로드, 응답 포맷, 에러 코드 |

### 9.4 E2E 테스트 (Playwright)

| 시나리오 | 검증 항목 |
|---------|----------|
| BPM 분석 | 오디오 업로드 -> "Analyzing..." 표시 -> BPM 값 표시 |
| 메트로놈 토글 | BPM 분석 완료 -> 토글 활성화 -> 재생 -> (오디오 클릭 검증은 제한적) |
| 메트로놈 볼륨 | 볼륨 슬라이더 조작 -> UI 반영 |

---

## 10. 리스크 및 완화

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|----------|
| madmom Python 3.13 비호환 | 중간 | 높음 | librosa 폴백 (`try/except` import, separation_service.py 패턴) |
| AudioContext 생성 제한 | 낮음 | 중간 | `getContext()` getter로 기존 인스턴스 공유 |
| Web Worker Vite 번들링 | 낮음 | 낮음 | Vite 네이티브 지원: `new Worker(new URL(...), { type: 'module' })` |
| 장시간 재생 드리프트 | 낮음 | 낮음 | 25ms마다 sourcePosition 재동기화, 누적 불가 |
| 대용량 파일 분석 시간 | 중간 | 중간 | 비동기 분석, 사용자는 즉시 재생 가능, 메트로놈은 분석 완료 후 활성화 |
| FormData 업로드 (대용량) | 중간 | 중간 | 기존 업로드 제한 준수, 백엔드 스트리밍 처리 |

---

## 11. 대안 평가

### BPM 감지 라이브러리

| 기준 | madmom (선택) | librosa (폴백) | web-audio-beat-detector |
|------|-------------|---------------|----------------------|
| 정확도 | 최고 (DNN, MIREX 우승) | 양호 (onset DP) | 낮음 |
| 비트 위치 | 정밀 타임스탬프 | 제공 | 제한적 |
| 라이선스 | BSD-2 (안전) | ISC (안전) | MIT (안전) |
| 번들 영향 | 없음 (백엔드) | 없음 (백엔드) | +15KB |

### 메트로놈 타이머

| 기준 | Web Worker + Lookahead (선택) | AudioWorklet | Main thread setTimeout |
|------|---------------------------|-------------|----------------------|
| 정밀도 | 서브밀리초 | 완벽 | 4-50ms 지터 |
| 백그라운드 탭 | 지원 | 지원 | 미지원 (1초 제한) |
| 복잡도 | 중간 | 높음 | 낮음 |
| 디버깅 | 용이 | 어려움 | 용이 |

### 클릭 사운드

| 기준 | OscillatorNode (선택) | AudioBufferSource |
|------|---------------------|-------------------|
| 파일 로딩 | 불필요 | 필요 |
| 주파수 제어 | 파라미터화 가능 | 고정 |
| 메모리 | 최소 | 버퍼 유지 |
| GC | stop 후 자동 | stop 후 자동 |

### 오디오 경로

| 기준 | 별도 GainNode (선택) | SoundTouch 경유 |
|------|-------------------|----------------|
| 피치/속도 영향 | 없음 (원하는 동작) | 있음 (원치 않음) |
| 볼륨 독립 | 완전 독립 | 마스터와 혼합 |
| 지연 | 없음 | ~93ms 청크 지연 |

---

## 12. 제약사항

### 기술 제약

- 동일 AudioContext 인스턴스 사용 필수 (Web Audio API 제한: 탭당 1개 권장)
- 메트로놈 오디오는 SoundTouch 파이프라인 우회 (별도 GainNode -> Destination)
- 비트 타임스탬프는 원본 오디오 시간 좌표계 (`simpleFilter.sourcePosition / sampleRate` 동일 기준)
- Web Worker 타이머는 별도 .ts 파일 필요 (Vite 네이티브 지원)

### 플랫폼 제약

- 백엔드: Python 3.13, FastAPI
- 프론트엔드: React 19, Zustand 5, Vite 6, TypeScript 5.7
- 테스트: Vitest (단위), Playwright (E2E), pytest (백엔드)
- UI: Tailwind CSS 4, Logic Pro 다크 테마 (`#1A1A1A` 배경, `#FF6B35` 액센트)

### 하위 호환성

- 기존 오디오 재생은 BPM 분석 없이 동일하게 동작
- 메트로놈은 기본 비활성 (옵트인)
- 기존 AudioEngine 공개 API 변경 없음 (getContext getter만 추가)
- A-B 루프, 속도/피치, 볼륨 모두 독립적으로 동작 유지

### 범위 외 (V1)

- 템포 맵 시각화 (변박 구간 표시)
- 수동 BPM 오버라이드
- 박자표(time signature) 감지
- 클릭 사운드 커스터마이징

---

## UI 디자인 노트

MetronomePanel은 Pencil MCP로 디자인:
- Logic Pro 스타일 다크 테마 (`#1A1A1A` 배경, `#FF6B35` 오렌지 액센트)
- 기존 SpeedPitch/ABLoop 패널과 일관된 스타일
- 구성요소: BPM 표시 (큰 숫자), 분석 버튼, 토글 스위치, 볼륨 슬라이더, 신뢰도 표시

---

## 구현 노트

### 구현 완료 커밋

| 커밋 | 날짜 | 설명 |
|------|------|------|
| eb9be5f | 2026-02-17 | feat(backend): BPM 감지 및 메트로놈 API 구현 |
| 1fd5cce | 2026-02-17 | feat(frontend): 메트로놈 UI 및 오디오 동기화 구현 |

### 구현된 기능

**Backend (Python/FastAPI):**
- `backend/app/routes/bpm.py`: POST /api/v1/bpm/analyze 엔드포인트
- `backend/app/services/bpm_service.py`: madmom DBNBeatTracker (primary) + librosa beat_track (fallback)
- SHA256 파일 해시 기반 캐싱 (separation_service.py와 동일 패턴)
- FormData 오디오 파일 업로드 처리

**Frontend (React/TypeScript):**
- `src/core/MetronomeEngine.ts`: Lookahead Scheduler, OscillatorNode 클릭 생성
- `src/stores/bpmStore.ts`: BPM/beats/metronome 상태 관리 (Zustand)
- `src/hooks/useMetronome.ts`: MetronomeEngine 라이프사이클 관리
- `src/api/bpm.ts`: BPM 분석 API 클라이언트
- `src/components/Metronome/MetronomePanel.tsx`: BPM 표시, 토글, 볼륨 UI
- `src/workers/metronome-worker.ts`: Web Worker 타이머 (25ms 루프)

**오디오 동기화:**
- 속도 변경 시 자동 타이밍 조정
- Seek 시 다음 비트부터 재동기화
- A-B 루프 지원 (루프 구간 내 비트만 재생)
- 독립 메트로놈 볼륨 (마스터 볼륨과 분리)
- 메트로놈 오디오: SoundTouch 파이프라인 우회

### 테스트 커버리지

- Backend: pytest 단위 테스트 (bpm_service.py, bpm.py route)
- Frontend: Vitest 단위 테스트 (MetronomeEngine, bpmStore, API 클라이언트)
- E2E: Playwright 시나리오 (BPM 분석, 메트로놈 토글)

### 후속 최적화 (2026-02-18)

| 커밋 | 날짜 | 설명 |
|------|------|------|
| e837ba5 | 2026-02-18 | feat(audio): 메트로놈 오디오 파이프라인 최적화 - React 지연 제거 |
| dce2f2d | 2026-02-18 | docs: SPEC-BPM-001 완료 문서 동기화 |

**One-Time Anchor 패턴:**
- 기존: 매 ~93ms ScriptProcessorNode 버퍼마다 MetronomeEngine 앵커 동기화
- 개선: play/seek 시 1회만 앵커 동기화 (`needsAnchorSync` 플래그)
- AudioEngine의 `onaudioprocess`에서 `needsAnchorSync === true`일 때만 timeListeners 호출
- rAF 업데이트 루프에서 timeListeners 호출 제거 (~16ms 지터 원인 제거)

**재생 상태 연동 (playStateListeners):**
- AudioEngine에 `playStateListeners` Set 및 `addPlayStateListener()`/`removePlayStateListener()` 추가
- `play()` -> playStateListeners(true), `pause()`/`stop()` -> playStateListeners(false)
- useMetronome 훅에서 `audioIsPlaying` 상태 추적
- 메트로놈 활성화 조건 변경: `metronomeEnabled` -> `metronomeEnabled && audioIsPlaying`
- 효과: 음원 정지 시 메트로놈 자동 정지, 재생 재개 시 자동 활성화

**비트 간격 스무딩 (백엔드):**
- `bpm_service.py`에 `_smooth_beats()` 함수 추가
- 이동 중앙값 필터 (window=8) 적용으로 인트로 구간 madmom 바운싱 제거
- `_detect_with_madmom()` 비트 감지 후, BPM 계산 전에 적용

**동일 클릭음 (강박/약박 구분 제거):**
- MetronomeEngine에서 `nextBeatIndex % 4 === 0` 분기 로직 제거
- 모든 비트에 동일한 `clickFrequencyUpbeat` (440Hz) 사용
- 근거: madmom이 마디 시작(downbeat)을 신뢰성 있게 감지하지 못하므로 강박/약박 구분이 오히려 오해를 유발

**madmom 0.16.1 호환성 패치:**
- Python 3.13 + NumPy 2.x 환경에서 madmom 임포트 오류 해결
- `collections.MutableSequence` -> `collections.abc.MutableSequence` 패치
- `np.float` -> `float` 패치

---

*Generated by MoAI Plan Team (researcher + analyst + architect)*
*Research date: 2026-02-17*
*Implementation completed: 2026-02-17*
