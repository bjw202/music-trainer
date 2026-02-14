# E2E Tests for Guitar MP3 Trainer v2

## Overview

This directory contains comprehensive End-to-End (E2E) tests using Playwright for the Guitar MP3 Trainer v2 application.

## Test Structure

### Test Files

1. **playback.spec.ts** - Core playback flow tests
   - File load → Play → Pause → Stop flow
   - Time updates during playback
   - State transitions (playing, paused, stopped)
   - Keyboard shortcuts (Space bar)

2. **controls.spec.ts** - Volume and control tests
   - Volume slider interaction
   - Mute/unmute toggle
   - Keyboard shortcuts (Arrow keys, M key)
   - Volume state persistence

3. **abloop.spec.ts** - A-B Loop functionality tests
   - Set A point (I key or button)
   - Set B point (O key or button)
   - Loop toggle
   - Loop back verification
   - A key jump to loop start (only when loop enabled)

4. **compound-independence.spec.ts** - **CRITICAL** Compound independence tests
   - Category 1: Pairwise Independence (6 tests)
   - Category 2: Sequential Operation (2 tests)
   - Category 3: State Persistence (3 tests)
   - Category 4: Rapid Successive Operations (3 tests)

5. **visual.spec.ts** - Visual regression tests
   - Waveform rendering screenshots
   - Playhead position screenshots
   - Loop region visualization screenshots
   - Component isolation screenshots

## Test Audio Files

Place test audio files in `public/test-audio/`:

- **test-song.mp3** - 30 seconds sample audio file
- **sine-440hz.wav** - For timing precision tests (optional)

### Generating Test Audio

You can generate test audio files using ffmpeg:

```bash
# Generate 30 seconds of silence
ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 30 -q:a 9 public/test-audio/test-song.mp3

# Generate 440Hz sine wave for timing tests
ffmpeg -f lavfi -i sine=frequency=440:duration=5 -ar 44100 public/test-audio/sine-440hz.wav
```

Or use any real audio file (MP3, WAV, M4A, OGG) for testing.

## Running Tests

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npx playwright test tests/e2e/playback.spec.ts
```

### Run Tests in UI Mode

```bash
npx playwright test --ui
```

### Run Tests Headed (for debugging)

```bash
npx playwright test --headed
```

### Run Visual Tests Only

```bash
npx playwright test tests/e2e/visual.spec.ts
```

### Update Visual Baselines

```bash
npx playwright test tests/e2e/visual.spec.ts --update-snapshots
```

## Test Configuration

Playwright configuration is in `playwright.config.ts`:

- **Test Directory**: `./tests/e2e`
- **Base URL**: `http://localhost:5173`
- **Browser**: Chromium (Desktop Chrome)
- **Reporter**: HTML
- **Parallel Execution**: Enabled (fullyParallel: true)
- **Auto Web Server**: Runs `pnpm run dev` automatically

## Quality Requirements

### Test Coverage

- All E2E tests must pass
- CRITICAL: All 8 compound independence tests must pass
- Visual regression tests with < 1% pixel difference

### Test Categories

1. **Smoke Tests** (5 tests): Basic functionality verification
2. **Integration Tests** (20+ tests): Feature interaction
3. **Compound Independence** (8 tests): **CRITICAL** - Feature independence
4. **Visual Regression** (10+ tests): UI consistency

### Success Criteria

✅ All playback flow tests pass
✅ All control interactions work correctly
✅ A-B Loop functionality verified
✅ **All 8 compound independence tests pass**
✅ Visual regression within 1% threshold
✅ No flaky tests (100% reliability)

## Debugging Failed Tests

### View HTML Report

After running tests, view the HTML report:

```bash
npx playwright show-report
```

### Debug Specific Test

```bash
# Run with headed browser
npx playwright test tests/e2e/playback.spec.ts --headed

# Run with debugging
npx playwright test tests/e2e/playback.spec.ts --debug
```

### Trace Viewer

For detailed execution trace:

```bash
npx playwright test --trace on
```

## Writing New Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Category', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Common setup
  })

  test('should do something', async ({ page }) => {
    // Arrange
    const element = page.getByTestId('element-id')

    // Act
    await element.click()

    // Assert
    await expect(element).toHaveAttribute('aria-pressed', 'true')
  })
})
```

### Best Practices

1. **Use data-testid attributes** for reliable element selection
2. **Wait for async operations** with page.waitForTimeout()
3. **Check accessibility** with aria-label and aria-pressed
4. **Test both UI and keyboard** interactions
5. **Test independent features** to ensure no interference

### Selecting Elements

```typescript
// By test ID (preferred)
const element = page.getByTestId('volume-slider')

// By ARIA role
const button = page.getByRole('button', { name: /play/i })

// By text content
const heading = page.getByText('Drag & Drop Audio File')

// By CSS selector (least preferred)
const element = page.locator('.bg-\\[\\#2a2a2a\\]')
```

## Known Issues

### Audio File Loading

Tests require audio files in `public/test-audio/`. Without them, file loading tests will fail.

### Timing-Dependent Tests

Some tests rely on timing (playback advancement, waveform rendering). These may be flaky on slow CI systems.

### Visual Regression Threshold

Visual tests use 1% threshold (maxDiffPixels: 100 for 1920x1080). This may need adjustment for different screen sizes.

## Continuous Integration

### GitHub Actions

Tests run automatically on:
- Pull requests
- Push to main branch
- Manual workflow dispatch

### Local CI Simulation

```bash
# Run in CI mode
CI=true pnpm run test:e2e
```

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Visual Regression Guide](https://playwright.dev/docs/visual-screenshot)
