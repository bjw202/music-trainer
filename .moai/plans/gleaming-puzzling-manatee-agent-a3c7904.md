# Task #1: Project Initialization - Implementation Plan

## Status: Awaiting Exit from Plan Mode

---

## Approved Plan

Team-lead has approved the implementation with corrections:

### Correction: Project at Root Level
Create the Vite project at the **repository root**, not in a `frontend/` subdirectory.

### Structure to Create
```
/ (repository root)
├── src/
│   ├── components/   # React components
│   ├── core/         # Audio engine
│   ├── stores/       # Zustand stores
│   ├── hooks/        # Custom hooks
│   ├── utils/        # Utilities
│   ├── types/        # TypeScript types
│   ├── test/         # Test setup
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── tests/
│   ├── unit/        # Vitest unit tests
│   ├── component/   # RTL component tests
│   └── e2e/         # Playwright E2E tests
├── public/
│   └── test-audio/  # Test audio files
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── .eslintrc.cjs
├── .prettierrc.json
└── index.html
```

---

## Implementation Commands

### Step 1: Initialize Project
```bash
# Already started: pnpm init created package.json
# Next: Install core dependencies
pnpm add react@19.0.0 react-dom@19.0.0
pnpm add -D @types/react@19.0.0 @types/react-dom@19.0.0
```

### Step 2: Install Vite and Core Dependencies
```bash
pnpm add -D vite@6 @vitejs/plugin-react
pnpm add -D typescript@5.7
```

### Step 3: Install Additional Dependencies
```bash
# State management
pnpm add zustand@5

# Waveform
pnpm add wavesurfer.js@7.8

# Styling
pnpm add -D tailwindcss@4 @tailwindcss/vite

# Testing
pnpm add -D @vitest/ui vitest@2.1 jsdom
pnpm add -D @playwright/test@1.48
pnpm add -D @testing-library/react@16 @testing-library/jest-dom @testing-library/user-event

# Code quality
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D prettier eslint-config-prettier
```

### Step 4: Install Playwright Browsers
```bash
pnpm exec playwright install --with-deps
```

### Step 5: Create Directory Structure
```bash
mkdir -p src/{components,core,stores,hooks,utils,types,test}
mkdir -p tests/{unit,component,e2e}
mkdir -p public/test-audio
```

---

## Files to Create

### 1. vite.config.ts
```typescript
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@/components': '/src/components',
      '@/core': '/src/core',
      '@/stores': '/src/stores',
      '@/hooks': '/src/hooks',
      '@/utils': '/src/utils',
      '@/types': '/src/types',
    },
  },
})
```

### 2. tailwind.config.ts
```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
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

### 3. tsconfig.json
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

### 4. vitest.config.ts
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

### 5. playwright.config.ts
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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
```

### 6. index.html
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Music Trainer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 7. src/main.tsx
```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### 8. src/App.tsx
```typescript
export default function App() {
  return (
    <div className="min-h-screen bg-primary text-text-primary">
      <h1 className="text-2xl font-bold">Music Trainer</h1>
      <p className="text-text-secondary">Audio player for music practice</p>
    </div>
  )
}
```

### 9. src/index.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 10. src/test/setup.ts
```typescript
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})
```

### 11. src/types/index.ts
```typescript
// Type definitions placeholder
export {}
```

### 12. package.json scripts
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

---

## Verification Steps

After implementation:
```bash
pnpm dev          # Should start dev server on http://localhost:5173
pnpm build        # Should complete without errors
pnpm test         # Should run Vitest (no tests yet)
pnpm test:e2e     # Should run Playwright (no tests yet)
pnpm exec tsc --noEmit  # Should pass TypeScript check
```

---

## Ready to Execute

This plan is approved. Awaiting exit from plan mode to begin implementation.
