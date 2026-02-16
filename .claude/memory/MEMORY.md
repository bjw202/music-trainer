# MoAI Memory

## Team Agent Lessons
- Team agents (team-backend-dev, team-frontend-dev, team-tester) must NEVER be spawned with `mode: "plan"` — they lack the ExitPlanMode tool and will get stuck. Use `mode: "acceptEdits"` instead.

## E2E Testing Patterns
- Range slider `body.click()` does NOT reliably blur sliders. Use `slider.evaluate(el => (el as HTMLElement).blur())` instead.
- `fullyParallel: true` with unlimited workers can overwhelm the dev server. Use `--workers=2` for stability.
- `getByTestId()` that matches multiple elements needs `.first()` or `.last()`.
- Keyboard shortcuts are blocked when input elements have focus (`useKeyboardShortcuts` checks `event.target instanceof HTMLInputElement`). Always blur sliders before testing keyboard shortcuts.
- UI-only E2E tests are insufficient for audio features. Use `window.__audioEngine` (dev mode) to verify engine internal state (speed, pitch, processedBuffer) in E2E tests. See `tests/e2e/audio-processing.spec.ts`.

## Critical Bug Patterns
- Hook wiring: Always verify hooks are actually CALLED in components, not just defined. The `useSpeedPitch` hook was defined but never called in Player.tsx — store state updated UI correctly but AudioEngine never received speed/pitch commands.

## Project: guitar-mp3-trainer-v2
- Package manager: pnpm (not npm)
- soundtouch-ts@1.1.1 for speed/pitch processing (offline buffer approach, not real-time AudioWorklet)
- SPEC docs at `.moai/specs/SPEC-UPDATE-001/`
