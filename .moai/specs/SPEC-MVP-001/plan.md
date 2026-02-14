# SPEC-MVP-001: Implementation Plan

## 개발 방법론

Hybrid (TDD for new + DDD for audio integration)
- 신규 코드 (utils, stores, hooks): TDD (RED-GREEN-REFACTOR)
- 오디오 엔진 통합 (core/, wavesurfer.js): DDD (ANALYZE-PRESERVE-IMPROVE)

---

## Task Decomposition (7개 도메인, 35개 태스크)

### Domain 1: Audio Engine (core/)

**Task 1.1: AudioEngine.ts**
- AudioContext 초기화 및 생명주기 관리
- AudioBuffer 생성 및 메모리 관리
- Signal graph: BufferSource -> GainNode -> AnalyserNode -> Destination
- Dependencies: None
- Methodology: DDD (Web Audio API 통합)
- Tests: Unit tests for context creation, buffer loading, node connections

**Task 1.2: ABLoopManager.ts**
- A/B 지점 상태 관리 (loopStore 연동)
- 재생 위치 감시 및 루프 백 트리거
- Dependencies: AudioEngine.ts
- Methodology: DDD
- Tests: Unit tests for A/B point setting, loop back logic

**Task 1.3: WaveformRenderer.ts**
- wavesurfer.js 7.8.x 연동
- requestAnimationFrame 기반 실시간 업데이트
- Dependencies: AudioEngine.ts
- Methodology: DDD (라이브러리 통합)
- Tests: Component tests for canvas rendering

### Domain 2: State Management (stores/)

**Task 2.1: audioStore.ts**
- 파일 상태 (file, buffer, metadata)
- 로딩 상태 관리
- Dependencies: None
- Methodology: TDD
- Tests: Unit tests for state transitions

**Task 2.2: playerStore.ts**
- 재생 상태 (playing/paused/stopped)
- 현재 시간, 전체 길이
- Dependencies: None
- Methodology: TDD
- Tests: Unit tests for playback state transitions

**Task 2.3: controlStore.ts**
- 볼륨 상태 (0-100%), 뮤트 상태, 이전 볼륨 저장
- Dependencies: None
- Methodology: TDD
- Tests: Unit tests for volume change, mute/unmute

**Task 2.4: loopStore.ts**
- A 지점, B 지점, 루프 활성화 상태
- Dependencies: None
- Methodology: TDD
- Tests: Unit tests for A/B point setting, loop toggle

### Domain 3: UI Components (components/)

**Task 3.1: Layout/AppLayout.tsx, Header.tsx**
- 전체 레이아웃 구조, 헤더
- Dependencies: None
- Methodology: TDD
- Tests: Component tests for layout rendering

**Task 3.2: FileLoader/DragDropZone.tsx, FileSelector.tsx**
- 드래그 앤 드롭 영역, 파일 선택 다이얼로그
- Dependencies: audioStore, fileUtils
- Methodology: TDD
- Tests: Component tests for file validation

**Task 3.3: Waveform/Waveform.tsx**
- wavesurfer.js 래퍼 컴포넌트, 파형 클릭 이벤트 처리
- Dependencies: WaveformRenderer.ts, playerStore
- Methodology: DDD
- Tests: Component tests, visual regression

**Task 3.4: Controls/PlayButton.tsx, StopButton.tsx**
- 재생 제어 버튼, 상태 기반 활성화/비활성화
- Dependencies: playerStore
- Methodology: TDD
- Tests: Component tests for button states

**Task 3.5: Controls/TimeDisplay.tsx**
- 현재 시간 및 전체 길이 표시 (mm:ss)
- Dependencies: playerStore, timeUtils
- Methodology: TDD
- Tests: Unit tests for time formatting

**Task 3.6: Volume/VolumeSlider.tsx, MuteButton.tsx**
- 볼륨 슬라이더 및 뮤트 토글
- Dependencies: controlStore
- Methodology: TDD
- Tests: Component tests for slider interaction

**Task 3.7: ABLoop/ABLoopControls.tsx, ABLoopDisplay.tsx**
- A/B 버튼, 루프 토글, 루프 영역 표시
- Dependencies: loopStore
- Methodology: TDD
- Tests: Component tests

**Task 3.8: Player/Player.tsx**
- 메인 플레이어 컨테이너, 전체 상태 통합
- Dependencies: All stores, all child components
- Methodology: DDD (통합)
- Tests: Component tests, E2E tests

### Domain 4: Hooks (hooks/)

**Task 4.1: useAudioEngine.ts**
- AudioEngine 초기화 및 정리, React 생명주기 연동
- Dependencies: AudioEngine.ts
- Methodology: DDD
- Tests: Hook tests

**Task 4.2: useKeyboardShortcuts.ts**
- 키보드 이벤트 리스너, 단축키 매핑 (Space, Arrow, I/O, A, M)
- 'A' 키: 루프 활성 시 A 지점으로 이동, 비활성 시 무반응
- Dependencies: playerStore, loopStore, controlStore
- Methodology: TDD
- Tests: Hook tests for keyboard events (A 키 루프 조건부 동작 포함)

**Task 4.3: usePlayback.ts**
- 재생/일시정지/정지 로직
- Dependencies: AudioEngine.ts, playerStore
- Methodology: DDD
- Tests: Hook tests

**Task 4.4: useWaveform.ts**
- 파형 렌더링 동기화
- Dependencies: WaveformRenderer.ts, playerStore
- Methodology: DDD
- Tests: Hook tests

**Task 4.5: useFileLoader.ts**
- 파일 로딩 로직
- Dependencies: audioStore, audioUtils
- Methodology: TDD
- Tests: Hook tests

### Domain 5: Utilities (utils/)

