# Team Tester Memory

## Project: guitar-mp3-trainer-v2

### Testing Strategy Rules (from .moai/project/testing-strategy.md)
1. Never use `toBeDefined()` - always use meaningful assertions
2. Always use before/after comparison pattern
3. Use directional assertions for time (toBeGreaterThan, not just not equal)
4. Always use `.first()` or `.last()` with `getByTestId` on multi-element selectors
5. Verify values actually changed (not just that they exist)

### Playwright Gotchas
- **Range input fill()**: Browser normalizes `max="2.0"` to `max="2"`, so `fill('2.0')` fails as "Malformed value". Use `fill('2')` instead.
- **Slider focus retention**: After `fill()` on range input, slider keeps focus. ArrowRight/Left changes slider value instead of triggering keyboard shortcuts. Fix: `element.evaluate(el => el.blur())` or `page.locator('body').click()` before arrow keys.
- **Nested vs adjacent CSS selectors**: ABLoopControls has time span INSIDE button (child), not adjacent sibling. Use `button[...] span.text-xs` not `button[...] + span`.
- **Dev server flakiness**: Vite drops connections under heavy parallel test load. Tests pass in isolation. Use `--retries=2 --workers=4` for stability.

### Key Test Infrastructure
- Helper: `tests/e2e/helpers/audio-loader.ts` - `setupAudioPage()`, `loadAudioFile()`
- Audio test file: `public/test-audio/test-song.mp3`
- Config: `playwright.config.ts` - Vite dev server on port 5173

### data-testid Map
- speed-slider, speed-display (SpeedControl.tsx)
- pitch-slider, pitch-display (PitchControl.tsx)
- speed-pitch-reset, speed-pitch-panel (SpeedPitchPanel.tsx)
- volume-slider (VolumeSlider.tsx)
- time-display (TimeDisplay.tsx)
- file-input (DragDropZone.tsx)
- waveform-container (Waveform component)

### Keyboard Shortcuts (from constants.ts)
- Speed: `=` (+0.1x), `-` (-0.1x) -> Playwright: `Equal`, `Minus`
- Pitch: `]` (+1), `[` (-1) -> Playwright: `BracketRight`, `BracketLeft`
- Reset: `r` -> Playwright: `r`
- Seek: ArrowRight/ArrowLeft
- Mute: `m`
