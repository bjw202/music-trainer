# Music Trainer 프로젝트 구조

## 디렉토리 구조

```
guitar-mp3-trainer-v2/                # 프로젝트 루트 (React SPA, Vite + TypeScript 기반)
├── src/
│   ├── components/                   # UI 컴포넌트 계층
│   │   ├── Player/                   # 메인 플레이어 컨테이너
│   │   │   ├── Player.tsx            # 플레이어 메인 컴포넌트
│   │   │   └── index.ts
│   │   ├── Waveform/                 # 파형 시각화
│   │   │   ├── Waveform.tsx          # wavesurfer.js 래퍼
│   │   │   └── index.ts
│   │   ├── Controls/                 # 재생 컨트롤 UI
│   │   │   ├── PlayButton.tsx
│   │   │   ├── StopButton.tsx
│   │   │   ├── TimeDisplay.tsx
│   │   │   └── index.ts
│   │   ├── Volume/                   # 볼륨 제어
│   │   │   ├── VolumeSlider.tsx
│   │   │   ├── MuteButton.tsx
│   │   │   └── index.ts
│   │   ├── SpeedPitch/               # 속도/피치 제어 (Phase 2)
│   │   │   ├── SpeedControl.tsx      # +/- 버튼 기반 0.01x 단위 속도 제어
│   │   │   ├── PitchControl.tsx      # +/- 버튼 기반 반음 단위 피치 제어
│   │   │   ├── SpeedPitchPanel.tsx   # 속도/피치 패널 컨테이너
│   │   │   └── index.ts
│   │   ├── ABLoop/                   # A-B 루프
│   │   │   ├── ABLoopDisplay.tsx
│   │   │   ├── ABLoopControls.tsx
│   │   │   └── index.ts
│   │   ├── FileLoader/               # 파일 로딩 UI
│   │   │   ├── DragDropZone.tsx
│   │   │   ├── FileSelector.tsx
│   │   │   └── index.ts
│   │   ├── Layout/                   # 레이아웃 컴포넌트
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── core/                         # 오디오 엔진 (React와 독립)
│   │   ├── AudioEngine.ts            # Web Audio API 래퍼
│   │   │   # AudioContext 관리, soundtouchjs 실시간 스트리밍, 노드 생성/제거
│   │   ├── WaveformRenderer.ts       # Canvas 기반 파형 렌더러
│   │   │   # requestAnimationFrame 기반 실시간 렌더링
│   │   ├── ABLoopManager.ts          # A-B 루프 로직
│   │   │   # 루프 범위 설정, 재생 위치 관리
│   │   └── index.ts
│   ├── stores/                       # 상태 관리 (Zustand)
│   │   ├── audioStore.ts             # 오디오 상태
│   │   │   # 현재 파일, 오디오 버퍼, 로딩 상태
│   │   ├── playerStore.ts            # 플레이어 상태
│   │   │   # 재생 중/일시정지, 현재 시간, 전체 길이
│   │   ├── controlStore.ts           # 제어 상태
│   │   │   # 속도, 피치, 볼륨
│   │   └── loopStore.ts              # A-B 루프 상태
│   │       # A 지점, B 지점, 루프 활성화 상태
│   ├── hooks/                        # 커스텀 React 훅
│   │   ├── useAudioEngine.ts         # 오디오 엔진 초기화 및 정리
│   │   ├── useSpeedPitch.ts          # 속도/피치 제어 로직 (soundtouchjs 연동)
│   │   ├── useKeyboardShortcuts.ts   # 키보드 단축키 처리
│   │   ├── useFileLoader.ts          # 파일 로딩 로직
│   │   ├── usePlayback.ts            # 재생 제어
│   │   ├── useWaveform.ts            # 파형 시각화
│   │   └── index.ts
│   ├── utils/                        # 유틸리티 함수
│   │   ├── audioUtils.ts             # 오디오 형식 변환, 검증
│   │   ├── timeUtils.ts              # 시간 포맷팅 (mm:ss)
│   │   ├── fileUtils.ts              # 파일 처리 함수
│   │   └── constants.ts              # 상수 정의
│   ├── types/                        # TypeScript 타입 정의
│   │   └── soundtouchjs.d.ts         # soundtouchjs 라이브러리 타입 선언
│   ├── test/
│   │   └── setup.ts                  # 테스트 환경 설정
│   ├── App.tsx                       # 메인 앱 컴포넌트
│   ├── main.tsx                      # React DOM 진입점
│   ├── index.css                     # 글로벌 스타일
│   └── vite-env.d.ts                 # Vite 타입 선언
├── public/
│   └── test-audio/                   # E2E 테스트용 오디오 파일
│       ├── sine-440hz.wav
│       └── test-song.mp3
├── tests/
│   ├── unit/                         # Vitest 단위 테스트
│   │   ├── core/                     # 오디오 엔진 테스트
│   │   │   ├── AudioEngine.test.ts
│   │   │   ├── WaveformRenderer.test.ts
│   │   │   └── ABLoopManager.test.ts
│   │   ├── stores/                   # Zustand 스토어 테스트
│   │   │   ├── audioStore.test.ts
│   │   │   ├── playerStore.test.ts
│   │   │   ├── controlStore.test.ts
│   │   │   └── loopStore.test.ts
│   │   └── utils/                    # 유틸리티 함수 테스트
│   │       ├── audioUtils.test.ts
│   │       ├── timeUtils.test.ts
│   │       ├── fileUtils.test.ts
│   │       └── constants.test.ts
│   ├── component/                    # React 컴포넌트 테스트 (추가 예정)
│   └── e2e/                          # Playwright E2E 테스트
│       ├── helpers/
│       │   └── audio-loader.ts       # 오디오 로딩 헬퍼
│       ├── playback.spec.ts
│       ├── controls.spec.ts
│       ├── speed-pitch.spec.ts
│       ├── abloop.spec.ts
│       ├── compound-independence.spec.ts
│       ├── audio-processing.spec.ts
│       ├── worker-processing.spec.ts
│       ├── worker-logs.spec.ts
│       └── visual.spec.ts
├── my-docs/                          # 프로젝트 설계 및 아키텍처 문서
│   ├── project-design.md             # 전체 프로젝트 설계 문서
│   ├── test-design.md                # 테스트 전략 문서
│   ├── audio-architecture.md         # 오디오 신호 체인 상세 설계
│   ├── api-spec.md                   # REST API 명세서
│   └── README.md                     # 개발자 가이드
├── .moai/                            # MoAI 설정
│   ├── project/                      # 이 디렉토리
│   │   ├── product.md                # 제품 정의
│   │   ├── structure.md              # 프로젝트 구조 (현재 파일)
│   │   └── tech.md                   # 기술 스택
│   ├── specs/                        # SPEC 문서
│   ├── config/                       # MoAI 설정
│   └── docs/                         # 생성된 문서
├── .claude/                          # Claude Code 설정
│   ├── rules/                        # 개발 규칙
│   ├── skills/                       # 커스텀 스킬
│   ├── agents/                       # 커스텀 에이전트
│   └── commands/                     # 커스텀 명령어
├── package.json                      # npm 의존성 및 스크립트
├── vite.config.ts                    # Vite 빌드 설정
├── vitest.config.ts                  # Vitest 테스트 설정
├── playwright.config.ts              # Playwright E2E 설정
├── tsconfig.json                     # TypeScript 설정
├── tsconfig.node.json                # TypeScript Node 설정
├── tailwind.config.ts                # Tailwind CSS 설정
├── postcss.config.js                 # PostCSS 설정
├── eslint.config.js                  # ESLint 설정
├── index.html                        # HTML 진입점
├── CLAUDE.md                         # MoAI 개발 정책
├── CHANGELOG.md                      # 변경 이력
├── README.md                         # 프로젝트 README
├── .gitignore                        # Git 무시 파일
└── .mcp.json                         # MCP 서버 설정

backend/                              # Python FastAPI (Phase 3 - 미구현)
├── app/
│   ├── main.py                       # FastAPI 앱 진입점
│   ├── config.py                     # 환경설정
│   ├── routes/
│   │   ├── separation.py             # 음원 분리 엔드포인트
│   │   │   # POST /api/separate - 음원 분리 요청
│   │   │   # GET /api/separate/{job_id} - 분리 상태 조회
│   │   │   # GET /api/separate/{job_id}/download - 분리 결과 다운로드
│   │   └── health.py                 # 헬스 체크
│   ├── services/
│   │   ├── demucs_service.py         # Demucs 통합 서비스
│   │   ├── cache_service.py          # 캐싱 서비스
│   │   └── worker_queue.py           # 작업 큐
│   ├── utils/
│   │   ├── audio_utils.py            # 오디오 처리 유틸
│   │   └── validators.py             # 입력 검증
│   ├── models/
│   │   ├── schemas.py                # Pydantic 스키마
│   │   └── database.py               # 데이터베이스 모델 (선택)
│   └── __init__.py
├── tests/
│   ├── test_demucs_service.py
│   ├── test_separation_api.py
│   └── conftest.py                   # Pytest 설정
├── requirements.txt                  # Python 의존성
├── Dockerfile                        # Docker 컨테이너 정의
├── docker-compose.yml                # Docker Compose (선택)
└── .env.example                      # 환경변수 템플릿
```

