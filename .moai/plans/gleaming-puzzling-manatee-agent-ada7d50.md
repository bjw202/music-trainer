# Task #1: Project Initialization Plan

## Status: Plan Mode - Awaiting Approval

---

## Task Assignment

**Task ID**: #1
**Subject**: Phase A: 프로젝트 초기화
**Assigned to**: frontend-dev
**Methodology**: N/A (setup)

---

## Requirements (from team-lead)

### Create Vite + React + TypeScript + Tailwind Project

1. **Vite Project Setup**:
   - Vite 6.0.x project with React + TypeScript template
   - TypeScript strict mode
   - Path aliases (@/ for src/)

2. **Dependencies Installation**:
   - React 19.0.0
   - Zustand 5.0.x (state management)
   - wavesurfer.js 7.8.x (waveform)
   - Tailwind CSS 4.0.x (styling)

3. **Test Environment**:
   - Vitest 2.1.x for unit tests
   - Playwright 1.48.x for E2E tests
   - React Testing Library 16.x for component tests

4. **Project Structure**:
```
src/
  core/         # Audio engine
  stores/       # Zustand stores
  components/   # React components
  hooks/        # Custom hooks
  utils/        # Utilities
tests/
  e2e/          # Playwright tests
public/
  test-audio/   # Test audio files
```

---

## Implementation Approach

### Step 1: Create Vite Project

```bash
pnpm create vite@latest frontend --template react-ts
```

This will create:
- package.json with Vite + React + TypeScript
- tsconfig.json
- vite.config.ts
- index.html
- src/main.tsx, src/App.tsx

### Step 2: Install Additional Dependencies

```bash
cd frontend
pnpm install
```

Dependencies to add:
- **Zustand 5.x**: `zustand`
- **Tailwind CSS 4.x**: `tailwindcss @tailwindcss/vite` (Vite 6 plugin)
- **Testing**:
  - `@vitest/ui vitest` - Unit tests
  - `@playwright/test` - E2E tests
  - `@testing-library/react @testing-library/jest-dom @testing-library/user-event` - Component tests
  - `jsdom` - Test environment
- **Waveform**: `wavesurfer.js@7.8`
- **Audio**: `soundtouch-ts` (for Phase 2 speed/pitch)

### Step 3: Configure Tailwind CSS 4.x

```bash
pnpm exec tailwindcss init
```

Create `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark theme colors from SPEC
        primary: '#1a1a1a',
        secondary: '#2a2a2a',
        text: {
          primary: '#e0e0e0',
          secondary: '#a0a0a0',
        },
        accent: {
          blue: '#007aff',
          red: '#ff3b30',
          green: '#34c759',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
```

Configure Vite to use Tailwind plugin (Vite 6):

```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // ... rest of config
})
```

### Step 4: Configure Vitest

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
})
```

### Step 5: Configure Playwright

```bash
pnpm exec playwright install --with-deps
```

Create `playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
```

### Step 6: Create Directory Structure

```
frontend/
├── src/
│   ├── components/       # UI Components
│   ├── core/           # Audio Engine (Task #5)
│   ├── stores/         # Zustand stores (Task #2)
│   ├── hooks/          # Custom hooks (Task #7)
│   ├── utils/          # Utility functions (Task #3)
│   ├── types/          # TypeScript types
│   ├── test/           # Test setup
│   │   └── setup.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── public/
│   └── test-audio/     # E2E test audio files
├── tests/
│   ├── unit/           # Vitest unit tests
│   ├── component/      # RTL component tests
│   └── e2e/           # Playwright E2E tests
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.ts
├── postcss.config.js
├── .eslintrc.cjs
├── .gitignore
└── index.html
```

### Step 7: Update package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "format": "prettier --write \"src/**/*.{ts,tsx}\""
  }
}
```

### Step 8: TypeScript Configuration

Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/core/*": ["./src/core/*"],
      "@/stores/*": ["./src/stores/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/utils/*": ["./src/utils/*"],
      "@/types/*": ["./src/types/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Step 9: Create Base Files

1. **src/test/setup.ts** - Test environment setup
2. **src/types/index.ts** - Type definitions placeholder
3. **public/test-audio/** - Add sample audio files later

---

## Verification Steps

After implementation, verify:

1. `pnpm dev` - Dev server starts on http://localhost:5173
2. `pnpm build` - Production build succeeds
3. `pnpm test` - Vitest runs (no tests yet)
4. `pnpm test:e2e` - Playwright runs (no tests yet)
5. Check TypeScript: `pnpm exec tsc --noEmit`
6. Check ESLint: `pnpm lint`

---

## File Creation Summary

Files to create/modify:
- `frontend/package.json` - Dependencies and scripts
- `frontend/vite.config.ts` - Vite + Tailwind plugin
- `frontend/vitest.config.ts` - Vitest configuration
- `frontend/playwright.config.ts` - Playwright configuration
- `frontend/tailwind.config.ts` - Tailwind theme
- `frontend/tsconfig.json` - TypeScript strict mode
- `frontend/postcss.config.js` - PostCSS for Tailwind
- `frontend/.eslintrc.cjs` - ESLint rules
- `frontend/src/test/setup.ts` - Test setup
- `frontend/src/types/index.ts` - Type definitions
- Directory structure: components/, core/, stores/, hooks/, utils/, types/, test/
- Test directories: tests/unit/, tests/component/, tests/e2e/

---

## Questions

1. Should I include ESLint + Prettier configuration?
2. Should I add any specific TypeScript path aliases beyond the standard @/*?
3. Any specific browser targets for Tailwind CSS?

---

## Ready to Execute

Once approved, I will:
1. Create the Vite project with all configurations
2. Set up directory structure
3. Configure all tools (Vitest, Playwright, Tailwind)
4. Run verification commands
5. Mark Task #1 complete
6. Notify team that Task #2 and #3 can begin
