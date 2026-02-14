# Music Trainer 테스트 설계 문서

## 1. 테스트 철학

### 핵심 원칙: "테스트 통과 = 실제 동작"

이 프로젝트의 테스트는 단순히 "통과하는 테스트"가 아닌, **실제 오디오 재생 동작을 검증**하는 것을 목표로 합니다.

#### Mock 기반 테스트의 한계

일반적인 웹 애플리케이션 테스트는 Mock 객체를 사용하여 빠르게 실행됩니다. 하지만 오디오 애플리케이션에서 Mock만 사용하면:

```typescript
// ❌ 나쁜 예: Mock이 통과해도 실제 오디오는 망가질 수 있음
it('should change playback speed', () => {
  const mockAudioEngine = { setSpeed: jest.fn() };
  audioEngine.setSpeed(0.5);
  expect(mockAudioEngine.setSpeed).toHaveBeenCalledWith(0.5); // ✅ 통과
  // 하지만 실제로는 속도가 바뀌지 않거나, 피치도 함께 변할 수 있음!
});
```

#### 실제 오디오 검증의 필요성

Music Trainer는 **Web Audio API의 복잡한 신호 체인**을 다룹니다:

```
Source → TimeStretch/PitchShift Worklet → GainNode → AnalyserNode → Destination
```

이 체인의 각 노드가 **독립적으로 동작해야** 하며, 하나를 변경해도 다른 것에 영향을 주지 않아야 합니다.

### 독립성 검증이 핵심

사용자 요구사항에서 명시된 대로, 다음 컨트롤들은 **반드시 독립적으로 동작**해야 합니다:

1. **속도 (Speed)**: 재생 속도만 변경, 피치는 유지
2. **피치 (Pitch)**: 음높이만 변경, 속도는 유지
3. **볼륨 (Volume)**: 전체 음량만 변경, 속도/피치는 유지
4. **악기별 볼륨**: 특정 악기(보컬/드럼/베이스/기타)만 조절, 다른 악기는 유지

**테스트의 목표는 이 독립성을 실제 브라우저 환경에서 검증하는 것입니다.**

---

## 2. 테스트 레이어

### Layer 1: 단위 테스트 (Vitest)

**목적**: 비즈니스 로직과 상태 관리 검증

**범위**:
- 오디오 상태 관리 (Zustand store)
- 유틸리티 함수 (시간 포맷팅, 피치 계산, 반음 변환)
- A-B 루프 계산 로직
- 속도/피치 변환 알고리즘

**예시**:

```typescript
// ✅ 좋은 단위 테스트: 순수 함수 검증
describe('timeToSeconds', () => {
  it('should convert MM:SS to seconds', () => {
    expect(timeToSeconds('01:30')).toBe(90);
    expect(timeToSeconds('00:05')).toBe(5);
  });
});

describe('calculateSemitones', () => {
  it('should calculate correct semitone difference', () => {
    expect(calculateSemitones(440, 880)).toBe(12); // 1 옥타브 = 12 반음
    expect(calculateSemitones(440, 220)).toBe(-12);
  });
});

describe('useAudioStore', () => {
  it('should update A-B loop points correctly', () => {
    const { setLoopA, setLoopB } = useAudioStore.getState();
    setLoopA(10);
    setLoopB(20);
    expect(useAudioStore.getState().loopA).toBe(10);
    expect(useAudioStore.getState().loopB).toBe(20);
  });
});
```

**커버리지 목표**: 85% 이상

---

### Layer 2: 컴포넌트 테스트 (Vitest + React Testing Library)

**목적**: UI 컴포넌트와 사용자 인터랙션 검증

**범위**:
- UI 컴포넌트 렌더링 검증
- 사용자 인터랙션 (버튼 클릭, 슬라이더 드래그)
- 키보드 단축키 동작
- 파일 드래그앤드롭

**예시**:

