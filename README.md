# Music Trainer

기타 연습을 위한 웹 기반 오디오 트레이너입니다. A-B 루프, 파형 시각화, 키보드 단축키를 지원하여 효과적인 악기 연습 환경을 제공합니다.

## 주요 기능

- **오디오 파일 로드**: MP3, WAV, M4A, OGG 형식 지원 (드래그 앤 드롭)
- **YouTube 변환**: YouTube URL에서 MP3 추출 및 자동 로드 (실시간 진행률 표시)
- **파형 시각화**: wavesurfer.js를 활용한 부드러운 파형 표시
- **A-B 루프**: 특정 구간 반복 재생으로 연습 효율 향상
- **볼륨 제어**: 0%~100% 마스터 볼륨 및 뮤트 기능
- **키보드 단축키**: Space(재생/일시정지), I/O(A/B 지점), M(뮤트), 화살표(탐색)

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
- **Uvicorn** - ASGI server
- **pytest** - Testing framework (65 tests)

## Project Structure

```
/ (repository root)
├── src/                        # Frontend
│   ├── api/                   # Backend API client
│   ├── components/            # Reusable UI components
│   │   └── YouTubeInput/     # YouTube URL input component
│   ├── core/                  # Core business logic
│   ├── stores/                # Zustand state stores
│   │   └── youtubeStore.ts   # YouTube conversion state
│   ├── hooks/                 # Custom React hooks
│   │   └── useYouTubeConvert.ts  # YouTube conversion hook
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
│   │   │   └── youtube.py    # YouTube conversion endpoints
│   │   ├── services/         # Business logic
│   │   │   ├── youtube_service.py   # yt-dlp wrapper
│   │   │   └── cleanup_service.py   # Temporary file cleanup
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
