---
name: moai-tool-madmom
description: >
  Python BPM detection and beat tracking specialist using madmom (primary)
  and librosa (fallback). Use when implementing beat position extraction,
  tempo estimation, beat-synchronous audio analysis with FastAPI backend.
  Covers DBNBeatTrackingProcessor, RNNBeatProcessor, librosa.beat.beat_track,
  and audio-to-beat-timestamps pipeline.
license: Apache-2.0
compatibility: Designed for Claude Code
allowed-tools: Read Grep Glob Bash WebFetch WebSearch mcp__context7__resolve-library-id mcp__context7__get-library-docs
user-invocable: false
metadata:
  version: "1.0.0"
  category: "tool"
  status: "active"
  updated: "2026-02-17"
  modularized: "false"
  tags: "madmom, librosa, bpm, beat tracking, beat detection, tempo estimation, onset detection, music information retrieval"
  context7-libraries: "librosa/librosa"
  related-skills: "moai-tool-demucs, moai-lang-python, moai-domain-backend"

# MoAI Extension: Progressive Disclosure
progressive_disclosure:
  enabled: true
  level1_tokens: 100
  level2_tokens: 5000

# MoAI Extension: Triggers
triggers:
  keywords: ["madmom", "librosa", "bpm", "beat tracking", "beat detection", "tempo estimation", "onset detection", "rhythm analysis", "beat timestamp"]
  agents: ["expert-backend", "manager-ddd", "manager-tdd"]
  phases: ["run"]
  languages: ["python"]
---

# BPM Detection and Beat Tracking Guide

Python-based BPM detection and beat position extraction using madmom (primary) and librosa (fallback) with FastAPI integration.

## Quick Reference

### Library Comparison and Selection

| Library | Accuracy | Speed | License | Beat Positions | Recommendation |
|---------|----------|-------|---------|---------------|----------------|
| madmom | Best (DNN, MIREX winner) | 3-8s/4min song | BSD-2 | Yes (precise timestamps) | Primary |
| librosa | Good (onset DP) | 2-5s/4min song | ISC | Yes (beat_track) | Fallback |
| essentia | Very high | Fast (C++) | AGPL | Yes | License risk |
| aubio | Good | Very fast | GPL | Yes | License risk |

Decision: Use madmom for accuracy, librosa as fallback. Both have safe licenses (BSD/ISC).

### madmom Core Usage

```bash
pip install madmom
# Dependencies: numpy, scipy, cython
# Note: May need compilation tools for cython extensions
```

```python
from madmom.features.beats import DBNBeatTrackingProcessor, RNNBeatProcessor
import numpy as np

# Step 1: Extract beat activation function using RNN
act = RNNBeatProcessor()('audio.wav')

# Step 2: Track beats using Dynamic Bayesian Network
proc = DBNBeatTrackingProcessor(fps=100)
beats = proc(act)
# beats = array([0.52, 1.02, 1.52, 2.02, ...]) seconds

# Calculate BPM from beat intervals
intervals = np.diff(beats)
bpm = 60.0 / np.median(intervals)
confidence = 1.0 - np.std(intervals) / np.mean(intervals)
```

### Available Processors

- `DBNBeatTrackingProcessor`: Most accurate, uses Dynamic Bayesian Network
- `BeatTrackingProcessor`: Simpler, uses dynamic programming alignment
- `CRFBeatDetectionProcessor`: Conditional Random Field based
- `BeatDetectionProcessor`: Basic peak detection

### DBNBeatTrackingProcessor Parameters

- `fps` (frames per second): Default 100. Higher = more precise but slower
- `min_bpm` / `max_bpm`: BPM search range (default: 55-215)
- `transition_lambda`: Controls tempo change smoothness

### librosa Core Usage (Fallback)

```python
import librosa

y, sr = librosa.load('audio.wav', sr=22050)

# Beat tracking
tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, start_bpm=120.0)

# Convert frames to timestamps
beat_times = librosa.frames_to_time(beat_frames, sr=sr)
# beat_times = array([0.51, 1.02, 1.53, ...]) seconds

# Variable tempo detection
tempo_dynamic = librosa.feature.tempo(y=y, sr=sr, aggregate=None)
```

### librosa Key Parameters

- `sr`: Sample rate (default 22050)
- `start_bpm`: Initial tempo estimate (default 120)
- `tightness`: How tightly to follow tempo estimate (default 100)
- `units`: 'frames' (default), 'samples', or 'time'

### Response Data Format

```json
{
  "bpm": 120.0,
  "beats": [0.52, 1.02, 1.52, 2.02, 2.52, 3.02],
  "confidence": 0.95
}
```

- `bpm`: Median tempo in BPM
- `beats`: Array of beat timestamps in seconds (original audio time)
- `confidence`: 0-1 reliability score (higher = more consistent tempo)

---

## Implementation Guide

### BPM Service with Fallback