```typescript
// ✅ 컴포넌트 테스트: UI 인터랙션 검증
describe('SpeedControl', () => {
  it('should render speed slider with correct value', () => {
    render(<SpeedControl speed={1.5} onChange={jest.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue(1.5);
  });

  it('should call onChange when slider moves', async () => {
    const onChange = jest.fn();
    render(<SpeedControl speed={1.0} onChange={onChange} />);
    const slider = screen.getByRole('slider');

    await userEvent.click(slider);
    fireEvent.change(slider, { target: { value: '0.75' } });

    expect(onChange).toHaveBeenCalledWith(0.75);
  });
});

describe('KeyboardShortcuts', () => {
  it('should toggle play/pause on Space key', async () => {
    const onToggle = jest.fn();
    render(<Player onTogglePlay={onToggle} />);

    await userEvent.keyboard(' ');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
```

**커버리지 목표**: 주요 인터랙션 100%

---

### Layer 3: E2E 테스트 (Playwright) - **가장 중요**

**목적**: 실제 브라우저에서 실제 오디오 파일로 동작 검증

이 레이어가 **Music Trainer의 핵심 품질을 보장**합니다. Mock 없이 실제 Web Audio API를 사용하여 테스트합니다.

#### 3.1 오디오 로딩 테스트

```typescript
test('should load MP3 file and render waveform', async ({ page }) => {
  await page.goto('/');

  // 파일 업로드
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  // 메타데이터 확인
  await expect(page.locator('[data-testid="song-title"]')).toBeVisible();
  await expect(page.locator('[data-testid="duration"]')).toContainText(/\d+:\d+/);

  // 파형이 Canvas에 렌더링되었는지 확인 (비어있지 않은 픽셀)
  const canvas = await page.locator('canvas[data-testid="waveform"]');
  const isWaveformRendered = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, el.width, el.height);
    return imageData.data.some(pixel => pixel !== 0); // 픽셀이 하나라도 있으면 렌더링됨
  });
  expect(isWaveformRendered).toBe(true);
});

test('should support multiple audio formats', async ({ page }) => {
  const formats = ['test.mp3', 'test.wav', 'test.m4a', 'test.ogg'];

  for (const file of formats) {
    await page.goto('/');
    await page.setInputFiles('input[type="file"]', `./test-audio/${file}`);
    await expect(page.locator('[data-testid="song-title"]')).toBeVisible();
  }
});
```

#### 3.2 재생 테스트

```typescript
test('should play and update currentTime', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  // 재생 버튼 클릭
  await page.click('[data-testid="play-button"]');

  // currentTime이 증가하는지 확인 (실제 재생 검증)
  const initialTime = await page.evaluate(() => {
    return (window as any).__audioEngine.currentTime;
  });

  await page.waitForTimeout(1000); // 1초 대기

  const updatedTime = await page.evaluate(() => {
    return (window as any).__audioEngine.currentTime;
  });

  expect(updatedTime).toBeGreaterThan(initialTime);
  expect(updatedTime - initialTime).toBeCloseTo(1.0, 0.1); // 약 1초 증가
});

test('should pause and maintain currentTime', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  await page.click('[data-testid="play-button"]');
  await page.waitForTimeout(500);

  await page.click('[data-testid="pause-button"]');
  const pausedTime = await page.evaluate(() => (window as any).__audioEngine.currentTime);

  await page.waitForTimeout(1000);
  const stillPausedTime = await page.evaluate(() => (window as any).__audioEngine.currentTime);

  expect(stillPausedTime).toBe(pausedTime); // 시간이 멈춤
});
```

#### 3.3 속도 독립성 테스트 ⭐

**가장 중요한 테스트**: 속도를 변경해도 **피치는 변하지 않는지** 검증

