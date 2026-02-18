---
spec_id: SPEC-BPM-001
title: 자동 BPM 감지 및 메트로놈 기능 - 구현 계획
version: 1.0.0
status: draft
created: 2026-02-17
updated: 2026-02-17
author: jw
tags: bpm, metronome, beat-tracking, lookahead-scheduler, madmom, web-audio
---

# SPEC-BPM-001: 구현 계획

## 1. 마일스톤 개요

| 마일스톤 | 설명 | 우선순위 | 의존성 |
|---------|------|---------|-------|
| Phase A | 백엔드 - BPM 분석 API | Primary Goal | 없음 |
| Phase B | 프론트엔드 코어 - MetronomeEngine + Store | Primary Goal | 없음 |
| Phase C | UI 디자인 - Pencil MCP | Secondary Goal | 없음 |
| Phase D | 프론트엔드 통합 - 훅, API 클라이언트, 연동 | Primary Goal | Phase A + B |
| Phase E | UI 구현 - MetronomePanel + Player 통합 | Primary Goal | Phase B + C + D |
| Phase F | E2E 테스트 | Primary Goal | Phase A + E |

**병렬 실행:** Phase A, B, C는 완전 독립이므로 동시 진행 가능.

---

## 2. Phase A: 백엔드 - BPM 분석 API

### A1: 의존성 추가

- `backend/requirements.txt`에 madmom, librosa 추가
- madmom: BSD-2 라이선스 (안전)
- librosa: ISC 라이선스 (안전)

**추가 패키지:**
```
madmom>=0.16.1
librosa>=0.11.0
```

### A2: bpm_service.py (BPM 분석 서비스)

- `backend/app/services/bpm_service.py` 생성
- 기능:
  - madmom DBNBeatTrackingProcessor + RNNBeatProcessor (primary)
  - librosa beat_track (fallback, try/except import)
  - SHA256 파일 해시 기반 캐싱 (`/tmp/bpm_cache/{hash}.json`)
  - `run_in_executor`로 비동기 실행 (CPU 집약적 처리)
  - 결과: `BpmResult(bpm, beats[], confidence, file_hash)`

**핵심 설계:**
```python
class BpmService:
    async def analyze(self, file_path: str) -> BpmResult:
        # 1. SHA256 해시 계산 -> 캐시 확인
        # 2. madmom 분석 시도 (try/except)
        # 3. 실패 시 librosa 폴백
        # 4. 결과 캐싱 -> 반환
```

### A3: bpm.py (API 라우터)

- `backend/app/routes/bpm.py` 생성
- 엔드포인트: `POST /api/v1/bpm/analyze`
- 입력: `multipart/form-data` (file 필드)
- 출력: `{ bpm, beats[], confidence, file_hash }`
- 파일 검증: audio/mpeg, audio/wav, audio/flac만 허용
- 에러: 400 (형식), 413 (크기), 500 (처리 실패)

### A4: main.py 업데이트

- BPM 라우터를 FastAPI 앱에 등록

### A5: 백엔드 단위 테스트

- `backend/tests/test_bpm.py` 생성
- 테스트 케이스:
  - 정상 파일 BPM 분석 성공
  - 지원하지 않는 형식 거부 (400)
  - madmom 실패 시 librosa 폴백
  - 캐시 히트/미스
  - 응답 형식 검증 (bpm, beats, confidence, file_hash)

---

## 3. Phase B: 프론트엔드 코어 - MetronomeEngine + Store

### B1: MetronomeEngine.ts (핵심 메트로놈 엔진)

- `src/core/MetronomeEngine.ts` 생성
- Lookahead Scheduler 패턴 (Chris Wilson)
- Web Worker 타이머 (백그라운드 탭 지원)
- OscillatorNode 클릭 생성 (880Hz 다운비트, 440Hz 업비트, 30ms)
- 독립 GainNode (SoundTouch 파이프라인 우회)

**핵심 인터페이스:**
```typescript
class MetronomeEngine {
  constructor(context: AudioContext)
  setBeats(beats: number[]): void       // 원본 시간 비트 위치
  setVolume(value: number): void         // 0.0-1.0
  start(): void                          // Worker 시작
  stop(): void                           // Worker 중단
  syncToPlaybackTime(sourceTime: number, speed: number): void
  dispose(): void                        // Worker 종료, 노드 해제
}
```

**스케줄링 로직:**
```
Worker "tick" (25ms마다)
  -> scheduleTick():
    while (nextBeat < beats.length):
      scheduleTime = audioContext.currentTime + (beatTime - sourceTime) / speed
      if scheduleTime < now: skip (과거)
      if scheduleTime > now + 0.1: break (미래 100ms 넘음)
      OscillatorNode.start(scheduleTime)
      nextBeatIndex++
```

### B2: metronome-worker.ts (Web Worker 타이머)

- `src/workers/metronome-worker.ts` 생성
- 25ms setTimeout 루프
- 메시지 프로토콜: "start" -> tick 시작, "stop" -> tick 중단
- Vite 네이티브 Worker 지원: `new Worker(new URL(...), { type: 'module' })`

