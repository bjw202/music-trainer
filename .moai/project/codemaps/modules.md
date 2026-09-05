# 모듈 카탈로그

> 책임 설명은 파일 이름이 아니라 실제 코드에서 추론했습니다. 줄 수는 `wc -l` 실측값입니다.
> 상위 문서: [overview.md](./overview.md)

## 프론트엔드

### `src/core/` — 도메인 엔진 (2,202줄)

React를 전혀 모르는 순수 Web Audio 계층입니다. 이 폴더만 떼어내도 동작합니다.

| 파일 | 줄 | 책임 |
|---|---:|---|
| `StemMixer.ts` | 775 | 4스템 동시 재생 엔진. 내부에 두 번째 클래스 `MixerAudioSource`를 두고 4개 `WebAudioBufferSource`의 샘플을 직접 꺼내 solo/mute 게인을 적용하며 수동 믹싱한 뒤 soundtouchjs 파이프라인에 넣습니다. |
| `AudioEngine.ts` | 667 | 단일 트랙 재생 엔진. `AudioContext` 소유, 파일 디코드, `WebAudioBufferSource → SimpleFilter → ScriptProcessorNode → Gain → Analyser → destination` 파이프라인 구성, play/pause/stop/seek/setSpeed/setPitch 제공. 메트로놈이 붙는 리스너 집합 4종(시간/시크/속도변경/재생상태)을 노출합니다. |
| `MetronomeEngine.ts` | 314 | Lookahead 스케줄러. 인라인 Web Worker(Blob URL로 생성)가 25ms마다 틱을 보내면 앵커 기반 선형 보간으로 현재 재생 위치를 추정하고, 100ms 앞까지 `OscillatorNode` 클릭을 예약합니다. |
| `WaveformRenderer.ts` | 271 | **미사용.** `core/index.ts:9`에서 export되지만 어디서도 import되지 않습니다. 실제 wavesurfer.js 인스턴스는 `src/hooks/useWaveform.ts`가 직접 만듭니다. |
| `ABLoopManager.ts` | 165 | **미사용.** `core/index.ts:8`에서 export되지만 인스턴스화되지 않습니다. 실제 A-B 반복 로직은 `useAudioEngine.ts`와 `useStemMixer.ts`에 각각 인라인으로 구현되어 있습니다. |
| `index.ts` | 10 | 위 5개 배럴 export (미사용 2개 포함). |

> `StemMixer.ts`의 크기는 실제 DSP 복잡도로 상당 부분 정당화되지만, 파이프라인 구성/해제·시간 업데이트·play/pause/stop/seek 패턴은 `AudioEngine.ts`와 구조적으로 거의 동일합니다. 공통 베이스 클래스나 `SoundTouchPipeline` 모듈로 추출할 여지가 큽니다.

### `src/hooks/` — 배선 계층 (1,947줄)

엔진과 스토어를 React 생명주기에 붙이는 접착제입니다. 여기에 도메인 로직이 들어가면 안 되지만 A-B 반복 판정은 예외적으로 여기 있습니다.

| 파일 | 줄 | 책임 |
|---|---:|---|
| `useStemMixer.ts` | 289 | `StemMixer` 생성/해제, 스템 버퍼 로드, A-B 반복 판정(인라인), 스토어 동기화. |
| `useKeyboardShortcuts.ts` | 278 | 전역 keydown → 재생/구간/속도 액션 바인딩. |
| `useSeparation.ts` | 268 | 분리 요청 → SSE 진행률 구독 → 완료 대기 폴링 → ZIP 다운로드·디코드까지의 비동기 오케스트레이션. |
| `useWaveform.ts` | 230 | wavesurfer.js 인스턴스 생성·설정·regions 플러그인 연결. |
| `useMetronome.ts` | 208 | `MetronomeEngine`을 `AudioEngine`의 리스너 4종에 배선. `StemMixer`에는 연결되지 않습니다. |
| `usePlayback.ts` | 165 | 스토어의 재생 의도를 활성 엔진의 메서드 호출로 변환. |
| `useFileLoader.ts` | 136 | 드래그앤드롭/파일 입력 처리, 확장자·크기 검증. |
| `useYouTubeConvert.ts` | 132 | URL 검증 → 변환 요청 → SSE 구독(지수 백오프 재연결) → 파일 수신. |
| `useAudioEngine.ts` | 130 | `AudioEngine` 생성/해제, 파일 로드, 볼륨 동기화, A-B 반복 판정(인라인). |
| `useSpeedPitch.ts` | 102 | `controlStore`의 속도/피치를 활성 엔진에 반영. |
| `index.ts` | 9 | 배럴 export. |

### `src/stores/` — Zustand 스토어 7개 (909줄)

루트 스토어 없이 독립적으로 존재합니다.