```typescript
test('speed change should NOT affect pitch', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  // 1. 정상 속도로 재생하고 주파수 스펙트럼 캡처
  await page.click('[data-testid="play-button"]');
  await page.waitForTimeout(500);

  const normalSpeedSpectrum = await page.evaluate(() => {
    const analyser = (window as any).__audioEngine.analyserNode;
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);
    return Array.from(frequencyData);
  });

  // 2. 속도를 0.5x로 변경
  await page.locator('[data-testid="speed-slider"]').fill('0.5');
  await page.waitForTimeout(500);

  const slowSpeedSpectrum = await page.evaluate(() => {
    const analyser = (window as any).__audioEngine.analyserNode;
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);
    return Array.from(frequencyData);
  });

  // 3. 주파수 스펙트럼이 거의 동일한지 확인 (피치가 유지됨)
  const similarityScore = calculateSpectralSimilarity(normalSpeedSpectrum, slowSpeedSpectrum);
  expect(similarityScore).toBeGreaterThan(0.95); // 95% 이상 유사

  // 4. 재생 속도는 실제로 0.5배가 되었는지 확인
  const startTime = await page.evaluate(() => (window as any).__audioEngine.currentTime);
  await page.waitForTimeout(1000); // 1초 대기
  const endTime = await page.evaluate(() => (window as any).__audioEngine.currentTime);

  const elapsed = endTime - startTime;
  expect(elapsed).toBeCloseTo(0.5, 0.1); // 약 0.5초 진행 (속도 0.5x)
});

test('speed change to 2.0x should maintain pitch', async ({ page }) => {
  // 위와 동일한 패턴으로 2.0x 테스트
  // 예상: 2초에 약 4초 진행, 주파수 스펙트럼은 동일
});
```

#### 3.4 피치 독립성 테스트 ⭐

**가장 중요한 테스트**: 피치를 변경해도 **속도는 변하지 않는지** 검증

```typescript
test('pitch change should NOT affect speed', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/sine-440hz.wav'); // 테스트용 사인파

  // 1. 정상 피치로 재생하고 주파수 확인
  await page.click('[data-testid="play-button"]');
  await page.waitForTimeout(500);

  const normalPitchFreq = await page.evaluate(() => {
    const analyser = (window as any).__audioEngine.analyserNode;
    const bufferLength = analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(frequencyData);

    // 가장 강한 주파수 찾기
    let maxIndex = 0;
    let maxValue = 0;
    for (let i = 0; i < bufferLength; i++) {
      if (frequencyData[i] > maxValue) {
        maxValue = frequencyData[i];
        maxIndex = i;
      }
    }

    const nyquist = analyser.context.sampleRate / 2;
    return (maxIndex / bufferLength) * nyquist;
  });

  expect(normalPitchFreq).toBeCloseTo(440, 10); // 약 440Hz

  // 2. 피치를 +12 (한 옥타브) 변경
  await page.locator('[data-testid="pitch-slider"]').fill('12');
  await page.waitForTimeout(500);

  const highPitchFreq = await page.evaluate(() => {
    // 위와 동일한 로직으로 주파수 찾기
  });

  expect(highPitchFreq).toBeCloseTo(880, 20); // 약 880Hz (2배)

  // 3. 재생 속도는 변하지 않았는지 확인
  const startTime = await page.evaluate(() => (window as any).__audioEngine.currentTime);
  await page.waitForTimeout(1000);
  const endTime = await page.evaluate(() => (window as any).__audioEngine.currentTime);

  const elapsed = endTime - startTime;
  expect(elapsed).toBeCloseTo(1.0, 0.1); // 여전히 1초에 1초 진행
});

test('pitch change to -12 should maintain speed', async ({ page }) => {
  // 위와 동일한 패턴으로 -12 (한 옥타브 낮춤) 테스트
  // 예상: 주파수 220Hz (절반), 속도는 1.0x 유지
});
```

#### 3.5 볼륨 테스트