```python
import numpy as np

def detect_beats(audio_path: str) -> tuple[float, np.ndarray, float]:
    """Detect BPM and beat positions. Uses madmom (primary), librosa (fallback)."""
    try:
        return _detect_with_madmom(audio_path)
    except Exception:
        return _detect_with_librosa(audio_path)

def _detect_with_madmom(audio_path: str):
    from madmom.features.beats import DBNBeatTrackingProcessor, RNNBeatProcessor
    act = RNNBeatProcessor()(audio_path)
    proc = DBNBeatTrackingProcessor(fps=100)
    beats = proc(act)
    intervals = np.diff(beats)
    bpm = 60.0 / np.median(intervals)
    confidence = 1.0 - np.std(intervals) / np.mean(intervals)
    return bpm, beats, max(0, min(1, confidence))

def _detect_with_librosa(audio_path: str):
    import librosa
    y, sr = librosa.load(audio_path, sr=22050)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    confidence = 0.7  # librosa doesn't provide confidence
    return float(tempo), beat_times, confidence
```

### FastAPI Integration Pattern

```python
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import tempfile
import os

router = APIRouter(prefix="/api/v1/bpm", tags=["bpm"])

class BpmAnalysisResponse(BaseModel):
    bpm: float
    beats: list[float]
    confidence: float

@router.post("/analyze", response_model=BpmAnalysisResponse)
async def analyze_bpm(file: UploadFile = File(...)):
    if not file.content_type in ["audio/mpeg", "audio/wav", "audio/flac"]:
        raise HTTPException(400, "Unsupported audio format")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        bpm, beats, confidence = detect_beats(tmp_path)
        return BpmAnalysisResponse(
            bpm=round(bpm, 1),
            beats=[round(b, 3) for b in beats.tolist()],
            confidence=round(confidence, 3)
        )
    finally:
        os.unlink(tmp_path)
```

[HARD] madmom `RNNBeatProcessor` and librosa `load()` are synchronous CPU-intensive operations. Always use `run_in_executor()` in async contexts to prevent event loop blocking.

```python
import asyncio

loop = asyncio.get_event_loop()
bpm, beats, confidence = await loop.run_in_executor(
    None, lambda: detect_beats(tmp_path)
)
```

### Caching Strategy

- File hash (SHA256) as cache key (same pattern as stem separation)
- Cache beat data as JSON: `{bpm, beats[], confidence, algorithm}`
- Cache location: same pattern as stem cache directory
- Cache invalidation: none needed (same audio = same beats)
- 5-min song at 120 BPM = ~600 beats = ~5KB JSON (negligible)

```python
import hashlib
import json
from pathlib import Path

CACHE_DIR = Path("/tmp/bpm_cache")
CACHE_DIR.mkdir(exist_ok=True)

def get_file_hash(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def get_cached_beats(filepath: str) -> dict | None:
    cache_key = get_file_hash(filepath)
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text())
    return None

def save_cached_beats(filepath: str, bpm: float, beats: list, confidence: float, algorithm: str) -> None:
    cache_key = get_file_hash(filepath)
    cache_file = CACHE_DIR / f"{cache_key}.json"
    cache_file.write_text(json.dumps({
        "bpm": bpm, "beats": beats,
        "confidence": confidence, "algorithm": algorithm
    }))
```

---

## Advanced Implementation

### Python 3.13+ Compatibility Notes

- madmom: May need cython compilation. Check compatibility before deployment.
- librosa 0.11.0: Fully compatible with Python 3.13
- numpy 2.x: Both libraries work with numpy 2.x
- Test installation in Docker environment before deploying

### Performance Considerations

- madmom RNNBeatProcessor: CPU-intensive (neural network inference)
- Processing time: ~1-2x song duration for madmom, ~0.5-1x for librosa
- Consider running analysis as BackgroundTask for long files
- Memory: ~200MB for madmom models loaded in memory

[HARD] For production, run BPM analysis as a BackgroundTask for files longer than 60 seconds. Return a task ID and let clients poll for results (same pattern as yt-dlp downloads).

### Anti-Patterns

- Using only BPM number without beat timestamps (cannot place clicks at exact positions)
- Analyzing BPM on every playback (should cache results per file hash)
- Running BPM analysis on the frontend for complex music (accuracy too low)
- Not providing librosa fallback when madmom fails to install
- Blocking the API endpoint during analysis (use async/BackgroundTask for long files)

### Official Documentation References

- madmom GitHub: https://github.com/CPJKU/madmom
- madmom Docs (latest): https://madmom.readthedocs.io/en/latest/modules/features/beats.html
- madmom Docs (v0.16): https://madmom.readthedocs.io/en/v0.16/modules/features/beats.html
- madmom PyPI: https://pypi.org/project/madmom/
- madmom Paper: https://dl.acm.org/doi/10.1145/2964284.2973795
- librosa beat_track: https://librosa.org/doc/main/generated/librosa.beat.beat_track.html
- librosa Beat and Tempo: https://librosa.org/doc/latest/beat.html
- librosa Tutorial: https://librosa.org/doc/0.11.0/tutorial.html
- librosa Variable Tempo: http://librosa.org/doc/0.11.0/auto_examples/plot_dynamic_beat.html
- web-audio-beat-detector (JS fallback): https://github.com/chrisguttandin/web-audio-beat-detector

---

## Works Well With

- moai-tool-demucs: Backend stem separation (BPM analysis often runs on separated stems)
- moai-lang-python: Python coding standards and patterns
- moai-domain-backend: FastAPI backend architecture
- moai-tool-webaudio-stems: Frontend stem playback (uses beat timestamps for UI sync)
- expert-backend: Server-side implementation agent
