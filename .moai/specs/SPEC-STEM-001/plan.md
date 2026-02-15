---
spec_id: SPEC-STEM-001
title: AI 음원 분리 및 스템 믹서 - 구현 계획
version: 1.0.0
status: draft
created: 2026-02-15
updated: 2026-02-15
author: jw
tags: demucs, stem-mixer, source-separation, web-audio, multi-track
---

# SPEC-STEM-001: 구현 계획

## 1. 마일스톤 개요

| 마일스톤 | 설명 | 우선순위 | 의존성 |
|---------|------|---------|-------|
| Phase A | 백엔드 - Demucs 분리 API | Primary Goal | 없음 |
| Phase B | 프론트엔드 코어 - StemMixer 엔진 | Primary Goal | Phase A API 스펙 |
| Phase C | UI 디자인 - Pencil | Secondary Goal | Phase B 상태 구조 |
| Phase D | 프론트엔드 UI - React 컴포넌트 | Primary Goal | Phase B + Phase C |
| Phase E | E2E 테스트 | Primary Goal | Phase A + Phase D |

---

## 2. Phase A: 백엔드 - Demucs 분리 API

### A1: 의존성 추가

- `backend/requirements.txt`에 demucs, torch(CPU), torchaudio 추가
- CPU 전용 torch 설치를 위한 `--extra-index-url` 설정
- 추가 패키지: `aiofiles` (비동기 파일 I/O)

**추가 패키지 목록:**
```
demucs>=4.0.1
torch>=2.0.0 (CPU only)
torchaudio>=2.0.0
aiofiles>=23.0.0
```

### A2: separation_service.py (분리 서비스)

- `backend/app/services/separation_service.py` 생성
- Demucs htdemucs 모델 래퍼 클래스
- 기능:
  - 모델 로딩 (lazy initialization, 싱글톤)
  - 오디오 파일 분리 실행
  - 진행률 콜백 지원
  - 결과 캐싱 (파일 해시 기반)
  - 동시 처리 제한 (asyncio.Semaphore, 기본 2개)
  - 임시 파일 정리

**핵심 설계:**
```python
class SeparationService:
    _model = None  # 싱글톤 모델
    _semaphore = asyncio.Semaphore(2)  # 동시 처리 제한
    _tasks: dict[str, SeparationTask] = {}  # 진행 중인 작업

    async def separate(self, file_path: str, task_id: str) -> dict:
        async with self._semaphore:
            # 캐시 확인
            # Demucs 실행
            # 진행률 업데이트
            # 결과 저장
```

### A3: separation.py (API 라우터)

- `backend/app/routes/separation.py` 생성
- 엔드포인트:
  - `POST /api/v1/separate` - 파일 업로드 및 분리 시작
  - `GET /api/v1/separate/{task_id}/progress` - SSE 진행률 스트리밍
  - `GET /api/v1/separate/{task_id}/stems/{stem_name}` - 스템 파일 다운로드
- 파일 크기 제한: 500MB
- 지원 포맷: MP3, WAV, FLAC
- SSE 구현: `sse-starlette` 또는 `StreamingResponse`

### A4: schemas.py 확장

- `backend/app/models/schemas.py`에 추가:
  - `SeparationRequest`: 분리 요청 스키마
  - `SeparationResponse`: 분리 응답 (task_id, status)
  - `SeparationProgress`: 진행률 이벤트 스키마
  - `StemInfo`: 스템 메타데이터

### A5: main.py 업데이트

- separation 라우터를 FastAPI 앱에 등록
- lifespan 이벤트에서 stems 저장 디렉토리 초기화
- stems 캐시 디렉토리 설정: `backend/data/stems/`

### A6: 백엔드 단위 테스트

- `backend/tests/test_separation.py`
- 테스트 케이스:
  - 파일 업로드 성공/실패
  - SSE 진행률 스트리밍
  - 스템 다운로드
  - 동시 처리 제한
  - 캐시 히트/미스
  - 잘못된 파일 포맷 거부

---

## 3. Phase B: 프론트엔드 코어 - StemMixer 엔진

### B1: StemMixer.ts (멀티트랙 오디오 엔진)

- `src/core/StemMixer.ts` 생성
- 기존 `AudioEngine.ts`의 ScriptProcessorNode + SoundTouch 패턴을 멀티트랙으로 확장

**핵심 아키텍처:**
```
4x WebAudioBufferSource (각 스템)
  -> ScriptProcessorNode (onaudioprocess에서 수동 믹싱)
    -> 각 스템 샘플 * effectiveGain 후 합산
    -> 합산된 샘플을 SoundTouch SimpleFilter에 전달
  -> SoundTouch 처리된 샘플 출력
  -> GainNode (마스터 볼륨)
  -> AnalyserNode
  -> Destination
```