```typescript
test('volume change should affect only amplitude', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  await page.click('[data-testid="play-button"]');
  await page.waitForTimeout(500);

  // 1. 볼륨 50%로 설정
  await page.locator('[data-testid="volume-slider"]').fill('50');

  const gainValue = await page.evaluate(() => {
    return (window as any).__audioEngine.masterGainNode.gain.value;
  });

  expect(gainValue).toBeCloseTo(0.5, 0.01);

  // 2. 속도와 피치는 변하지 않았는지 확인
  const speed = await page.evaluate(() => (window as any).__audioEngine.playbackRate);
  const pitch = await page.evaluate(() => (window as any).__audioEngine.pitchShift);

  expect(speed).toBe(1.0);
  expect(pitch).toBe(0);
});

test('mute toggle should set gain to 0', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  await page.click('[data-testid="mute-button"]');

  const gainValue = await page.evaluate(() => {
    return (window as any).__audioEngine.masterGainNode.gain.value;
  });

  expect(gainValue).toBe(0);
});
```

#### 3.6 A-B 루프 테스트

```typescript
test('should loop from B to A when enabled', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  // A 포인트: 5초, B 포인트: 10초 설정
  await page.evaluate(() => {
    (window as any).__audioEngine.setLoopA(5);
    (window as any).__audioEngine.setLoopB(10);
    (window as any).__audioEngine.enableLoop(true);
  });

  await page.click('[data-testid="play-button"]');

  // B 지점(10초)에 도달하면 A 지점(5초)으로 돌아가는지 확인
  await page.evaluate(async () => {
    const engine = (window as any).__audioEngine;
    engine.currentTime = 9.5; // B 근처로 이동

    await new Promise(resolve => setTimeout(resolve, 1000));

    // B를 지나서 A로 돌아갔는지 확인
    return engine.currentTime >= 5 && engine.currentTime < 7;
  });
});

test('should NOT loop when disabled', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  await page.evaluate(() => {
    (window as any).__audioEngine.setLoopA(5);
    (window as any).__audioEngine.setLoopB(10);
    (window as any).__audioEngine.enableLoop(false);
  });

  await page.click('[data-testid="play-button"]');

  // B를 지나서 계속 재생되는지 확인
  const timeAfterB = await page.evaluate(async () => {
    const engine = (window as any).__audioEngine;
    engine.currentTime = 9.5;

    await new Promise(resolve => setTimeout(resolve, 1000));

    return engine.currentTime > 10; // B를 지나감
  });

  expect(timeAfterB).toBe(true);
});
```

#### 3.7 악기별 볼륨 독립성 테스트 (Phase 3)

```typescript
test('vocal volume should affect only vocal track', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/multi-track-song.mp3');

  // 보컬 볼륨을 0으로 설정
  await page.locator('[data-testid="vocal-volume-slider"]').fill('0');

  const gains = await page.evaluate(() => {
    const engine = (window as any).__audioEngine;
    return {
      vocal: engine.trackGains.vocal.gain.value,
      drums: engine.trackGains.drums.gain.value,
      bass: engine.trackGains.bass.gain.value,
      other: engine.trackGains.other.gain.value,
    };
  });

  expect(gains.vocal).toBe(0);
  expect(gains.drums).toBe(1.0); // 변하지 않음
  expect(gains.bass).toBe(1.0);  // 변하지 않음
  expect(gains.other).toBe(1.0); // 변하지 않음
});

test('drum volume should affect only drum track', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/multi-track-song.mp3');

  // 드럼 볼륨을 50%로 설정
  await page.locator('[data-testid="drums-volume-slider"]').fill('50');

  const gains = await page.evaluate(() => {
    const engine = (window as any).__audioEngine;
    return {
      vocal: engine.trackGains.vocal.gain.value,
      drums: engine.trackGains.drums.gain.value,
      bass: engine.trackGains.bass.gain.value,
      other: engine.trackGains.other.gain.value,
    };
  });

  expect(gains.vocal).toBe(1.0);  // 변하지 않음
  expect(gains.drums).toBeCloseTo(0.5, 0.01); // 변경됨
  expect(gains.bass).toBe(1.0);   // 변하지 않음
  expect(gains.other).toBe(1.0);  // 변하지 않음
});
```

#### 3.8 키보드 단축키 테스트

