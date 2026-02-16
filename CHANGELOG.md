# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-02-15

### Added

- **AI 음원 분리 (SPEC-STEM-001)**: Demucs htdemucs 모델로 4개 스템 분리
  - vocals, drums, bass, other 4개 스템으로 자동 분리
  - 실시간 분리 진행률 표시 (SSE)
  - 파일 해시 기반 캐싱으로 재분리 방지

- **스템 믹서 오디오 엔진**: 멀티트랙 재생 엔진
  - 4개 스템 동시 재생
  - 개별 볼륨 제어 (0-100%)
  - 솔로/뮤트 기능
  - SoundTouch 통합으로 속도/피치 동기화

- **스템 믹서 UI**: Logic Pro 스타일 믹서 패널
  - StemMixerPanel, StemTrack 컴포넌트
  - 스템별 색상 코딩 (보라/주황/초록/파랑)
  - SeparationButton, SeparationProgress 컴포넌트

- **백엔드 분리 API**: 3개 엔드포인트
  - POST /api/v1/separate - 파일 업로드 및 분리 시작
  - GET /api/v1/separate/{task_id}/progress - SSE 진행률
  - GET /api/v1/separate/{task_id}/stems/{stem_name} - 스템 다운로드

- **E2E 테스트**: 스템 믹서 전체 시나리오 테스트
  - 32개 테스트 케이스 (Mock API + Web Audio 검증)

### Fixed

- Player: 새 파일 로드 시 stem 상태 완전 초기화 (LoadAudioModal + 드래그앤드롭 통합)
  - StemMixer 재생 중 정지 처리
  - setStemMode(false), setIsStemPlayable(false), reset() 호출로 전체 stem 상태 초기화
  - handleLoadNewFile 래퍼 함수로 모든 파일 로드 경로 통합
- torchcodec 0.10.0 설치 (torchaudio 2.10.0 필수 의존성)
- Demucs apply_model segment=12 파라미터 제거 (모델 기본값 7.8초 사용)
- cleanup_service: SeparationTask dataclass 지원 (dict + dataclass 호환)
- useSeparation: CPU 기반 Demucs 분리 타임아웃 10분 → 30분 증가

### Technical Details

- **Backend**: Demucs 4.x, PyTorch (CPU), FastAPI SSE
- **Frontend**: soundtouchjs, Web Audio API ScriptProcessorNode
- **Architecture**: 4x WebAudioBufferSource -> ScriptProcessorNode -> SoundTouch -> GainNode

## [0.2.0] - 2026-02-15

### Added

- **재생 중 파일 교체 모달**: 재생 중 새로운 오디오 파일 로드를 위한 LoadAudioModal 구현
  - "새 파일 로드" 버튼으로 모달 오픈
  - YouTube URL 입력 지원 (YouTube 섹션 재사용)
  - 드래그 앤 드롭 파일 로딩 지원
  - 파일 브라우저 선택 지원
  - ESC 키 및 배경 클릭으로 모달 닫기
  - 로드 성공 시 자동으로 모달 닫힘

- **YouTube 변환 기능 (SPEC-API-001)**: YouTube URL에서 MP3 오디오 자동 추출
  - YouTube URL 입력 UI 컴포넌트
  - 실시간 변환 진행률 표시 (SSE)
  - 변환 완료 후 자동 오디오 로드
  - 에러 상태 표시 및 재시도 기능
  - 변환 취소 버튼

- **Backend Server (FastAPI)**: Python 기반 REST API 서버
  - `POST /api/v1/youtube/convert` - YouTube URL 변환 시작
  - `GET /api/v1/youtube/progress/{task_id}` - SSE 진행률 스트리밍
  - `GET /api/v1/youtube/download/{task_id}` - 변환된 MP3 다운로드
  - `GET /api/v1/health` - 서버 헬스 체크
  - yt-dlp 비동기 래핑 (`run_in_executor`)
  - 동시 다운로드 세마포어 (최대 5개)
  - IP 기반 요율 제한 (분당 10회)
  - 자동 파일 정리 (10분 간격, 1시간 만료)

