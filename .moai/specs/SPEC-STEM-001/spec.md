---
id: SPEC-STEM-001
title: AI 음원 분리 및 스템 믹서
version: 1.0.0
status: completed
priority: high
created: 2026-02-15
updated: 2026-02-15
author: jw
tags: demucs, stem-mixer, source-separation, web-audio, multi-track
related_specs:
  - SPEC-API-001
  - SPEC-PERF-001
---

# SPEC-STEM-001: AI 음원 분리 및 스템 믹서

## 1. 개요

### 1.1 목적

Music Trainer에 AI 기반 음원 분리(Source Separation) 기능과 스템 믹서(Stem Mixer) 기능을 추가한다. 사용자가 로드한 오디오 파일을 Demucs htdemucs 모델로 4개 스템(vocals, drums, bass, other)으로 분리하고, 각 스템의 볼륨을 개별 제어하여 악기 연습 및 합주 준비를 가능하게 한다.

### 1.2 배경

- Phase 1~3에서 기본 재생, 속도/피치 제어, YouTube 지원이 완성되었다
- 사용자가 합주 곡에서 특정 악기만 집중적으로 연습하려면 음원 분리가 필수이다
- 기존 AudioEngine(ScriptProcessorNode + SoundTouch)을 멀티트랙으로 확장해야 한다

### 1.3 범위

- 백엔드: Demucs 분리 API (업로드, SSE 진행률, 스템 다운로드)
- 프론트엔드 코어: StemMixer 오디오 엔진 (멀티트랙 재생 + SoundTouch 통합)
- 프론트엔드 UI: 스템 믹서 패널, 분리 진행률, 모드 전환
- E2E 테스트: Mock API + 실제 Web Audio API 볼륨 검증

---

## 2. 환경 (Environment)

### 2.1 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 프론트엔드 프레임워크 | React | 19.x |
| 언어 | TypeScript | 5.x |
| 빌드 도구 | Vite | 6.x |
| 상태 관리 | Zustand | latest |
| 스타일링 | Tailwind CSS | 4.x |
| 오디오 처리 | Web Audio API + soundtouchjs | - |
| 파형 시각화 | wavesurfer.js | 7.x |
| 백엔드 프레임워크 | FastAPI | latest |
| 음원 분리 모델 | Demucs (htdemucs) | 4.x |
| ML 런타임 | PyTorch (CPU) | latest |
| 단위 테스트 | Vitest / pytest | latest |
| E2E 테스트 | Playwright | latest |

### 2.2 기존 시스템 의존성

- `src/core/AudioEngine.ts`: ScriptProcessorNode + SoundTouch 실시간 스트리밍 파이프라인
- `backend/app/main.py`: FastAPI 앱 (health, youtube 라우터 등록)
- `backend/app/services/`: YouTube 서비스, 클린업 서비스
- `src/stores/`: audioStore, playerStore, controlStore, loopStore, youtubeStore

### 2.3 제약사항

- ScriptProcessorNode는 deprecated이나 현재 실시간 스트리밍에 가장 안정적이므로 계속 사용
- Demucs CPU 처리 시간은 곡 길이의 약 1.5~3배 소요
- 4개 스템 WAV 버퍼는 5분 곡 기준 약 400MB 브라우저 메모리 사용
- torch CPU 패키지 크기 약 2GB (서버 배포 시 고려)

---

## 3. 가정 (Assumptions)

- A1: htdemucs 모델(4스템: vocals, drums, bass, other)을 사용한다
- A2: 음원 분리는 백엔드에서 수행하고, 분리 결과(WAV)를 프론트엔드에서 다운로드한다
- A3: 동시 분리 요청은 서버 RAM 제한으로 인해 큐 기반 제한이 필요하다
- A4: 단일 SoundTouch 인스턴스로 마스터 속도/피치를 적용하여 스템 간 동기화를 보장한다
- A5: 기존 단일 트랙 모드와 스템 믹서 모드를 전환하며 사용한다
- A6: E2E 테스트는 Mock API를 사용하되, Web Audio API 볼륨 변경은 실제로 검증한다

---

## 4. 요구사항 (Requirements)

### REQ-STEM-001: 음원 분리 요청 및 진행률

**WHEN** 사용자가 "Separate" 버튼을 클릭 **THEN** 현재 로드된 오디오 파일을 백엔드 분리 API에 전송하고 분리 작업을 시작한다.

**IF** 분리 작업이 진행 중인 상태 **THEN** SSE(Server-Sent Events)를 통해 실시간 진행률을 0%에서 100%까지 표시한다.