```typescript
test('Space key should toggle play/pause', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  // Space로 재생
  await page.keyboard.press('Space');
  const isPlaying1 = await page.evaluate(() => (window as any).__audioEngine.isPlaying);
  expect(isPlaying1).toBe(true);

  // Space로 일시정지
  await page.keyboard.press('Space');
  const isPlaying2 = await page.evaluate(() => (window as any).__audioEngine.isPlaying);
  expect(isPlaying2).toBe(false);
});

test('Escape key should stop playback', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  await page.keyboard.press('Space'); // 재생 시작
  await page.keyboard.press('Escape'); // 정지

  const currentTime = await page.evaluate(() => (window as any).__audioEngine.currentTime);
  expect(currentTime).toBe(0); // 처음으로 돌아감
});

test('Arrow keys should seek forward/backward', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  await page.evaluate(() => (window as any).__audioEngine.currentTime = 10);

  await page.keyboard.press('ArrowRight'); // +1초
  const time1 = await page.evaluate(() => (window as any).__audioEngine.currentTime);
  expect(time1).toBeCloseTo(11, 0.1);

  await page.keyboard.press('ArrowLeft'); // -1초
  const time2 = await page.evaluate(() => (window as any).__audioEngine.currentTime);
  expect(time2).toBeCloseTo(10, 0.1);
});
```

#### 3.9 성능 테스트

```typescript
test('speed change should not cause audio glitches', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  await page.click('[data-testid="play-button"]');

  // 재생 중 속도를 여러 번 변경
  for (let speed of [0.75, 1.0, 1.25, 0.5, 2.0, 1.0]) {
    await page.locator('[data-testid="speed-slider"]').fill(String(speed));
    await page.waitForTimeout(200);
  }

  // 오디오가 계속 재생되는지 확인 (끊김 없음)
  const isPlaying = await page.evaluate(() => (window as any).__audioEngine.isPlaying);
  expect(isPlaying).toBe(true);

  // currentTime이 계속 증가하는지 확인
  const time1 = await page.evaluate(() => (window as any).__audioEngine.currentTime);
  await page.waitForTimeout(500);
  const time2 = await page.evaluate(() => (window as any).__audioEngine.currentTime);

  expect(time2).toBeGreaterThan(time1);
});

test('should not have memory leaks during long playback', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  await page.click('[data-testid="play-button"]');

  const initialMemory = await page.evaluate(() => {
    return (performance as any).memory?.usedJSHeapSize || 0;
  });

  // 30초 재생
  await page.waitForTimeout(30000);

  const finalMemory = await page.evaluate(() => {
    return (performance as any).memory?.usedJSHeapSize || 0;
  });

  // 메모리 증가가 20% 이하인지 확인
  const memoryIncrease = (finalMemory - initialMemory) / initialMemory;
  expect(memoryIncrease).toBeLessThan(0.2);
});
```

---

### Layer 4: 시각적 회귀 테스트 (Playwright Screenshots)

**목적**: 파형 렌더링과 UI 일관성 검증

```typescript
test('waveform rendering should be consistent', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  await page.waitForTimeout(1000); // 파형 렌더링 대기

  const canvas = page.locator('canvas[data-testid="waveform"]');
  await expect(canvas).toHaveScreenshot('waveform-baseline.png');
});

test('playhead position should be accurate at 10 seconds', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  await page.evaluate(() => (window as any).__audioEngine.currentTime = 10);

  const canvas = page.locator('canvas[data-testid="waveform"]');
  await expect(canvas).toHaveScreenshot('playhead-at-10s.png');
});

test('A-B loop highlight should render correctly', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', './test-audio/test-song.mp3');

  await page.evaluate(() => {
    (window as any).__audioEngine.setLoopA(5);
    (window as any).__audioEngine.setLoopB(15);
  });

  const canvas = page.locator('canvas[data-testid="waveform"]');
  await expect(canvas).toHaveScreenshot('ab-loop-highlight.png');
});
```

---

## 3. 테스트 인프라