### B3: bpmStore.ts (Zustand 스토어)

- `src/stores/bpmStore.ts` 생성
- stemStore.ts 패턴 따름

**상태:**
```typescript
interface BpmState {
  bpm: number | null
  beats: number[]
  confidence: number | null
  fileHash: string | null
  isAnalyzing: boolean
  analysisError: string | null
  metronomeEnabled: boolean
  metronomeVolume: number  // 0-100
  // 액션
  analyzeBpm: (file: File) => Promise<void>
  toggleMetronome: () => void
  setMetronomeVolume: (volume: number) => void
  reset: () => void
}
```

### B4: constants.ts 업데이트

- `src/utils/constants.ts`에 METRONOME 상수 추가:
```typescript
METRONOME = {
  CLICK_FREQ_DOWNBEAT: 880,   // Hz
  CLICK_FREQ_UPBEAT: 440,     // Hz
  CLICK_DURATION: 0.03,       // seconds
  LOOKAHEAD_MS: 25,           // Worker interval
  SCHEDULE_AHEAD_TIME: 0.1,   // seconds
  DEFAULT_VOLUME: 80,         // 0-100
  BEATS_PER_BAR: 4,           // 4/4 박자
}
```

### B5: 프론트엔드 단위 테스트

- MetronomeEngine: Mock AudioContext, OscillatorNode 스케줄링, 이진 검색, 속도 조정
- bpmStore: 상태 전이, 액션, reset
- metronome-worker: 메시지 프로토콜

---

## 4. Phase C: UI 디자인 - Pencil MCP

### C1: MetronomePanel 디자인

- Pencil MCP로 디자인 생성
- Logic Pro 스타일 다크 테마:
  - 배경: `#1A1A1A`
  - 액센트: `#FF6B35` (오렌지)
  - 텍스트: `#F5F5F5`
- 구성요소:
  - BPM 표시 (큰 숫자, 유효 BPM 포함)
  - 분석 상태 표시 (스피너 / 완료 / 에러)
  - 메트로놈 토글 스위치
  - 볼륨 슬라이더 (독립)
  - 신뢰도 표시 (Low / Medium / High)
- 기존 SpeedPitch/ABLoop 패널과 일관된 레이아웃

---

## 5. Phase D: 프론트엔드 통합

### D1: bpm.ts (API 클라이언트)

- `src/api/bpm.ts` 생성
- 기존 API 패턴 따름 (src/api/separation.ts 참조)

```typescript
interface BpmAnalysisResponse {
  bpm: number
  beats: number[]
  confidence: number
  file_hash: string
}

async function analyzeBpm(file: File): Promise<BpmAnalysisResponse>
// FormData로 POST /api/v1/bpm/analyze
```

### D2: useMetronome.ts (라이프사이클 훅)

- `src/hooks/useMetronome.ts` 생성
- MetronomeEngine 인스턴스 관리
- AudioEngine/StemMixer의 AudioContext 공유
- bpmStore 상태 -> MetronomeEngine 동기화

```typescript
function useMetronome(engine: AudioEngine | StemMixer | null): {
  isMetronomeReady: boolean
  analyzeBpm: (file: File) => Promise<void>
}
```

### D3: AudioEngine.ts 수정 (DDD)

- `getContext(): AudioContext | null` public getter 추가 (~3줄)
- 기존 private `context` 필드는 유지

### D4: useAudioEngine.ts 수정 (DDD)

- onTimeUpdate 콜백에 메트로놈 sync 추가:

```typescript
onTimeUpdate: (time: number) => {
  usePlayerStore.getState().setCurrentTime(time)
  // 메트로놈 sync (신규)
  const { metronomeEnabled } = useBpmStore.getState()
  if (metronomeEnabled && metronomeEngineRef.current) {
    const speed = useControlStore.getState().speed
    metronomeEngineRef.current.syncToPlaybackTime(time, speed)
  }
  // 기존 루프 핸들링 유지
}
```

### D5: usePlayback.ts 수정 (DDD)

- play/pause/stop에 메트로놈 start/stop 연동 (~6줄)

### D6: core/index.ts 수정

- MetronomeEngine export 추가 (1줄)

---

## 6. Phase E: UI 구현

### E1: MetronomePanel.tsx

- `src/components/Metronome/MetronomePanel.tsx` 생성
- Phase C 디자인 기반 구현
- 구성요소:
  - BPM 표시: `{effectiveBpm} BPM` (큰 폰트)
  - 분석 상태: 스피너 | "BPM 분석 필요" | 에러 + 재시도
  - 토글: 메트로놈 on/off
  - 볼륨: 독립 슬라이더 (0-100)
  - 신뢰도: 배지 (Low/Medium/High)
- Tailwind CSS, lucide-react 아이콘

### E2: Player.tsx 수정 (DDD)

- MetronomePanel import 및 섹션 추가
- SpeedPitch와 ABLoop 사이에 배치
- useMetronome 훅 연결

---

## 7. Phase F: E2E 테스트