**WHEN** 분리 작업이 완료 **THEN** 4개 스템 파일(vocals, drums, bass, other)을 자동 다운로드한 후 스템 믹서 모드로 전환한다.

**IF** 분리 요청 중 네트워크 오류 또는 서버 오류가 발생 **THEN** 사용자에게 에러 메시지를 표시하고 재시도 옵션을 제공한다.

### REQ-STEM-002: 백엔드 분리 API

시스템은 **항상** `POST /api/v1/separate` 엔드포인트를 제공하여 오디오 파일 업로드를 수신하고 `task_id`를 반환한다.

시스템은 **항상** `GET /api/v1/separate/{task_id}/progress` SSE 엔드포인트를 제공하여 분리 진행률을 실시간 스트리밍한다.

시스템은 **항상** `GET /api/v1/separate/{task_id}/stems/{stem_name}` 엔드포인트를 제공하여 개별 스템 WAV 파일을 다운로드할 수 있게 한다.

**IF** 동시 분리 요청 수가 서버 RAM 제한(기본 2개)을 초과 **THEN** 추가 요청은 큐에 대기시키고 대기 상태를 응답한다.

시스템은 분리된 스템 파일을 **항상** 파일 해시 기반으로 캐싱하여 동일 파일의 재분리를 방지한다.

### REQ-STEM-003: 스템 믹서 오디오 엔진

시스템은 **항상** 분리된 4개 스템(vocals, drums, bass, other)을 동시에 재생하며 각 스템의 볼륨을 개별적으로 제어할 수 있어야 한다.

**IF** 속도 또는 피치가 변경된 상태 **THEN** 모든 스템에 동일한 속도/피치가 적용된다 (단일 SoundTouch 인스턴스를 통한 마스터 처리).

시스템은 스템 간 재생 위치 동기화를 **하지 않아야 하는** 상황이 발생하면 자동 보정하여 동기화를 유지한다.

**WHEN** 사용자가 seek 조작을 수행 **THEN** 모든 스템의 sourcePosition을 동기적으로 변경하여 정확한 위치 이동을 보장한다.

### REQ-STEM-004: 스템 믹서 UI

시스템은 **항상** 각 스템에 이름 라벨, 볼륨 슬라이더(0~100%), 뮤트 버튼, 솔로 버튼을 표시한다.

**WHEN** 볼륨 슬라이더를 조작 **THEN** 해당 스템의 볼륨이 실시간으로 변경된다 (100ms 이내 반영).

**WHEN** 솔로 버튼을 클릭 **THEN** 해당 스템만 재생되고 나머지 스템은 음소거된다. 다른 스템의 솔로 버튼을 추가로 클릭하면 다중 솔로가 가능하다.

**IF** 스템 믹서 모드가 활성화된 상태 **THEN** A-B 루프, 키보드 단축키 등 기존 기능이 동일하게 동작한다.

**WHEN** 뮤트 버튼을 클릭 **THEN** 해당 스템의 볼륨이 0으로 설정되고 시각적으로 음소거 상태가 표시된다. 다시 클릭하면 이전 볼륨으로 복원된다.

### REQ-STEM-005: E2E 테스트

시스템은 **항상** 파일 로드 -> 분리 요청 -> 스템 로드 -> 볼륨 변경 -> 오디오 반영 검증의 전체 시나리오를 E2E 테스트로 커버한다.

E2E 테스트는 **항상** Mock API 백엔드를 사용하여 백엔드 의존성 없이 프론트엔드를 검증한다.

E2E 테스트는 **항상** 사전 분리된 테스트 스템 파일(5초 오디오 x 4스템)을 fixture로 활용한다.

E2E 테스트는 **항상** 실제 Web Audio API를 통해 볼륨 변경이 오디오 출력에 반영되는지 검증한다.

---

## 5. 사양 (Specifications)

### 5.1 오디오 아키텍처 (스템 믹서 모드)

```
Stem AudioBuffers (4 stereo buffers from Demucs)
  |-- vocals: WebAudioBufferSource -> gain (개별 볼륨)
  |-- drums:  WebAudioBufferSource -> gain (개별 볼륨)
  |-- bass:   WebAudioBufferSource -> gain (개별 볼륨)
  |-- other:  WebAudioBufferSource -> gain (개별 볼륨)
  v
ScriptProcessorNode (onaudioprocess: 수동 믹싱 + SoundTouch 피드)
  v
SimpleFilter(SoundTouch) -- 마스터 tempo/pitch
  v
GainNode (마스터 볼륨) -> AnalyserNode -> Destination
```

