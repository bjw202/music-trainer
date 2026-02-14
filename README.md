# Music Trainer

기타 연습을 위한 웹 기반 오디오 트레이너입니다. A-B 루프, 파형 시각화, 키보드 단축키를 지원하여 효과적인 악기 연습 환경을 제공합니다.

## 주요 기능

- **오디오 파일 로드**: MP3, WAV, M4A, OGG 형식 지원 (드래그 앤 드롭)
- **파형 시각화**: wavesurfer.js를 활용한 부드러운 파형 표시
- **A-B 루프**: 특정 구간 반복 재생으로 연습 효율 향상
- **볼륨 제어**: 0%~100% 마스터 볼륨 및 뮤트 기능
- **키보드 단축키**: Space(재생/일시정지), I/O(A/B 지점), M(뮤트), 화살표(탐색)

## Tech Stack

- **React 19.0.0** - UI library
- **TypeScript 5.9.x** - Type-safe JavaScript (strict mode)
- **Vite 6.x** - Build tool and dev server
- **Zustand 5.x** - State management
- **Tailwind CSS 4.x** - Utility-first CSS
- **wavesurfer.js 7.8.x** - Audio waveform visualization
- **Vitest** - Unit testing (190 tests)
- **Playwright** - E2E testing

## Project Structure

```
/ (repository root)
├── src/
│   ├── components/     # Reusable UI components
│   ├── core/           # Core business logic
│   ├── stores/          # Zustand state stores
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript type definitions
│   ├── test/            # Test setup and utilities
│   ├── App.tsx          # Root component
│   ├── main.tsx         # Application entry point
│   └── vite-env.d.ts    # Vite TypeScript declarations
├── tests/
│   ├── unit/            # Unit tests
│   ├── component/       # Component tests
│   └── e2e/            # End-to-end tests (Playwright)
├── public/
│   └── test-audio/      # Test audio files
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

```bash
pnpm install
```

### Available Scripts

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