### F1: bpm-metronome.spec.ts

- `tests/e2e/bpm-metronome.spec.ts` (또는 기존 E2E 디렉토리)
- Playwright 테스트

**시나리오:**
1. 파일 로드 -> BPM 분석 스피너 -> BPM 값 표시
2. 메트로놈 토글 활성화 -> UI 상태 변경
3. 메트로놈 볼륨 슬라이더 -> UI 반영
4. 속도 변경 -> 유효 BPM 표시 업데이트
5. BPM 분석 실패 -> 에러 메시지 + 재시도 버튼

### F2: 테스트 fixture

- 짧은 테스트 오디오 파일 (5초, 명확한 비트)
- 또는 Mock API 응답으로 BPM 데이터 제공

---

## 8. 기술적 접근 방법

### 8.1 Lookahead Scheduler 기반 메트로놈

Chris Wilson "A Tale of Two Clocks" 패턴:
- JavaScript 시계 (setTimeout): ~4ms 최소 해상도, 실제 지터 10-50ms+
- AudioContext 시계 (currentTime): ~0.02ms 정밀도, 하드웨어 구동
- Web Worker: 백그라운드 탭에서도 setTimeout 제한 없음
- 25ms마다 tick -> 100ms 앞까지 비트 탐색 -> OscillatorNode.start(정밀시간)

### 8.2 비트 타임스탬프 좌표계

- 비트 위치: 원본 오디오 시간 (초)
- 현재 위치: `simpleFilter.sourcePosition / sampleRate` (원본 시간)
- AudioContext 시간 변환: `scheduleTime = now + (beatTime - sourceTime) / speed`
- 속도 변경 시 비트 재계산 불필요 (speed가 분모에만 영향)

### 8.3 오디오 그래프 분리

```
기존 파이프라인:
  ScriptProcessorNode -> GainNode(master) -> AnalyserNode -> Destination

메트로놈 파이프라인 (별도):
  OscillatorNode -> GainNode(metronome) -> Destination
```

SoundTouch 우회 이유:
- 클릭은 피치/속도 변환 불필요
- 독립 볼륨 제어
- ScriptProcessorNode의 ~93ms 청크 지연 회피

### 8.4 이벤트 동기화

| 이벤트 | 메트로놈 동작 |
|--------|-------------|
| Play | `engine.start()` |
| Pause | `engine.stop()`, beatIndex 보존 |
| Stop | `engine.stop()` |
| Seek | `syncToPlaybackTime(newTime, speed)`, scheduledBeats 초기화, 이진 검색 |
| Speed | 자동 (다음 sync 시 새 speed 사용) |
| A-B Loop | `syncToPlaybackTime(loopA, speed)`, 루프 범위 내 비트만 |
| Volume | `setVolume(v)`, GainNode.gain.value |
| New File | `stop()` + `setBeats([])` + `bpmStore.reset()` |

---

## 9. 리스크 및 대응

| 리스크 | 영향도 | 대응 방안 |
|-------|-------|---------|
| madmom Python 3.13 비호환 | 높음 | librosa 폴백 (try/except import, separation_service.py 패턴) |
| AudioContext 공유 | 중간 | getContext() getter로 기존 인스턴스 전달 |
| Web Worker 번들링 | 낮음 | Vite 네이티브 지원 확인 |
| 장시간 드리프트 | 낮음 | 25ms 주기 sourcePosition 재동기화 |
| 대용량 파일 분석 | 중간 | 비동기 분석, 즉시 재생 가능, 분석 완료 후 메트로놈 활성화 |

---

## 10. 의존성 그래프

```
Phase A (Backend BPM API) ──────────┐
Phase B (MetronomeEngine + Store) ──┤── 병렬 실행
Phase C (UI Design - Pencil) ───────┘
         |
         v
Phase D (통합: API client, hooks, AudioEngine 수정)
         |   <- Phase A (API 스펙) + Phase B (Engine + Store)
         v
Phase E (UI 구현: MetronomePanel, Player.tsx)
         |   <- Phase B (Store) + Phase C (Design) + Phase D (Hooks)
         v
Phase F (E2E 테스트)
         |   <- Phase A (Backend) + Phase E (UI)
```

---

## 11. 전문가 자문 권장

| 영역 | 전문가 에이전트 | 자문 내용 |
|------|--------------|---------|
| 백엔드 BPM API | expert-backend | madmom 통합, FastAPI 라우팅, 캐싱 |
| 메트로놈 엔진 | expert-frontend | Web Audio API, Lookahead Scheduler, Web Worker |
| UI 디자인 | expert-frontend (Pencil) | MetronomePanel 디자인, Logic Pro 테마 |
| 테스트 전략 | expert-testing | Mock AudioContext, E2E 오디오 검증 |

---

## 12. 참고 스킬

구현 시 다음 스킬을 로드하여 참조:
- `moai-tool-webaudio-metronome`: Lookahead Scheduler 상세 구현 패턴
- `moai-tool-madmom`: madmom/librosa BPM 감지 상세 구현 패턴