**핵심 설계 원칙:**
- 각 스템은 독립적인 WebAudioBufferSource + GainNode를 갖는다
- ScriptProcessorNode의 onaudioprocess 콜백에서 각 스템의 샘플을 개별 gain으로 곱한 후 믹싱한다
- 믹싱된 샘플을 SoundTouch SimpleFilter에 전달하여 마스터 속도/피치를 적용한다
- 단일 SoundTouch 인스턴스를 사용하여 모든 스템의 속도/피치 동기화를 보장한다

### 5.2 API 설계

#### POST /api/v1/separate

```
Request:
  Content-Type: multipart/form-data
  Body:
    file: audio file (MP3, WAV, FLAC, max 500MB)
    model: "htdemucs" (optional, default)

Response (202 Accepted):
  {
    "task_id": "uuid",
    "status": "processing",
    "message": "Separation started"
  }
```

#### GET /api/v1/separate/{task_id}/progress (SSE)

```
Event Stream:
  data: {"progress": 0, "status": "loading_model"}
  data: {"progress": 25, "status": "separating"}
  data: {"progress": 50, "status": "separating"}
  data: {"progress": 75, "status": "separating"}
  data: {"progress": 100, "status": "completed", "stems": ["vocals", "drums", "bass", "other"]}

Error Event:
  data: {"progress": -1, "status": "failed", "error": "Out of memory"}
```

#### GET /api/v1/separate/{task_id}/stems/{stem_name}

```
Path Parameters:
  task_id: UUID
  stem_name: "vocals" | "drums" | "bass" | "other"

Response:
  Content-Type: audio/wav
  Body: WAV file binary
```

### 5.3 상태 관리 (stemStore)

```typescript
interface StemState {
  // 분리 상태
  separationStatus: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  separationProgress: number; // 0-100
  taskId: string | null;
  errorMessage: string | null;

  // 스템 데이터
  stems: {
    vocals: AudioBuffer | null;
    drums: AudioBuffer | null;
    bass: AudioBuffer | null;
    other: AudioBuffer | null;
  };

  // 믹서 상태
  gains: { vocals: number; drums: number; bass: number; other: number }; // 0.0-1.0
  muted: { vocals: boolean; drums: boolean; bass: boolean; other: boolean };
  solo: { vocals: boolean; drums: boolean; bass: boolean; other: boolean };

  // 모드
  isStemMode: boolean;
}
```

### 5.4 솔로/뮤트 로직

```
effectiveGain(stem) =
  if (anySoloActive):
    if (solo[stem]): gains[stem]
    else: 0
  else:
    if (muted[stem]): 0
    else: gains[stem]
```

### 5.5 파일 구조

```
backend/
  app/
    routes/separation.py        # 분리 API 엔드포인트
    services/separation_service.py  # Demucs 래퍼, 캐싱, 동시처리 제한
    models/schemas.py           # SeparationRequest, SeparationStatus 추가

src/
  core/StemMixer.ts            # 멀티트랙 오디오 엔진
  api/separation.ts            # 분리 API 클라이언트
  stores/stemStore.ts          # 스템 상태 관리
  hooks/useStemMixer.ts        # StemMixer 래퍼 훅
  hooks/useSeparation.ts       # 분리 프로세스 관리 훅
  components/StemMixer/
    StemMixerPanel.tsx          # 스템 믹서 메인 패널
    StemTrack.tsx               # 개별 스템 트랙 행
    SeparationButton.tsx        # 분리 시작 버튼
    SeparationProgress.tsx      # 분리 진행률 표시

tests/
  e2e/stem-mixer.spec.ts       # E2E 테스트
  fixtures/stems/              # 사전 분리된 테스트 스템 WAV
```

---

## 6. 추적성 (Traceability)

| 요구사항 ID | 관련 파일 | 테스트 |
|------------|----------|-------|
| REQ-STEM-001 | SeparationButton.tsx, SeparationProgress.tsx, useSeparation.ts | E2E: 분리 전체 플로우 |
| REQ-STEM-002 | separation.py, separation_service.py, schemas.py | Unit: 백엔드 API 테스트 |
| REQ-STEM-003 | StemMixer.ts, useStemMixer.ts | Unit: 엔진 동기화, 볼륨 제어 |
| REQ-STEM-004 | StemMixerPanel.tsx, StemTrack.tsx | E2E: UI 상호작용 |
| REQ-STEM-005 | stem-mixer.spec.ts, fixtures/stems/ | E2E: 전체 시나리오 |