### 테스트 오디오 파일

`test-audio/` 디렉토리에 다음 파일들을 준비:

```
test-audio/
├── test-song.mp3          # 일반 음악 파일 (30초)
├── test-song.wav          # WAV 형식
├── test-song.m4a          # M4A 형식
├── test-song.ogg          # OGG 형식
├── sine-440hz.wav         # 440Hz 사인파 (피치 테스트용)
├── sine-880hz.wav         # 880Hz 사인파
├── multi-track-song.mp3   # Phase 3용 멀티트랙 파일
└── white-noise.wav        # 화이트 노이즈 (스펙트럼 테스트용)
```

### 테스트용 사인파 생성기

```typescript
// test-audio/generate-test-tones.ts
import { writeFileSync } from 'fs';

function generateSineWave(frequency: number, durationSeconds: number, sampleRate = 44100) {
  const numSamples = durationSeconds * sampleRate;
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    samples[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }

  return samples;
}

// 440Hz 사인파 생성
const sine440 = generateSineWave(440, 5);
writeFileSync('./test-audio/sine-440hz.wav', encodeWav(sine440));

// 880Hz 사인파 생성
const sine880 = generateSineWave(880, 5);
writeFileSync('./test-audio/sine-880hz.wav', encodeWav(sine880));
```

### CI/CD 환경 설정

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run component tests
        run: npm run test:component

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-results
          path: playwright-report/
```

---

## 4. 커버리지 목표

### 단위 테스트: 85% 이상

- 상태 관리 로직: 100%
- 유틸리티 함수: 100%
- 계산 로직: 100%
- UI 컴포넌트: 80%

### 컴포넌트 테스트: 주요 인터랙션 100%

- 버튼 클릭: 100%
- 슬라이더 조작: 100%
- 키보드 단축키: 100%
- 파일 업로드: 100%

### E2E 테스트: 핵심 기능 시나리오 100% 커버

**필수 시나리오**:
- ✅ 오디오 파일 로딩 (모든 포맷)
- ✅ 재생/일시정지/정지
- ✅ 속도 변경 (독립성 검증 포함)
- ✅ 피치 변경 (독립성 검증 포함)
- ✅ 볼륨 조절
- ✅ A-B 루프
- ✅ 키보드 단축키
- ✅ 악기별 볼륨 조절 (Phase 3)

**독립성 테스트: 100% 커버**:
- ✅ 속도 변경 시 피치 불변
- ✅ 피치 변경 시 속도 불변
- ✅ 볼륨 변경 시 속도/피치 불변
- ✅ 악기별 볼륨 변경 시 다른 악기 불변

---

## 5. Phase별 테스트 계획

### Phase 1: 기본 재생 기능

**Layer 1 (단위 테스트)**:
- ✅ 시간 포맷팅 함수
- ✅ 상태 관리 (Zustand store)
- ✅ 기본 계산 로직

**Layer 2 (컴포넌트 테스트)**:
- ✅ 재생 컨트롤 UI
- ✅ 파형 렌더링 컴포넌트
- ✅ 키보드 단축키

**Layer 3 (E2E 테스트)**:
- ✅ 파일 로딩 및 재생
- ✅ 볼륨 조절
- ✅ A-B 루프
- ✅ 키보드 단축키 동작

---

### Phase 2: 속도/피치 조절

**Layer 1 (단위 테스트)**:
- ✅ 피치 계산 함수
- ✅ 반음 변환 로직
- ✅ 속도 변환 알고리즘

**Layer 2 (컴포넌트 테스트)**:
- ✅ 속도 슬라이더 UI
- ✅ 피치 슬라이더 UI

**Layer 3 (E2E 테스트) - ⭐ 핵심**:
- ✅ 속도 변경 시 피치 불변 검증
- ✅ 피치 변경 시 속도 불변 검증
- ✅ 무끊김 재생 검증
- ✅ 극한값 테스트 (0.25x ~ 4.0x 속도)

---

### Phase 3: 악기별 볼륨 조절 (Spleeter/Demucs 분리)

**Layer 1 (단위 테스트)**:
- ✅ 멀티트랙 상태 관리
- ✅ 트랙별 볼륨 계산

**Layer 2 (컴포넌트 테스트)**:
- ✅ 악기별 볼륨 슬라이더 UI
- ✅ 트랙 뮤트/솔로 버튼

**Layer 3 (E2E 테스트) - ⭐ 핵심**:
- ✅ 보컬 볼륨만 변경, 다른 악기는 유지
- ✅ 드럼 볼륨만 변경, 다른 악기는 유지
- ✅ 베이스 볼륨만 변경, 다른 악기는 유지
- ✅ 기타 볼륨만 변경, 다른 악기는 유지
- ✅ 멀티트랙 재생 성능 검증

---

## 6. 테스트 실행 명령어

```bash
# 단위 테스트만 실행
npm run test:unit