---

## 핵심 디렉토리별 역할

### 프로젝트 루트 - React SPA

**목적**: 사용자가 상호작용하는 웹 인터페이스 제공. 프로젝트 루트에 Vite, TypeScript, Tailwind 등 모든 프론트엔드 설정 파일이 위치합니다.

**components/** - 재사용 가능한 UI 컴포넌트
- Player: 플레이어 전체 레이아웃 및 상태 관리
- Waveform: wavesurfer.js를 React로 래핑하여 파형 시각화
- Controls: 재생/일시정지/정지 버튼 및 시간 표시
- Volume: 볼륨 슬라이더 및 뮤트 토글
- SpeedPitch: +/- 버튼 기반 속도/피치 제어 UI (0.01x 단위, Phase 2)
- ABLoop: A-B 루프 설정 및 표시
- FileLoader: 드래그 앤 드롭, 파일 선택
- Layout: 전체 앱 레이아웃, 헤더

**core/** - React와 독립적인 오디오 엔진

이 계층은 React 렌더 사이클과 완전히 분리되어 있습니다:
- AudioEngine: Web Audio API 컨텍스트, soundtouchjs 실시간 스트리밍, ScriptProcessorNode + SimpleFilter 기반 신호 라우팅
- WaveformRenderer: Canvas를 활용한 실시간 파형 렌더링
- ABLoopManager: 루프 범위 관리 및 재생 위치 제어

**stores/** - Zustand를 활용한 상태 관리

각 도메인별 독립적인 스토어:
- audioStore: 파일 로드, 버퍼, 메타데이터
- playerStore: 재생 상태 (playing/paused/stopped), 현재 시간
- controlStore: 볼륨, 속도, 피치 값
- loopStore: A 지점, B 지점, 루프 활성화 상태

**hooks/** - React 통합 훅

React 컴포넌트가 오디오 엔진과 상태를 연동하는 커스텀 훅:
- useAudioEngine: AudioEngine 초기화 및 정리
- useSpeedPitch: soundtouchjs 연동 속도/피치 제어 로직
- useKeyboardShortcuts: 키보드 이벤트 처리
- usePlayback: 재생 제어 로직
- useFileLoader: 파일 로딩 로직
- useWaveform: 파형 렌더링 동기화

**types/** - TypeScript 타입 정의
- soundtouchjs.d.ts: soundtouchjs 라이브러리의 타입 선언 (SoundTouch, SimpleFilter, WebAudioBufferSource 등)

**tests/** - 테스트 계층

- unit/: Vitest로 core 모듈, 스토어, 유틸리티 함수 테스트
- component/: React Testing Library로 컴포넌트 테스트 (추가 예정)
- e2e/: Playwright로 전체 사용자 흐름 테스트 (실제 오디오 재생 검증 포함)

### backend/ - FastAPI 서버 (Phase 3 - 미구현)

**목적**: 음원 분리 처리를 위한 REST API 서버

**routes/separation.py** - 음원 분리 API 엔드포인트
- POST /api/separate: 오디오 파일 업로드 및 분리 요청
- GET /api/separate/{job_id}: 분리 작업 상태 조회
- GET /api/separate/{job_id}/download: 분리된 오디오 다운로드

**services/demucs_service.py** - Demucs 통합
- 오디오 파일을 Demucs 모델에 입력
- 악기별로 분리된 오디오 생성
- 결과를 캐시에 저장

**Dockerfile** - Docker 컨테이너 정의
- Python 3.12+ 기본 이미지
- Demucs, PyDub, NumPy 등 의존성 설치
- FastAPI 서버 실행

### my-docs/ - 프로젝트 설계 문서

**project-design.md** - 전체 설계
- 아키텍처 개요
- 신호 처리 흐름
- 컴포넌트 간 상호작용

**test-design.md** - 테스트 전략
- 단위 테스트 계획
- 통합 테스트 계획
- E2E 테스트 시나리오

**audio-architecture.md** - 상세 오디오 아키텍처
- Web Audio API 신호 체인
- soundtouchjs 실시간 스트리밍 처리
- ScriptProcessorNode + SimpleFilter 기반 오디오 파이프라인

---

## 의존성 흐름

```
사용자 입력 (UI)
    ↓
React 컴포넌트 (components/)
    ↓
커스텀 훅 (hooks/)
    ↓
Zustand 스토어 (stores/) + 오디오 엔진 (core/)
    ↓
오디오 재생/시각화
  - AudioEngine: soundtouchjs SimpleFilter → ScriptProcessorNode → GainNode → AnalyserNode → Destination
  - WaveformRenderer: wavesurfer.js Canvas 렌더링
    ↓
(Phase 3) 분리된 악기 → Backend API (FastAPI)
    ↓
Demucs 처리 (backend/)
```

---

## 개발 워크플로우

1. **프론트엔드 개발**
   - `pnpm install`
   - `pnpm dev` (Vite 개발 서버)
   - `pnpm test` (Vitest)
   - `pnpm test:e2e` (Playwright)

2. **백엔드 개발 (Phase 3 - 미구현)**
   - `cd backend/`
   - `python -m venv venv`
   - `source venv/bin/activate`
   - `pip install -r requirements.txt`
   - `uvicorn app.main:app --reload`

3. **통합 테스트**
   - Backend: `python -m pytest tests/`
   - Frontend E2E: `npx playwright test`

4. **배포**
   - Frontend: Vercel (자동 배포)
   - Backend: Docker → Railway (또는 다른 클라우드)