**주요 메서드:**
- `loadStems(buffers: Record<StemName, AudioBuffer>)`: 4개 스템 로드
- `play()`, `pause()`, `stop()`: 재생 제어
- `seek(time: number)`: 모든 스템 동기 seek
- `setGain(stem: StemName, value: number)`: 개별 볼륨
- `setMuted(stem: StemName, muted: boolean)`: 뮤트
- `setSolo(stem: StemName, solo: boolean)`: 솔로
- `setSpeed(speed: number)`, `setPitch(pitch: number)`: 마스터 속도/피치
- `getCurrentTime(): number`: 현재 재생 위치
- `dispose()`: 리소스 정리

**솔로/뮤트 로직:**
```typescript
private getEffectiveGain(stem: StemName): number {
  const anySolo = Object.values(this.soloState).some(Boolean);
  if (anySolo) {
    return this.soloState[stem] ? this.gains[stem] : 0;
  }
  return this.mutedState[stem] ? 0 : this.gains[stem];
}
```

### B2: separation.ts (분리 API 클라이언트)

- `src/api/separation.ts` 생성
- 기능:
  - `uploadForSeparation(file: File): Promise<{ taskId: string }>` - 파일 업로드
  - `subscribeSeparationProgress(taskId: string, onProgress: callback): () => void` - SSE 구독
  - `downloadStem(taskId: string, stemName: string): Promise<ArrayBuffer>` - 스템 다운로드
  - `downloadAllStems(taskId: string): Promise<Record<StemName, ArrayBuffer>>` - 전체 다운로드

### B3: stemStore.ts (Zustand 스토어)

- `src/stores/stemStore.ts` 생성
- 상태:
  - 분리 프로세스 상태 (status, progress, taskId, error)
  - 스템 AudioBuffer 데이터
  - 믹서 상태 (gains, muted, solo)
  - 모드 플래그 (isStemMode)
- 액션:
  - `startSeparation()`, `updateProgress()`, `completeSeparation()`
  - `setGain()`, `toggleMute()`, `toggleSolo()`
  - `resetStems()`, `enterStemMode()`, `exitStemMode()`

### B4: useStemMixer.ts (StemMixer 래퍼 훅)

- `src/hooks/useStemMixer.ts` 생성
- StemMixer 인스턴스의 생명주기 관리
- stemStore와 StemMixer 인스턴스 동기화
- 기존 playerStore의 재생 상태와 연동
- A-B 루프 로직과 통합

### B5: useSeparation.ts (분리 프로세스 훅)

- `src/hooks/useSeparation.ts` 생성
- 분리 프로세스 전체 관리:
  - 파일 업로드
  - SSE 진행률 구독
  - 스템 다운로드 및 AudioBuffer 디코딩
  - 에러 처리 및 재시도
  - stemStore 상태 업데이트

---

## 4. Phase C: UI 디자인 - Pencil

### C1: 스템 믹서 패널 디자인

- 다크 테마, Logic Pro 스타일 믹서 레이아웃
- 4개 스템 트랙이 세로로 배치
- 각 트랙: 스템 이름 | 뮤트 버튼 | 솔로 버튼 | 볼륨 슬라이더 | 볼륨 %
- 색상 코딩: vocals(보라), drums(주황), bass(초록), other(파랑)

### C2: 분리 진행률 모달 디자인

- 모달 오버레이: 진행률 바, 현재 상태 텍스트, 취소 버튼
- 상태별 메시지: "모델 로딩 중...", "음원 분리 중... (45%)", "완료!"
- 스피너 + 프로그레스 바 결합

### C3: 모드 전환 UI 플로우 디자인

- "Separate" 버튼 위치 및 스타일
- 단일 트랙 <-> 스템 믹서 모드 전환 애니메이션
- 스템 믹서 패널의 접기/펼치기

---

## 5. Phase D: 프론트엔드 UI - React 컴포넌트

### D1: StemMixerPanel.tsx

- `src/components/StemMixer/StemMixerPanel.tsx`
- 스템 믹서 전체 패널 레이아웃
- 4개 StemTrack 컴포넌트 렌더링
- 마스터 리셋 버튼 (모든 볼륨 100%, 뮤트/솔로 해제)

### D2: StemTrack.tsx

- `src/components/StemMixer/StemTrack.tsx`
- 개별 스템 트랙 행 컴포넌트
- Props: stemName, gain, muted, solo, onGainChange, onMuteToggle, onSoloToggle
- 스템별 색상 코딩
- 볼륨 슬라이더: input[type="range"] + 커스텀 스타일
- 뮤트/솔로 버튼: 활성/비활성 시각적 구분

### D3: SeparationButton.tsx

- `src/components/StemMixer/SeparationButton.tsx`
- 분리 시작 트리거 버튼
- 오디오 로드 상태에 따른 활성/비활성
- 이미 분리 완료된 경우 "스템 믹서 열기" 표시

### D4: SeparationProgress.tsx

- `src/components/StemMixer/SeparationProgress.tsx`
- 분리 진행률 표시 (프로그레스 바 + 상태 텍스트)
- 에러 발생 시 에러 메시지 + 재시도 버튼

### D5: Player.tsx 수정