# 컴포넌트 테스트만 실행
npm run test:component

# E2E 테스트만 실행
npm run test:e2e

# 전체 테스트 실행
npm run test

# 커버리지 리포트 생성
npm run test:coverage

# 특정 Phase 테스트만 실행
npm run test:e2e -- --grep "Phase 1"
npm run test:e2e -- --grep "Phase 2"
npm run test:e2e -- --grep "Phase 3"

# 독립성 테스트만 실행 (가장 중요)
npm run test:e2e -- --grep "independence"
```

---

## 7. 헬퍼 유틸리티

### 주파수 스펙트럼 유사도 계산

```typescript
// tests/utils/spectral-similarity.ts
export function calculateSpectralSimilarity(
  spectrum1: number[],
  spectrum2: number[]
): number {
  if (spectrum1.length !== spectrum2.length) {
    throw new Error('Spectrums must have same length');
  }

  // 피어슨 상관계수 계산
  const n = spectrum1.length;
  const mean1 = spectrum1.reduce((a, b) => a + b) / n;
  const mean2 = spectrum2.reduce((a, b) => a + b) / n;

  let numerator = 0;
  let denominator1 = 0;
  let denominator2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = spectrum1[i] - mean1;
    const diff2 = spectrum2[i] - mean2;

    numerator += diff1 * diff2;
    denominator1 += diff1 * diff1;
    denominator2 += diff2 * diff2;
  }

  const correlation = numerator / Math.sqrt(denominator1 * denominator2);
  return correlation; // -1 ~ 1 범위, 1에 가까울수록 유사
}
```

---

## 8. 테스트 성공 기준 (Definition of Done)

### Phase 1 완료 조건

- [ ] 단위 테스트 커버리지 85% 이상
- [ ] 모든 E2E 테스트 통과
- [ ] 파일 로딩, 재생, 볼륨 조절 동작 검증
- [ ] A-B 루프 정상 동작 검증
- [ ] 키보드 단축키 100% 동작

### Phase 2 완료 조건

- [ ] 속도 변경 시 피치 불변 E2E 테스트 통과
- [ ] 피치 변경 시 속도 불변 E2E 테스트 통과
- [ ] 무끊김 재생 E2E 테스트 통과
- [ ] 극한값 테스트 (0.25x ~ 4.0x) 통과

### Phase 3 완료 조건

- [ ] 악기별 볼륨 독립성 E2E 테스트 100% 통과
- [ ] 멀티트랙 재생 성능 테스트 통과
- [ ] 메모리 누수 없음 검증

---

## 9. 결론

이 테스트 설계의 핵심은:

1. **Mock이 아닌 실제 Web Audio API 검증**
2. **각 컨트롤의 독립성을 실제 브라우저에서 확인**
3. **주파수 스펙트럼 분석을 통한 객관적 검증**
4. **장시간 재생 시 메모리 누수 및 성능 검증**

**"테스트가 통과한다 = 실제로 올바르게 동작한다"를 보장하는 것**이 이 프로젝트의 테스트 철학입니다.