- **Frontend Integration**: YouTube 변환 프론트엔드 통합
  - `youtubeStore` - Zustand 상태 관리
  - `useYouTubeConvert` 커스텀 훅
  - API 클라이언트 모듈 (TypeScript)
  - SSE 클라이언트 (EventSource API)
  - 클라이언트 측 URL 검증

- **Testing**: 65개 pytest 테스트 전체 통과
  - Backend 단위 테스트 (YouTube API, Service)
  - E2E 테스트 5건 (Playwright)
    - E2E-1: 실제 YouTube URL 전체 파이프라인 검증
    - E2E-2: YouTube 단축 URL 파이프라인 검증
    - E2E-3: 변환된 오디오에 속도/피치 제어 적용 검증
    - 에러 시나리오 2건

### Technical Details

- **Backend**: Python 3.12+, FastAPI 0.129.0+, yt-dlp 2026.2.4+, ffmpeg
- **Frontend**: TypeScript 타입 안전성, Fetch API 기반 HTTP 클라이언트
- **Security**: CORS 설정, URL 화이트리스트, 입력 검증, 타임아웃 (5분)
- **Performance**: 비동기 처리, 파일 스트리밍, 자동 정리

### Fixed

- **LoadAudioModal React Hooks 규칙 위반 수정**: useCallback이 조건부 return 이후에 호출되는 문제 수정
  - 모든 Hook 호출을 조건부 return 이전으로 이동
  - React Hooks 규칙 준수

- YouTube 변환 파이프라인 버그 3건 수정 (커밋 3ba3cbc)
  - Backend: download 엔드포인트에서 title이 None일 때 TypeError 수정
  - Frontend: ProgressBar data-testid 불일치 수정
  - Frontend: useYouTubeConvert에서 AudioEngine.loadFile 경유하도록 수정

## [0.1.0] - 2026-02-14

### Added

- **Audio Engine**: Web Audio API 기반 오디오 엔진 구현
  - AudioContext 생명주기 관리
  - 오디오 버퍼 로딩 및 디코딩
  - 재생/일시정지/정지 제어
  - 시간 탐색 (seek)
  - 볼륨 제어

- **A-B Loop**: 구간 반복 재생 기능
  - A 지점 / B 지점 설정
  - 루프 활성화/비활성화
  - 루프 영역 시각화

- **Waveform Visualization**: 파형 시각화
  - wavesurfer.js 통합
  - 클릭으로 탐색
  - 재생 진행 표시

- **File Loader**: 파일 로딩
  - 드래그 앤 드롭 지원
  - MP3, WAV, M4A, OGG 형식 지원
  - 파일 크기 표시

- **Keyboard Shortcuts**: 키보드 단축키
  - Space: 재생/일시정지
  - I/O: A/B 지점 설정
  - A: A 지점으로 이동
  - M: 뮤트 토글
  - 화살표: 5초 탐색

- **State Management**: Zustand 스토어
  - audioStore: 오디오 상태
  - playerStore: 플레이어 상태
  - controlStore: 컨트롤 상태
  - loopStore: 루프 상태

- **UI Components**: 14개 UI 컴포넌트
  - Layout (Header, Footer)
  - FileLoader (DropZone)
  - Waveform (WaveformDisplay)
  - Controls (PlayButton, StopButton)
  - Volume (VolumeSlider, MuteButton)
  - ABLoop (ABLoopControls)
  - Player (Player)

- **Testing**: 190개 단위 테스트
  - AudioEngine 테스트
  - ABLoopManager 테스트
  - WaveformRenderer 테스트
  - 스토어 테스트
  - 유틸리티 테스트

### Technical Details

- React 19.0.0
- TypeScript 5.9.x (strict mode)
- Vite 6.x
- Tailwind CSS 4.x
- Zustand 5.x
- wavesurfer.js 7.8.x
- Vitest + React Testing Library