**Task 5.1: audioUtils.ts**
- 오디오 형식 검증 (MP3, WAV, M4A, OGG)
- 파일 -> ArrayBuffer 변환
- Dependencies: None
- Methodology: TDD
- Tests: Unit tests (100% coverage)

**Task 5.2: timeUtils.ts**
- 시간 포맷팅 (seconds -> mm:ss)
- Dependencies: None
- Methodology: TDD
- Tests: Unit tests (100% coverage)

**Task 5.3: fileUtils.ts**
- 파일 처리 유틸리티
- Dependencies: None
- Methodology: TDD
- Tests: Unit tests (100% coverage)

**Task 5.4: constants.ts**
- 상수 정의 (키보드 단축키, 시간 간격 등)
- Dependencies: None
- Methodology: TDD

### Domain 6: Tests (tests/)

**Task 6.1: E2E - playback.spec.ts**
- 파일 로드 -> 재생 -> 일시정지 -> 정지 흐름
- 실제 AudioContext 재생 검증
- Dependencies: All implementation

**Task 6.2: E2E - controls.spec.ts**
- 볼륨 슬라이더, 뮤트 토글, 키보드 단축키
- Dependencies: All implementation

**Task 6.3: E2E - abloop.spec.ts**
- A/B 지점 설정, 루프 백 동작
- Dependencies: All implementation

**Task 6.4: E2E - compound-independence.spec.ts** (핵심 추가)
- Category 1: 쌍별 독립성 (6개)
- Category 2: 순서 무관성 (2개)
- Category 3: 상호작용 중 상태 유지 (3개)
- Category 4: 빠른 연속 조작 (3개)
- Total: 14개 복합 독립성 테스트
- Dependencies: All implementation

**Task 6.5: Visual Regression - visual.spec.ts**
- 파형 렌더링, 재생 헤드, 루프 영역 스크린샷 비교
- Dependencies: All implementation

### Domain 7: UI Design (Pencil MCP)

**Task 7.1: player-layout.pen**
- 전체 플레이어 레이아웃 디자인
- Dark theme 컬러 팔레트 적용
- Desktop (1200x800) + Mobile (375x812)

**Task 7.2: controls-components.pen**
- 재생 버튼, 볼륨 슬라이더, A-B 루프 컨트롤
- 상태별 디자인 (Default, Hover, Active, Disabled)

**Task 7.3: waveform-theme.pen**
- 파형 색상, 재생 헤드, 루프 영역 강조
- Dependencies: player-layout.pen

---

## Dependency Graph (Tier)

```
Tier 1 (Independent - 병렬 실행 가능):
  stores/       -> audioStore, playerStore, controlStore, loopStore
  utils/        -> audioUtils, timeUtils, fileUtils, constants
  design/       -> player-layout.pen

Tier 2 (Depends on Tier 1):
  core/         -> AudioEngine.ts (audioStore)
  design/       -> controls-components.pen, waveform-theme.pen

Tier 3 (Depends on Tier 2):
  core/         -> ABLoopManager.ts, WaveformRenderer.ts
  components/   -> FileLoader, TimeDisplay, Layout

Tier 4 (Depends on Tier 3):
  hooks/        -> useAudioEngine, usePlayback, useWaveform, useKeyboardShortcuts, useFileLoader
  components/   -> Waveform, Controls, Volume, ABLoop

Tier 5 (Integration):
  components/   -> Player.tsx

Tier 6 (Verification):
  tests/e2e/    -> playback, controls, abloop, compound-independence, visual
```

---

## 리스크 평가

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| wavesurfer.js 모바일 성능 | Medium | High | Canvas 최적화, Web Worker |
| A-B Loop 레이턴시 > 50ms | Medium | High | AudioWorklet, 더블 버퍼링 |
| 메모리 누수 (장시간 세션) | Medium | High | AudioBuffer cleanup, E2E 프로파일링 |
| 기능 간 상태 간섭 | High | Critical | Layer 3.5 복합 독립성 테스트 |
| YouTube URL 기술 제약 | High | Medium | Phase 1.5로 연기 |

---

## 구현 순서 (권장)

1. **Phase A**: 프로젝트 초기화 + 디자인
   - Vite + React + TypeScript + Tailwind 프로젝트 셋업
   - Vitest + Playwright 테스트 환경 구성
   - Pencil 디자인 산출물 생성

2. **Phase B**: Core 도메인 (TDD)
   - utils/ (audioUtils, timeUtils, fileUtils)
   - stores/ (audioStore, playerStore, controlStore, loopStore)

3. **Phase C**: Audio Engine (DDD)
   - AudioEngine.ts (Web Audio API 통합)
   - WaveformRenderer.ts (wavesurfer.js 연동)
   - ABLoopManager.ts

4. **Phase D**: UI Components + Hooks
   - hooks/ (useAudioEngine, usePlayback 등)
   - components/ (FileLoader -> Controls -> Volume -> Waveform -> ABLoop)
   - Player.tsx (통합)

5. **Phase E**: E2E 테스트 + 품질 검증
   - 단일 기능 E2E (playback, controls, abloop)
   - 복합 독립성 E2E (compound-independence)
   - Visual regression
   - 커버리지 85%+ 확인

---

## 테스트 오디오 파일

```
public/test-audio/
  test-song.mp3          # 30초 일반 음악
  test-song.wav          # WAV 형식
  test-song.m4a          # M4A 형식
  test-song.ogg          # OGG 형식
  sine-440hz.wav         # 440Hz 사인파 (정밀 검증용)
```

---

## 다음 단계

SPEC 승인 후:
1. `/clear` 실행 (컨텍스트 확보)
2. `/moai run SPEC-MVP-001` 실행 (DDD 구현 시작)
3. Phase A부터 순차 진행