| 파일 | 줄 | 소유 상태 |
|---|---:|---|
| `stemStore.ts` | 396 | 분리 태스크 상태·진행률 + 스템 오디오 버퍼 + 믹서 게인/뮤트/솔로 + 스템 모드 플래그. **세 가지 관심사가 한 스토어에 섞여 있습니다.** |
| `bpmStore.ts` | 106 | BPM 분석 결과·비트 배열 + 메트로놈 on/off·볼륨. `analyzeBpm` 액션은 `src/api/bpm.ts`에 위임합니다. |
| `controlStore.ts` | 92 | 볼륨 · 뮤트 · 속도 · 피치. |
| `youtubeStore.ts` | 87 | 변환 상태 · 진행률 · 에러. |
| `playerStore.ts` | 82 | `isPlaying` · `currentTime` · `duration`. |
| `audioStore.ts` | 80 | 현재 파일 · 디코드된 버퍼 · 로딩/에러 상태. |
| `loopStore.ts` | 66 | A/B 지점 · 반복 활성화 여부. |

**소유권 중복 지점** — 상태 버그를 찾을 때 먼저 볼 곳입니다:

- `playerStore.currentTime`을 쓰는 주체가 셋입니다: `AudioEngine`의 rAF 루프, `StemMixer`의 자체 rAF 루프, 그리고 파형 시크 핸들러. 마지막에 쓴 쪽이 이깁니다. 스템 모드를 켜고 끌 때 `Player.tsx`가 두 엔진의 위치를 손으로 맞춥니다.
- 볼륨 동기화가 `useAudioEngine` 내부(엔진용)와 `Player.tsx`(믹서용)로 갈라져 있습니다. 같은 관심사인데 소유자가 다릅니다.
- 메트로놈 on/off는 `bpmStore`에, 재생 여부는 `playerStore`에 있어 `useMetronome`이 둘을 이어붙입니다.

### `src/components/` — 화면 (2,703줄)

| 폴더 | 줄 | 역할 |
|---|---:|---|
| `Player/` | 550 | **조립 루트이자 god 컴포넌트.** 훅 9개를 부팅하고, `AudioEngine`↔`StemMixer` 중 활성 엔진을 결정하며, 모드 전환 시 두 엔진의 재생 위치를 동기화하고, 전체 UI 트리를 렌더합니다. 엔진 전환 상태 기계가 컴포넌트 안에 있어 단독 테스트가 불가능합니다. |
| `StemMixer/` | 585 | 분리 버튼 · 진행률 표시 · 스템별 트랙(볼륨/뮤트/솔로) 패널. |
| `FileLoader/` | 338 | 드래그앤드롭 존 · 파일 선택 · 로드 모달(YouTube 섹션 포함). |
| `YouTube/` | 277 | URL 입력 · 진행 바 · 에러 표시 · 섹션 컨테이너. |
| `SpeedPitch/` | 256 | 속도 슬라이더 · 피치 컨트롤 · 패널. |
| `Metronome/` | 174 | BPM 표시 · 분석 트리거 · on/off · 볼륨. |
| `ABLoop/` | 162 | A/B 지점 설정 컨트롤 · 현재 구간 표시. |
| `Volume/` | 140 | 볼륨 슬라이더 · 뮤트 버튼. |
| `Controls/` | 114 | 재생 · 정지 · 시간 표시. |
| `Layout/` | 53 | 앱 셸 · 헤더. |
| `Waveform/` | 34 | wavesurfer 호스트 div. |

표의 합은 2,683줄이고, 나머지 20줄은 폴더에 속하지 않는 `src/components/index.ts` 배럴입니다.

`Player/`를 제외한 나머지는 props와 스토어 구독으로만 동작하는 표현 계층입니다.

### `src/api/` — HTTP 통합 (534줄)

| 파일 | 줄 | 상태 |
|---|---:|---|
| `separation.ts` | 250 | 업로드 · SSE 진행률 구독 · 스템 ZIP 다운로드/해제/디코드. `client.ts`를 쓰지 않고 자체 `fetch`. |
| `youtube.ts` | 105 | 변환 요청 · SSE 구독(수동 재연결 최대 3회) · 다운로드 URL. `apiClient.post` / `getFullUrl` 사용. |
| `client.ts` | 87 | 공용 fetch 래퍼 + `ApiRequestError` + `getFullUrl`. **베이스 URL의 유일한 소유자.** `youtube.ts`가 `post`를, `bpm.ts`가 `getFullUrl`을 씁니다. |
| `bpm.ts` | 53 | BPM 분석 요청. `bpmStore`가 이 함수에 위임합니다. multipart 업로드라 `apiClient.post`(JSON 전용)는 못 쓰고 `getFullUrl`로 주소만 빌려 씁니다. |
| `types.ts` | 39 | API 요청/응답 타입 정의. |

