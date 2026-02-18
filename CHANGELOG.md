# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-02-17

### Added

- **Speed Slider UI 개선**: 속도 제어 범위 슬라이더 추가
  - HTML range input 슬라이더 (0.5x - 2.0x, 0.01 단계)
  - 선형 그래디언트 진행률 시각화 (주황색 #FF6B35)
  - 크로스 브라우저 지원 (WebKit + Firefox)
  - 10px 원형 썸 디자인 with 다크 테마 통합
  - +/- 버튼 유지 (기존 기능 보존)
  - disabled 상태 지원

- **BPM 자동 감지 및 메트로놈 기능 (SPEC-BPM-001)**: madmom/librosa 기반 BPM 분석 및 Web Worker 메트로놈
  - 오디오 파일 로드 시 자동 BPM 분석 (madmom DBNBeatTracker primary, librosa fallback)
  - 감지된 BPM 및 신뢰도 점수 표시
  - 비트 타임스탬프 저장으로 정밀 메트로놈 동기화
  - Web Worker Lookahead Scheduler로 서브밀리초 타이밍 정밀도
  - OscillatorNode 클릭 사운드 (다운비트 880Hz, 업비트 440Hz)
  - 재생 속도 변경 시 자동 메트로놈 타이밍 조정
  - Seek 시 다음 비트부터 재동기화
  - A-B 루프 지원 (루프 구간 내 비트만 재생)
  - 독립 메트로놈 볼륨 제어 (0-100%)
  - 백엔드 BPM 분석 API: `POST /api/v1/bpm/analyze`
  - SHA256 파일 해시 기반 캐싱

### Technical Details

- **Backend**: madmom 0.17.0, librosa 0.10.2, FastAPI
- **Frontend**: Web Worker, OscillatorNode, Zustand bpmStore
- **Architecture**: 하이브리드 (백엔드 madmom 분석 + 프론트엔드 Lookahead Scheduler)
- **오디오 그래프**: 메트로놈은 SoundTouch 파이프라인 우회 (독립 GainNode -> Destination)
- **동기화**: 동일 AudioContext 공유, 원본 시간 기준 비트 타임스탬프

## [0.3.4] - 2026-02-17

### Reverted

- **Railway 배포 관련 변경사항 전면 롤백**: YouTube 정책으로 Railway 배포 포기
  - `backend/Dockerfile`: Railway PORT/healthcheck 변경 제거, 원본 복원
  - `backend/Dockerfile.optimized`: Railway 전용 파일 삭제
  - `backend/railway.json`: Railway 배포 설정 파일 삭제
  - `backend/app/config.py`: CORS 프로덕션 URL 제거, YouTube cookies 필드 제거, `list[str]` 타입 복원
  - `backend/app/main.py`: `cors_origins_list` → `cors_origins` 직접 사용, CORS 디버그 로깅 제거
  - `backend/app/services/youtube_service.py`: cookies 인증 기능 제거
  - `backend/.env.example`: YouTube cookies 환경변수 제거

### Kept

- `separation_service.py` torchaudio 호환성 수정 및 `split=True` 메모리 최적화 유지 (로컬 검증 완료)

### Technical Details

- YouTube 봇 탐지 문제로 Railway 서버 환경 배포 포기 결정
- 백엔드는 로컬 개발 환경 기준으로 운영

## [0.3.3] - 2026-02-17

### Verified

- **SPEC-BACKEND-001 Phase 1-2 검증 완료**: 실제 E2E 테스트 통과
  - Demucs htdemucs 모델 stem 분리: 5초/60초 오디오 모두 성공
  - split=True 메모리 최적화 확인: 60초 오디오 피크 메모리 57.7MB
  - API 통합 테스트 전체 통과 (업로드, 진행률, 개별 스템 다운로드, ZIP 다운로드)
  - 단위 테스트 101개 전체 통과
  - YouTube 쿠키 인증 코드 구현 확인 (프로덕션 봇 탐지는 향후 PO Token + Deno으로 해결 예정)

### Investigation Notes

- YouTube 봇 탐지 (2026년 현황): 쿠키만으로는 서버 환경에서 3-7일 유효, PO Token + Deno JS 런타임이 권장 방안
- 로컬 환경에서는 yt-dlp 쿠키 없이도 메타데이터 추출 성공 (봇 탐지는 Railway IP 대역 특유의 문제)
- 대안 기술 조사 완료: Invidious(사망), Cobalt(고장), OAuth(폐지), PO Token(유망)

## [0.3.2] - 2026-02-17

### Added

- **환경변수 로드 확인 로깅**: 프로덕션 디버깅 개선 (SPEC-BACKEND-001)
  - config.py에 YOUTUBE_COOKIES, CORS_ORIGINS 로드 상태 로깅 추가
  - Railway 환경에서 환경변수 설정 문제 즉시 진단 가능
  - 로그 출력으로 런타임 설정값 확인 용이성 향상

### Fixed

- **Railway 프로덕션 OOM 문제 해결**: Demucs 메모리 최적화 (SPEC-BACKEND-001)
  - Demucs `apply_model()` 호출 시 `split=True` 옵션 적용
  - 피크 메모리 사용량: ~1.5GB → ~318MB (79% 감소)
  - Railway 무료 플랜(512MB RAM) 환경에서 안정적 동작 보장
  - 374.6초(6.2분) 오디오 분리 테스트 통과

### Technical Details

- Related SPEC: SPEC-BACKEND-001 (백엔드 프로덕션 안정화 Phase 1-2)
- Memory optimization: Demucs split mode for 79% memory reduction
- Railway 환경변수 로드 확인: startup 로그에 설정 상태 출력
- Commits: c8edb48 (split 옵션), 969566b (로깅 추가)

## [0.3.1] - 2026-02-17

### Added

- **YouTube 인증 지원**: yt-dlp cookies 인증 기능 추가
  - YOUTUBE_COOKIES 환경변수로 base64 인코딩된 쿠키 전달
  - 로그인 필요 콘텐츠 및 연령 제한 영상 지원
  - 선택적 기능으로 기본 YouTube 다운로드는 쿠키 없이 작동

### Fixed

- **CORS 설정 문제 수정**: pydantic-settings JSON 우선 파싱 우회
  - pydantic-settings v2.6.0이 환경변수를 JSON으로 먼저 파싱하여 CORS_ORIGINS가 문자열로 처리되던 문제 해결
  - BeforeValidator로 문자열을 리스트로 변환하는 사전 검증 로직 추가
  - Railway 및 Vercel 환경에서 CORS 설정 정상 작동 확인

- **Railway 환경변수 전달 문제 해결**: CORS 기본값에 Vercel 프로덕션 URL 추가
  - Railway 컨테이너에 환경변수가 전달되지 않는 문제 확인
  - 임시 workaround로 코드 내 기본값에 Vercel 프로덕션 URL 추가
  - 기동 시 CORS 오리진 설정값을 로그로 출력하여 디버깅 용이성 향상

### Changed

- CORS 기본 오리진에 Vercel 프로덕션 URL 추가
  - 기본값: `["http://localhost:5173", "https://guitar-mp3-trainer.vercel.app"]`
  - Railway 환경변수 설정 없이도 프로덕션 환경 즉시 사용 가능

### Technical Details

- pydantic-settings BeforeValidator 활용한 타입 강제 변환
- Railway Dockerfile HEALTHCHECK 제거, railway.json healthcheck 사용
- backend/app/config.py 환경변수 파싱 로직 개선

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