- 기존 `src/components/Player.tsx` 수정
- 모드 전환 로직 추가: 단일 트랙 <-> 스템 믹서
- isStemMode에 따른 조건부 렌더링
- StemMixerPanel 통합
- SeparationButton 배치

---

## 6. Phase E: E2E 테스트

### E1: stem-mixer.spec.ts

- `tests/e2e/stem-mixer.spec.ts`
- 테스트 전략: Mock API + 실제 Web Audio API 볼륨 검증

**시나리오:**
1. 파일 로드 -> 분리 버튼 클릭 -> 진행률 표시 -> 스템 로드 확인
2. 스템별 볼륨 변경 -> Web Audio API GainNode 값 검증
3. 솔로 버튼 -> 해당 스템만 재생 검증
4. 뮤트 버튼 -> 해당 스템 음소거 검증
5. 속도/피치 변경 -> 모든 스템 동기 적용 검증
6. A-B 루프 -> 모든 스템 동시 루프 검증

### E2: 테스트 fixture 준비

- `tests/fixtures/stems/` 디렉토리
- 5초 테스트 오디오 + 사전 분리된 4개 스템 WAV 파일
- 파일: `test-audio.mp3`, `vocals.wav`, `drums.wav`, `bass.wav`, `other.wav`
- Demucs로 사전 분리하여 커밋에 포함

### E3: Web Audio API 볼륨 검증 유틸리티

- `tests/e2e/utils/audio-verify.ts`
- Playwright 페이지 내에서 Web Audio API에 접근
- `page.evaluate()`로 AudioContext에서 GainNode 값 검증
- AnalyserNode 데이터를 통한 실제 오디오 출력 확인

---

## 7. 기술적 접근 방법

### 7.1 ScriptProcessorNode 기반 멀티트랙 믹싱

기존 AudioEngine이 ScriptProcessorNode + SoundTouch SimpleFilter를 사용하므로, StemMixer도 동일한 패턴을 확장한다.

**onaudioprocess 콜백 내부 처리 흐름:**
1. 각 스템의 WebAudioBufferSource에서 현재 위치의 샘플을 읽는다
2. 각 스템 샘플에 effectiveGain을 곱한다
3. 4개 스템의 가중 샘플을 합산(mix)한다
4. 합산된 샘플을 SoundTouch에 전달하여 tempo/pitch 처리한다
5. 처리된 샘플을 출력 버퍼에 쓴다

### 7.2 스템 간 동기화 전략

- 모든 스템이 동일한 sourcePosition을 공유
- seek 시 모든 스템의 position을 동시에 변경
- SoundTouch가 단일 인스턴스이므로 tempo/pitch는 자동 동기화
- A-B 루프의 경계 감지도 공유된 sourcePosition 기반

### 7.3 메모리 최적화

- 5분 곡 기준 4개 스템 WAV: 약 400MB
- 로딩 시 진행률 표시로 UX 개선
- 스템 전환 시 이전 스템 버퍼 명시적 해제
- 브라우저 메모리 경고 시 사용자에게 알림

---

## 8. 리스크 및 대응

| 리스크 | 영향도 | 대응 방안 |
|-------|-------|---------|
| torch CPU 패키지 크기 (~2GB) | 배포 크기 증가 | CPU-only 빌드 사용, Docker 멀티스테이지 빌드 |
| Demucs CPU 처리 시간 (곡 길이 x 1.5~3) | 사용자 대기 시간 | SSE 진행률 표시, 캐싱으로 재처리 방지 |
| 브라우저 메모리 사용량 (~400MB/곡) | 저사양 기기 문제 | 메모리 모니터링, 경고 표시, 최대 곡 길이 제한 고려 |
| ScriptProcessorNode deprecation | 장기적 호환성 | AudioWorklet 마이그레이션 경로 준비 (현재는 안정성 우선) |
| SSE 연결 끊김 | 진행률 추적 실패 | 자동 재연결 로직, polling fallback |

---

## 9. 의존성 그래프

```
Phase A (백엔드 API)
  |
  +---> Phase B (프론트엔드 코어) [API 스펙에 의존]
  |       |
  |       +---> Phase D (프론트엔드 UI) [엔진 + 디자인에 의존]
  |       |       |
  Phase C (UI 디자인)  +---> Phase E (E2E 테스트) [A + D 완료 필요]
```

**병렬 실행 가능 영역:**
- Phase A와 Phase C는 독립적이므로 병렬 진행 가능
- Phase B는 Phase A의 API 스펙이 확정되면 시작 가능 (구현 완료 불필요)
- Phase D는 Phase B + Phase C 완료 후 시작
- Phase E는 Phase A + Phase D 완료 후 시작

---

## 10. 전문가 자문 권장

| 영역 | 전문가 에이전트 | 자문 내용 |
|------|--------------|---------|
| 백엔드 API 설계 | expert-backend | SSE 구현, 비동기 작업 관리, 파일 처리 |
| 프론트엔드 UI | expert-frontend | React 컴포넌트 설계, 상태 관리 패턴 |
| UI/UX 디자인 | design-uiux | 스템 믹서 패널 디자인, Pencil MCP 활용 |