### `src/utils/` · `src/workers/` · 기타

| 파일 | 줄 | 비고 |
|---|---:|---|
| `utils/constants.ts` | 67 | 단축키 · 속도/피치 한계 · 메트로놈 상수. 메트로놈 상수 중 `MIN_VOLUME`/`MAX_VOLUME`만 실제로 소비되고, 나머지(클릭 주파수·lookahead 타이밍)는 `MetronomeEngine.ts`가 자체 리터럴로 하드코딩합니다 — 값을 고쳐도 엔진 동작이 안 바뀝니다. |
| `utils/fileUtils.ts` | 50 | 파일 확장자/크기 검증. |
| `utils/audioUtils.ts` | 44 | 오디오 관련 계산 헬퍼. |
| `utils/timeUtils.ts` | 15 | `mm:ss` 포맷팅. |
| `workers/metronome-worker.ts` | 41 | **미사용.** 진짜 워커는 `MetronomeEngine.ts` 안에 문자열로 인라인되어 Blob URL로 생성됩니다. 같은 25ms 틱 로직의 사본 두 개가 갈라져 존재합니다. |
| `types/soundtouchjs.d.ts` | 86 | soundtouchjs가 타입을 제공하지 않아 직접 작성한 앰비언트 선언. |
| `test/setup.ts` | 80 | Vitest 환경 설정 (jsdom, Web Audio 목). |

## 백엔드

### `backend/app/routes/` — HTTP 경계 (686줄)

| 파일 | 줄 | 책임 |
|---|---:|---|
| `separation.py` | 302 | 업로드 검증(content-type·크기) → 임시 파일 저장 → `asyncio.create_task`로 분리 실행(추적·취소 불가) → SSE 진행률(1초 폴링) → 단일 스템/전체 ZIP 다운로드. **서비스의 private 메서드 `_update_progress`를 라우트에서 직접 호출합니다** (131·136행). |
| `youtube.py` | 204 | 변환/진행률/다운로드. 이 프로젝트에서 **유일하게 레이트 리밋을 적용하는 라우트**입니다(67행). |
| `bpm.py` | 123 | `/analyze` 단일 엔드포인트. `bpm_service` 얇은 통과. |
| `health.py` | 57 | ffmpeg 가용성 · 디스크 여유 · 진행 중 변환 수. |

### `backend/app/services/` — 외부 도구 래핑 (1,439줄)

| 파일 | 줄 | 책임 |
|---|---:|---|
| `separation_service.py` | 635 | demucs/torch/torchaudio를 지연·선택적으로 import(`_DEMUCS_AVAILABLE` 플래그). SHA256 기반 스템 캐시. **실행 경로가 셋입니다**: 진짜 Demucs 분리 → (없으면) ffmpeg로 원본을 4번 복사 → (ffmpeg도 없으면) 5초 무음 WAV 생성. 프론트엔드에는 어느 경로였는지 알릴 필드가 없습니다. |
| `bpm_service.py` | 359 | BPM·비트 검출. madmom 경로(Python 3.13 호환 몽키패치 포함)와 librosa 폴백이 있으나, `requirements.txt`에서 madmom이 주석 처리되어 **실제로는 librosa 경로만 실행됩니다.** |
| `youtube_service.py` | 272 | yt-dlp 래핑. 태스크 생성·정보 추출·다운로드·상태 dict. |
| `cleanup_service.py` | 173 | 만료된 다운로드/스템 파일 정리. 라우트가 아니라 `main.py` lifespan에서만 호출됩니다. |

### `backend/app/models/` · `utils/` · 설정

| 파일 | 줄 | 책임 |
|---|---:|---|
| `models/schemas.py` | 115 | Pydantic 요청/응답 모델. `validators.validate_youtube_url`을 검증기로 사용. |
| `config.py` | 69 | pydantic-settings `Settings`. 다운로드 경로 · 최대 길이(1800초) · 동시 다운로드(5) · 분당 요청(10) · CORS origin · 포트(8000). `get_settings()`는 독스트링이 "싱글턴"이라 하지만 `@lru_cache`가 없어 호출할 때마다 새 인스턴스를 만듭니다. |
| `utils/validators.py` | 86 | YouTube URL 호스트/스킴 허용 목록. |
| `utils/rate_limiter.py` | 60 | IP별 60초 슬라이딩 윈도우. `youtube.py`에서만 사용됩니다. |
| `main.py` | 139 | 앱 팩토리 · CORS · 요청 로깅 미들웨어 · 라우터 4개 마운트 · lifespan 백그라운드 작업 2개. |

---

*상세 의존 관계는 [dependencies.md](./dependencies.md), 동작 순서는 [data-flow.md](./data-flow.md)를 보세요.*
