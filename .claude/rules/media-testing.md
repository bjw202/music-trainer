---
paths:
  - "tests/**/*.spec.ts"
  - "tests/**/*.test.ts"
  - "tests/e2e/**"
  - "tests/integration/**"
---

# Media Project E2E Testing Rules

This project uses Web Audio API, WaveSurfer.js, and Zustand stores.
The architecture has TWO separate state systems that can diverge:
- Zustand Store (UI state): what React components display
- AudioEngine (media state): what the user actually hears

Tests MUST verify BOTH systems are synchronized.
Store updates alone do NOT control audio. Both must be called:
- `engine.seek(time)` + `store.setCurrentTime(time)` = correct
- `store.setCurrentTime(time)` alone = UI changes, audio unchanged = BUG

## BANNED Assertions (HARD - violations cause test to be rejected)

1. NEVER use `toBeDefined()` alone
   - WHY: Always passes, verifies nothing about media behavior
   - INSTEAD: Use specific value comparisons

2. NEVER use `toBeVisible()` alone to verify media playback
   - WHY: Button showing "Pause" does NOT prove audio is playing
   - INSTEAD: Verify time display is advancing over multiple checkpoints

3. NEVER assert a single time snapshot after play/seek
   - WHY: Store can show "0:05" while engine is stuck at 0:00
   - INSTEAD: Assert time at 2+ points to verify it's advancing

4. NEVER use `getByTestId('time-display')` without `.first()` or `.last()`
   - WHY: Two TimeDisplay components exist (current time + duration)

5. NEVER write characterization tests that document bugs as expected behavior
   - WHY: Freezes bugs into the test suite as "correct" behavior
   - INSTEAD: Use `it.skip` or `it.todo` for known bugs with correct expected values

## REQUIRED Patterns (HARD - every media test MUST include at least one)

### Pattern 1: Playback Continuity (3-point temporal verification)

After any play/resume action, verify time advances at 3 checkpoints:

```typescript
// REQUIRED after play() or resume()
const t1 = await getDisplayTime(page)  // checkpoint 1
await page.waitForTimeout(500)
const t2 = await getDisplayTime(page)  // checkpoint 2
await page.waitForTimeout(500)
const t3 = await getDisplayTime(page)  // checkpoint 3
expect(t2).toBeGreaterThan(t1)
expect(t3).toBeGreaterThan(t2)
```

### Pattern 2: Seek-Then-Continue

After any seek action (waveform click, keyboard arrow, programmatic seek),
verify playback continues from the new position:

```typescript
// REQUIRED after seek() during playback
await seekAction()  // waveform click, keyboard arrow, etc
const tAfterSeek = await getDisplayTime(page)
await page.waitForTimeout(500)
const tLater = await getDisplayTime(page)
// Time MUST continue advancing after seek
expect(tLater).toBeGreaterThan(tAfterSeek)
```

### Pattern 3: Pause-Freezes-Time

After pause, time MUST stop changing:

```typescript
// REQUIRED after pause()
const tAtPause = await getDisplayTime(page)
await page.waitForTimeout(500)
const tAfterWait = await getDisplayTime(page)
expect(tAfterWait).toBe(tAtPause)  // MUST be equal
```

### Pattern 4: Before/After Comparison

For ANY state-changing action, capture before and after:

```typescript
const before = await getDisplayTime(page)
await action()
await page.waitForTimeout(300)
const after = await getDisplayTime(page)
expect(after).not.toBe(before)
```

## Helper Functions (use in all media tests)

```typescript
function parseTimeDisplay(text: string | null): number {
  if (!text) return -1
  const match = text.match(/(\d+):(\d{2})/)
  if (!match) return -1
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

async function getDisplayTime(page: Page): Promise<number> {
  const text = await page.getByTestId('time-display').first().textContent()
  return parseTimeDisplay(text)
}
```

## Unit Test Rules

- NEVER assert buggy behavior as correct in characterization tests
- ALWAYS use `it.skip('description - PENDING: reason')` for known bugs
- ALWAYS write the correct expected value in skipped tests
- When a bug is fixed, update the test to unskip and verify correct behavior

```typescript
// BANNED: Bug documented as expected
it('seek while playing', () => {
  engine.play()
  engine.seek(5)
  expect(source.start).toHaveBeenCalledTimes(1) // wrong: documents bug as spec
})

// REQUIRED: Bug marked as pending with correct expectation
it.skip('seek while playing - PENDING: isPlaying reset needed', () => {
  engine.play()
  engine.seek(5)
  expect(source.start).toHaveBeenCalledTimes(2) // correct: what SHOULD happen
})
```
