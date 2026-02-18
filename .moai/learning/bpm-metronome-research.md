# BPM 분석 + 메트로놈 동기화 기술조사

## 목차

1. [문제 정의](#1-문제-정의)
2. [BPM 감지 라이브러리 비교](#2-bpm-감지-라이브러리-비교)
3. [메트로놈 정밀 스케줄링 기법](#3-메트로놈-정밀-스케줄링-기법)
4. [추천 아키텍처](#4-추천-아키텍처)
5. [기존 기능 통합 방안](#5-기존-기능-통합-방안)
6. [파일 영향 분석](#6-파일-영향-분석)
7. [구현 순서](#7-구현-순서)
8. [리스크 및 완화 방안](#8-리스크-및-완화-방안)

---

## 1. 문제 정의

### 단순한 메트로놈의 한계

- **setInterval/setTimeout 기반 메트로놈**: JavaScript 타이머는 4~50ms 지터 발생. 120 BPM에서 20ms 오차 = 4% 타이밍 에러로 명확히 엇박
- **BPM 수동 설정의 한계**: 곡의 실제 비트 위치와 메트로놈 시작점이 맞지 않으면 점점 어긋남
- **탭 백그라운드 문제**: Chrome은 백그라운드 탭의 타이머를 1초 간격으로 제한

### 필요한 기술

1. 곡의 정확한 BPM과 개별 비트 위치(타임스탬프) 감지
2. Web Audio API 하드웨어 클럭 기반 서브밀리초 정밀 스케줄링
3. 속도 변경/Seek/A-B 루프와의 완벽한 동기화

---

## 2. BPM 감지 라이브러리 비교

### Python (백엔드) - 추천

| 라이브러리 | Stars | 정확도 | 비트 위치 | 속도 | 라이선스 | 추천 |
|-----------|-------|--------|----------|------|---------|------|
| **madmom** | 1.3k+ | 최고 (DNN, MIREX 우승) | O (정밀) | 3-8초/4분곡 | BSD-2 | 1순위 |
| **librosa** | 7.2k+ | 양호 (onset DP) | O (`beat_track()`) | 2-5초/4분곡 | ISC | 2순위 (폴백) |
| essentia | 2.8k+ | 매우 높음 | O | 빠름 (C++) | **AGPL** | 라이선스 위험 |
| aubio | 3.2k+ | 양호 | O | 매우 빠름 | **GPL** | 라이선스 위험 |

**결론**: madmom (1순위) + librosa (폴백). 둘 다 라이선스 안전.

#### madmom 사용법

```python
from madmom.features.beats import DBNBeatTrackingProcessor, RNNBeatProcessor

proc = DBNBeatTrackingProcessor(fps=100)
act = RNNBeatProcessor()('audio.wav')
beats = proc(act)  # [0.52, 1.02, 1.52, 2.02, ...] 초 단위 비트 위치
bpm = 60.0 / np.median(np.diff(beats))  # BPM 계산
```

#### librosa 폴백

```python
import librosa

y, sr = librosa.load('audio.wav')
tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
beat_times = librosa.frames_to_time(beat_frames, sr=sr)
```

### JavaScript (프론트엔드)

| 라이브러리 | Stars | BPM | 비트 위치 | 번들 | 라이선스 |
|-----------|-------|-----|----------|------|---------|
| web-audio-beat-detector | 200+ | O | 제한적 | 15KB | MIT |
| Essentia.js | 700+ | O | O | 2-3MB WASM | **AGPL** |
| Meyda | 1.4k+ | X (특성 추출만) | X | 50KB | MIT |

**결론**: 프론트엔드 단독 BPM 감지는 정확도 부족. 백엔드 분석 추천.
web-audio-beat-detector는 로컬 파일 전용 경량 폴백으로 사용 가능.

---

## 3. 메트로놈 정밀 스케줄링 기법

### 핵심 원리: 두 개의 시계

- **JavaScript 시계** (setTimeout): ~4ms 최소 해상도, 실제 지터 10-50ms+
- **AudioContext 시계** (currentTime): ~0.02ms 정밀도 (44.1kHz 샘플 정확도), 하드웨어 구동

### Lookahead Scheduler 패턴 (Chris Wilson, Google Chrome 팀) - 추천

```
setTimeout (25ms 루프)
   |
   +---> [now, now+100ms] 범위 내 비트 탐색:
            OscillatorNode 생성
            oscillator.start(정확한_AudioContext_시간)
            oscillator.stop(시간 + 0.03)  // 30ms 클릭
```

**동작 원리:**
1. setTimeout이 ~25ms마다 스케줄러 루프 실행
2. 100ms 앞까지의 비트를 탐색
3. 해당 비트를 `OscillatorNode.start(정확한시간)`으로 스케줄링
4. setTimeout 지터는 무관 - 스케줄링이 재생 시점보다 충분히 앞서 발생

**핵심 파라미터:**
- `lookaheadInterval`: 25ms (setTimeout 주기)
- `scheduleAheadTime`: 100ms (미리 스케줄링할 범위)

### 구현 접근법 비교

| 접근법 | 정밀도 | 복잡도 | 백그라운드 탭 | 추천 |
|--------|--------|--------|-------------|------|
| **Lookahead Scheduler** | 서브밀리초 | 낮음 | X (setTimeout 제한) | 기본 |
| **Web Worker + Lookahead** | 서브밀리초 | 중간 | O (Worker 미제한) | 최종 추천 |
| **AudioWorklet** | 완벽 (오디오 스레드) | 높음 | O | 미래 고려 |

**최종 추천: Web Worker + Lookahead Scheduler**
- Worker 내 setTimeout은 백그라운드 탭에서도 제한 없음
- Worker가 `postMessage`로 메인 스레드에 스케줄링 요청
- 메인 스레드에서 `OscillatorNode.start()` 실행

### 클릭 사운드 생성

```typescript
// OscillatorNode로 클릭 생성 (파일 로딩 불필요)
const osc = audioContext.createOscillator();
osc.frequency.value = 880;  // 다운비트: 880Hz, 업비트: 440Hz
osc.connect(metronomeGainNode);
osc.start(exactTime);
osc.stop(exactTime + 0.03);  // 30ms 길이
```

---

## 4. 추천 아키텍처

### 접근 방식: 하이브리드 (백엔드 분석 + 프론트엔드 메트로놈)

**이유:**
1. BPM 감지 정확도: Python madmom이 JS보다 월등
2. 메트로놈 정밀도: Web Audio API만이 서브밀리초 보장
3. 기존 패턴 활용: 스템 분리와 동일한 API 패턴 (업로드 -> 분석 -> 결과 사용)

### 데이터 흐름

```
[사용자 오디오 로드]
     |
     v
[Backend] POST /api/v1/bpm/analyze
     |  madmom DBNBeatTracker
     |  Response: { bpm: 120.0, beats: [0.52, 1.02, 1.52, ...], confidence: 0.95 }
     v
[Frontend] bpmStore에 저장
     |
     v
[재생 중: onTimeUpdate 콜백]
     |
     v
[MetronomeEngine.syncToPlaybackTime(currentTime)]
     |  Lookahead: 다음 100ms 내 비트 탐색
     v
[OscillatorNode.start(정밀시간)] → GainNode(메트로놈 볼륨) → Destination
```

### 오디오 그래프 통합

```
[기존 파이프라인]
ScriptProcessorNode → GainNode(마스터) → AnalyserNode → Destination

[메트로놈 추가 - 별도 경로]
OscillatorNode → GainNode(메트로놈) → Destination
```

**메트로놈이 SoundTouch 파이프라인을 우회하는 이유:**
- 메트로놈 클릭은 피치/속도 변환 불필요
- 독립적 볼륨 제어 필요
- ScriptProcessorNode의 청크 처리(~93ms)에 영향받지 않음

### 속도 변경 동기화

```
// 비트 타임스탬프: 원본 시간 기준 (속도 무관)
beats = [0.52, 1.02, 1.52, ...]  // 원본 시간

// 현재 위치도 원본 시간
currentTime = simpleFilter.sourcePosition / sampleRate

// AudioContext 시간으로 변환 (속도 반영)
scheduleTime = audioContext.currentTime + (beatTime - currentTime) / currentSpeed

// 속도 0.8x 예시:
// 다음 비트까지 원본 시간 0.5초 → 실제 0.625초 후 재생
```

---

## 5. 기존 기능 통합 방안

| 기능 | 메트로놈 동작 |
|------|-------------|
| **A-B 루프** | 루프 구간 내 비트만 클릭. 루프백 시 비트 인덱스 리셋 |
| **속도 변경** | 유효 BPM = 원본 BPM x 속도 (자동 계산). 스케줄링 자동 보정 |
| **피치 변경** | 메트로놈 영향 없음 (별도 오디오 경로) |
| **스템 믹서** | 동일 AudioContext 공유로 자동 동기화 |
| **Seek** | 새 위치에서 이진 검색으로 가장 가까운 다음 비트부터 재개 |
| **Pause/Resume** | 일시정지 시 스케줄러 중단, 재개 시 sourcePosition 기반 재동기화 |

---

## 6. 파일 영향 분석

### 신규 파일 (프론트엔드: 6개)

| 파일 | 용도 |
|------|------|
| `src/core/MetronomeEngine.ts` | Web Audio API 메트로놈 (Lookahead Scheduler) |
| `src/stores/bpmStore.ts` | BPM, 비트 위치, 메트로놈 상태 (Zustand) |
| `src/hooks/useMetronome.ts` | 메트로놈 라이프사이클, AudioEngine 연동 |
| `src/api/bpm.ts` | BPM 분석 API 클라이언트 |
| `src/components/Metronome/MetronomePanel.tsx` | BPM 표시, 토글, 볼륨 UI |
| `src/workers/metronome-worker.ts` | Web Worker 타이머 (백그라운드 탭 지원) |

### 신규 파일 (백엔드: 3개)

| 파일 | 용도 |
|------|------|
| `backend/app/routes/bpm.py` | POST /api/v1/bpm/analyze 엔드포인트 |
| `backend/app/services/bpm_service.py` | madmom/librosa BPM 감지 서비스 |
| `backend/tests/test_bpm.py` | BPM API 테스트 |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/core/index.ts` | MetronomeEngine export 추가 |
| `src/hooks/useAudioEngine.ts` | onTimeUpdate에 메트로놈 동기화 추가 |
| `src/hooks/usePlayback.ts` | play/pause/stop에 메트로놈 시작/중단 연동 |
| `src/utils/constants.ts` | METRONOME 상수 추가 |
| `backend/requirements.txt` | madmom, librosa 의존성 추가 |

---

## 7. 구현 순서

| Phase | 작업 | 의존성 | 병렬 가능 |
|-------|------|--------|----------|
| 1 | Backend BPM 서비스 + API | 없음 | O |
| 2 | bpmStore (Zustand) | 없음 | O |
| 3 | MetronomeEngine (핵심 엔진) | 없음 | O |
| 4 | API 클라이언트 (src/api/bpm.ts) | Phase 1 | |
| 5 | useMetronome 훅 | Phase 2, 3 | |
| 6 | useAudioEngine/usePlayback 통합 | Phase 5 | |
| 7 | MetronomePanel UI | Phase 2, 4, 5 | |
| 8 | A-B 루프 통합 | Phase 6 | |

Phase 1, 2, 3은 병렬 실행 가능.

---

## 8. 리스크 및 완화 방안

| 리스크 | 완화 방안 |
|--------|----------|
| madmom Python 3.13 호환성 | librosa 폴백 제공; 설치 전 호환성 검증 |
| ScriptProcessorNode 지원 중단 | 현재 안정적; AudioWorklet 마이그레이션은 별도 작업 |
| 장시간 재생 시 드리프트 | Lookahead가 25ms마다 sourcePosition 기반 재동기화; 누적 불가 |
| AudioContext 공유 문제 | MetronomeEngine에 AudioContext를 파라미터로 전달 |
| 복잡한 박자 (변박) | 초기 버전은 고정 BPM; 향후 tempo map 지원 가능 |

---

## 참고 자료

- Chris Wilson "A Tale of Two Clocks" - Web Audio 정밀 타이밍의 정석
- MDN Web Audio API: AudioContext.currentTime
- madmom GitHub: CPJKU/madmom
- librosa GitHub: librosa/librosa

---

조사일: 2026-02-17
조사 방식: 3-agent 병렬 팀 (researcher + analyst + architect)
