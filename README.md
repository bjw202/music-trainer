# Guitar MP3 Trainer v2

Audio playback tool for musicians to practice with their favorite MP3 tracks.

## Tech Stack

- **React 19.0.0** - UI library
- **TypeScript 5.7.x** - Type-safe JavaScript (strict mode)
- **Vite 6.0.x** - Build tool and dev server
- **Zustand 5.0.x** - State management
- **Tailwind CSS 4.0.x** - Utility-first CSS
- **wavesurfer.js 7.8.x** - Audio waveform visualization

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

- **Unit Tests**: Vitest + React Testing Library
- **E2E Tests**: Playwright
- **Coverage**: v8 (built into Vitest)

## Quality Standards

- TypeScript strict mode enabled
- ESLint for linting
- Prettier for formatting
- 85%+ test coverage target

## License

ISC
