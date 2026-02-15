# Music Trainer

기타 연습을 위한 웹 기반 오디오 트레이너입니다. A-B 루프, 파형 시각화, 키보드 단축키를 지원하여 효과적인 악기 연습 환경을 제공합니다.

## 주요 기능

- **오디오 파일 로드**: MP3, WAV, M4A, OGG 형식 지원 (드래그 앤 드롭)
- **YouTube 변환**: YouTube URL에서 MP3 추출 및 자동 로드 (실시간 진행률 표시)
- **재생 중 파일 교체**: 재생 중에도 모달을 통해 새로운 오디오 파일 로드 가능 (YouTube URL 입력 및 파일 드래그 앤 드롭 지원)
- **파형 시각화**: wavesurfer.js를 활용한 부드러운 파형 표시
- **A-B 루프**: 특정 구간 반복 재생으로 연습 효율 향상
- **볼륨 제어**: 0%~100% 마스터 볼륨 및 뮤트 기능
- **키보드 단축키**: Space(재생/일시정지), I/O(A/B 지점), M(뮤트), 화살표(탐색)
- **스템 믹서 (Stem Mixer)**: AI 기반 음원 분리 기능
  - Demucs htdemucs 모델로 4개 스템 분리 (vocals, drums, bass, other)
  - 실시간 분리 진행률 표시 (SSE)
  - 각 스템별 개별 볼륨 제어 (0-100%)
  - 솔로/뮤트 기능으로 특정 악기 집중 연습
  - SoundTouch 통합으로 속도/피치 동기화

## Tech Stack

### Frontend
- **React 19.0.0** - UI library
- **TypeScript 5.9.x** - Type-safe JavaScript (strict mode)
- **Vite 6.x** - Build tool and dev server
- **Zustand 5.x** - State management
- **Tailwind CSS 4.x** - Utility-first CSS
- **wavesurfer.js 7.8.x** - Audio waveform visualization
- **Vitest** - Unit testing (190 tests)
- **Playwright** - E2E testing

### Backend
- **Python 3.12+** - Programming language
- **FastAPI 0.129.0+** - Modern async web framework
- **yt-dlp 2026.2.4+** - YouTube audio extraction
- **ffmpeg** - Audio processing
- **Demucs 4.x** - AI source separation (htdemucs model)
- **PyTorch (CPU)** - ML runtime for Demucs
- **Uvicorn** - ASGI server
- **pytest** - Testing framework (65 tests)

## Project Structure

```
/ (repository root)
├── src/                        # Frontend
│   ├── api/                   # Backend API client
│   │   └── separation.ts     # 분리 API 클라이언트 (업로드, SSE, 다운로드)
│   ├── components/            # Reusable UI components
│   │   ├── FileLoader/        # File loading components
│   │   │   └── LoadAudioModal.tsx  # Modal for loading new audio during playback
│   │   └── YouTubeInput/      # YouTube URL input component
│   ├── core/                  # Core business logic
│   │   └── StemMixer.ts      # 멀티트랙 스템 믹서 오디오 엔진
│   ├── stores/                # Zustand state stores
│   │   ├── youtubeStore.ts   # YouTube conversion state
│   │   └── stemStore.ts      # 스템 분리/믹서 상태 관리
│   ├── hooks/                 # Custom React hooks
│   │   ├── useYouTubeConvert.ts  # YouTube conversion hook
│   │   ├── useStemMixer.ts       # StemMixer 래퍼 훅
│   │   └── useSeparation.ts      # 분리 프로세스 관리 훅
│   ├── utils/                 # Utility functions
│   ├── types/                 # TypeScript type definitions
│   ├── test/                  # Test setup and utilities
│   ├── App.tsx                # Root component
│   ├── main.tsx               # Application entry point
│   └── vite-env.d.ts          # Vite TypeScript declarations
├── backend/                    # Backend
│   ├── app/
│   │   ├── main.py           # FastAPI app entry point
│   │   ├── config.py         # Environment configuration
│   │   ├── routes/           # API routes
│   │   │   ├── health.py     # Health check endpoint
│   │   │   ├── youtube.py    # YouTube conversion endpoints
│   │   │   └── separation.py # 음원 분리 엔드포인트
│   │   ├── services/         # Business logic
│   │   │   ├── youtube_service.py      # yt-dlp wrapper
│   │   │   ├── separation_service.py   # Demucs 래퍼
│   │   │   └── cleanup_service.py      # Temporary file cleanup
│   │   ├── models/           # Pydantic schemas
│   │   └── utils/            # Utilities
│   ├── tests/                # Backend tests (65 tests)
│   ├── requirements.txt
│   └── Dockerfile
├── tests/                      # Frontend tests
│   ├── unit/                 # Unit tests
│   ├── component/            # Component tests
│   └── e2e/                  # End-to-end tests (Playwright)
├── public/
│   └── test-audio/           # Test audio files
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.ts
└── index.html
```

## Development

### Install Dependencies

**Frontend:**
```bash
pnpm install
```

**Backend:**
```bash
cd backend
pip install -r requirements.txt
# ffmpeg 설치 필요 (OS별로 다름)
# macOS: brew install ffmpeg
# Ubuntu: sudo apt-get install ffmpeg
```

### Available Scripts

**Frontend:**
```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Run unit tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type check
pnpm typecheck
```

**Backend:**
```bash
# Start development server
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest

# Run tests with coverage
pytest --cov=app --cov-report=html

# Run with Docker
docker build -t music-trainer-backend .
docker run -p 8000:8000 music-trainer-backend
```

### Environment Variables

**.env (Backend):**
```
CORS_ORIGINS=http://localhost:5173
MAX_FILE_SIZE_MB=100
TEMP_DIR=/tmp/music-trainer
CLEANUP_INTERVAL_MINUTES=10
FILE_RETENTION_HOURS=1
```

**.env (Frontend):**
```
VITE_API_BASE_URL=http://localhost:8000
```

## Color Scheme

Dark theme colors:

- Background Primary: `#1a1a1a`
- Background Secondary: `#2a2a2a`
- Text Primary: `#e0e0e0`
- Text Secondary: `#a0a0a0`
- Accent Blue: `#007aff`
- Accent Red: `#ff3b30`
- Accent Green: `#34c759`

## Testing

- **Unit Tests**: Vitest + React Testing Library (190 tests)
- **E2E Tests**: Playwright
- **Coverage**: v8 (built into Vitest)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| I | Set A point |
| O | Set B point |
| A | Jump to A point (when loop active) |
| M | Toggle mute |
| ← | Seek -5 seconds |
| → | Seek +5 seconds |

## Quality Standards

- TypeScript strict mode enabled
- ESLint for linting
- Prettier for formatting
- 85%+ test coverage target

## License

MIT
