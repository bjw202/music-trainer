---
name: moai-tool-demucs
description: >
  Demucs AI music source separation specialist for CPU-only server environments.
  Use when implementing audio stem separation with FastAPI backend, extracting
  vocals, drums, bass, guitar, or piano from music files. Covers Separator API,
  CPU optimization, background task processing, stem caching, memory management,
  and concurrent request limiting.
license: Apache-2.0
compatibility: Designed for Claude Code
allowed-tools: Read Grep Glob Bash WebFetch WebSearch mcp__context7__resolve-library-id mcp__context7__get-library-docs
user-invocable: false
metadata:
  version: "1.0.0"
  category: "tool"
  status: "active"
  updated: "2026-02-15"
  modularized: "false"
  tags: "demucs, stem separation, source separation, audio processing, AI, music, FastAPI, torch"
  related-skills: "moai-lang-python, moai-domain-backend, moai-tool-ytdlp"

# MoAI Extension: Progressive Disclosure
progressive_disclosure:
  enabled: true
  level1_tokens: 100
  level2_tokens: 5000

# MoAI Extension: Triggers
triggers:
  keywords: ["demucs", "stem separation", "source separation", "music separation", "vocal extraction", "drum extraction", "stem mixer", "audio stems"]
  agents: ["expert-backend"]
  phases: ["run"]
  languages: ["python"]
---

# Demucs AI Music Source Separation Guide

CPU-only music source separation using Meta's Demucs Python API with FastAPI integration.

## Quick Reference

### Installation (CPU-Only)

```bash
# PyTorch CPU-only (CUDA 불포함으로 설치 크기 대폭 감소)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Demucs 설치
pip install demucs
```

Requirements:
- Python 3.10+
- PyTorch 2.0+ (CPU build)
- torchaudio (오디오 로딩/리샘플링)
- ffmpeg (MP3/FLAC 등 비-WAV 포맷 지원)
- RAM: 최소 4GB, 권장 8GB

### Minimal Separation Example

```python
import demucs.api

# Separator 초기화 (CPU 전용)
separator = demucs.api.Separator(
    model="htdemucs",
    device="cpu",
    segment=12,
)

# 오디오 파일 분리
origin, separated = separator.separate_audio_file("input.mp3")

# 개별 스템 저장
for stem_name, stem_audio in separated.items():
    demucs.api.save_audio(
        stem_audio,
        f"output/{stem_name}.wav",
        samplerate=separator.samplerate,
    )
```

### Model Comparison

htdemucs (default):
- 4 stems: drums, bass, other, vocals
- Speed: ~1.5x song duration (CPU)
- Quality: Good. Best speed-quality balance.
- RAM: ~4GB

htdemucs_ft (fine-tuned):
- 4 stems: drums, bass, other, vocals
- Speed: ~6x song duration (CPU, 4x slower than htdemucs)
- Quality: Best. Fine-tuned for highest SDR scores.
- RAM: ~4GB

htdemucs_6s (6-source):
- 6 stems: drums, bass, other, vocals, guitar, piano
- Speed: ~2x song duration (CPU)
- Quality: Experimental. Guitar acceptable, piano quality poor.
- RAM: ~5GB

### Key Options Reference

`model`: Model name (default: "htdemucs")
`device`: Torch device (use "cpu" for CPU-only)
`segment`: Chunk length in seconds (default: model-specific, lower = less RAM)
`shifts`: Random shift count for accuracy (default: 1, higher = slower but better)
`overlap`: Segment overlap ratio (default: 0.25)
`split`: Enable chunked processing (default: True)
`jobs`: Parallel processing jobs (default: 0)
`callback`: Progress callback function
`progress`: Show progress bar (default: False)

---

## Implementation Guide

### Core Separator API

#### Separator Class and Separation Methods

```python
import demucs.api

separator = demucs.api.Separator(model="htdemucs", device="cpu", segment=12, shifts=1)

# 읽기 전용 속성
separator.samplerate      # 모델 샘플레이트 (44100)
separator.audio_channels  # 채널 수 (2 = 스테레오)

# 방법 1: 파일 경로로 분리 (WAV, MP3, FLAC, OGG 지원)
origin, separated = separator.separate_audio_file("track.mp3")
# origin: 원본 텐서 (channels, samples)
# separated: dict[str, Tensor] - {"drums": tensor, "bass": tensor, ...}

# 방법 2: 텐서로 분리
import torchaudio
wav, sr = torchaudio.load("track.mp3")  # (channels, samples)
origin, separated = separator.separate_tensor(wav, sr)
```

#### Saving Stems

```python
# WAV 저장 (기본)
demucs.api.save_audio(separated["vocals"], "output/vocals.wav", samplerate=separator.samplerate)

# 24-bit WAV
demucs.api.save_audio(separated["drums"], "output/drums.wav", samplerate=separator.samplerate, bits_per_sample=24)

# MP3 저장
demucs.api.save_audio(separated["bass"], "output/bass.mp3", samplerate=separator.samplerate, bitrate=320)
```

`save_audio()` params: `wav` (tensor), `path` (str), `samplerate` (int), `bitrate` (MP3), `bits_per_sample` (WAV 16/24), `as_float` (32-bit float WAV).

### CPU-Only Configuration

[HARD] Always set `device="cpu"` explicitly. Do NOT rely on auto-detection -- servers without GPU will fall back silently but with suboptimal threading.

```python
import torch

# CPU 스레드 수 설정 (서버 vCPU 수에 맞춤)
# Railway/Fly.io 2-4 vCPU: 2-4 스레드 권장
torch.set_num_threads(4)

# 추론 시 그래디언트 비활성화 (메모리 절약)
torch.set_grad_enabled(False)

separator = demucs.api.Separator(
    model="htdemucs",
    device="cpu",
    segment=12,  # 세그먼트 길이 (초), 낮을수록 RAM 적게 사용
    shifts=1,    # CPU에서는 1 권장 (높을수록 느림)
)
```

[HARD] Call `torch.set_num_threads()` before creating the Separator. Thread count should match server vCPU count (2-4 for Railway/Fly.io).

[HARD] Call `torch.set_grad_enabled(False)` at application startup. Inference does not need gradients -- disabling saves ~30% memory.

### Progress Callback for SSE Streaming

```python
import threading

# 스레드-안전 진행률 저장소
progress_store: dict[str, dict] = {}
progress_lock = threading.Lock()

def make_callback(task_id: str):
    """작업별 콜백 팩토리."""
    def callback(info: dict):
        offset = info.get("segment_offset", 0)
        total = info.get("audio_length", 1)
        state = info.get("state", "")
        progress = min(offset / total * 100, 99) if total > 0 else 0

        with progress_lock:
            progress_store[task_id] = {
                "progress": round(progress, 1),
                "state": state,
            }
    return callback

separator = demucs.api.Separator(
    model="htdemucs",
    device="cpu",
    callback=make_callback("task-123"),
    callback_arg={},
)
```

Callback info dictionary keys: `model_idx_in_bag` (submodel index), `shift_idx` (shift iteration), `segment_offset` (current position in frames), `state` ("start" or "end"), `audio_length` (total frames), `models` (submodel count).

### FastAPI BackgroundTasks Integration

```python
import asyncio
import hashlib
import uuid
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile
from fastapi.responses import StreamingResponse, FileResponse
import json
import demucs.api
import torch

torch.set_num_threads(4)
torch.set_grad_enabled(False)

app = FastAPI()
STEMS_DIR = Path("/tmp/demucs_stems")
STEMS_DIR.mkdir(exist_ok=True)

# 작업 상태 추적
tasks: dict[str, dict] = {}

def compute_file_hash(filepath: Path) -> str:
    """파일 해시 계산 (캐싱 키)."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def run_separation(task_id: str, audio_path: Path, model: str = "htdemucs") -> None:
    """동기 분리 실행 (스레드풀 전용)."""
    try:
        tasks[task_id]["status"] = "processing"
        file_hash = compute_file_hash(audio_path)
        output_dir = STEMS_DIR / file_hash

        # 캐시 확인
        if output_dir.exists() and any(output_dir.iterdir()):
            tasks[task_id]["status"] = "completed"
            tasks[task_id]["output_dir"] = str(output_dir)
            tasks[task_id]["cached"] = True
            return

        output_dir.mkdir(parents=True, exist_ok=True)

        separator = demucs.api.Separator(
            model=model,
            device="cpu",
            segment=12,
            shifts=1,
            callback=make_callback(task_id),
            callback_arg={},
        )

        origin, separated = separator.separate_audio_file(str(audio_path))

        for stem_name, stem_audio in separated.items():
            demucs.api.save_audio(
                stem_audio,
                str(output_dir / f"{stem_name}.wav"),
                samplerate=separator.samplerate,
            )

        tasks[task_id]["status"] = "completed"
        tasks[task_id]["output_dir"] = str(output_dir)
        tasks[task_id]["stems"] = list(separated.keys())

    except Exception as e:
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = str(e)

@app.post("/api/separate")
async def separate_audio(file: UploadFile, model: str = "htdemucs"):
    task_id = str(uuid.uuid4())
    # 업로드 파일 임시 저장
    audio_path = STEMS_DIR / f"input_{task_id}{Path(file.filename).suffix}"
    with open(audio_path, "wb") as f:
        content = await file.read()
        f.write(content)

    tasks[task_id] = {"status": "queued", "progress": 0}

    # 스레드풀에서 동기 분리 실행
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, run_separation, task_id, audio_path, model)

    return {"task_id": task_id}
```

[HARD] Demucs is a synchronous, CPU-intensive library. Always use `run_in_executor()` in async contexts to prevent event loop blocking.

[HARD] Create a new Separator per request. Model weights are shared via PyTorch's internal caching, but Separator state (callback, progress) is per-request.

#### SSE Progress Endpoint

```python
@app.get("/api/separate/{task_id}/progress")
async def stream_progress(task_id: str):
    async def event_generator():
        while True:
            task = tasks.get(task_id)
            if not task:
                yield f"data: {json.dumps({'error': 'Task not found'})}\n\n"
                break

            progress_info = progress_store.get(task_id, {})
            yield f"data: {json.dumps({
                'status': task['status'],
                'progress': progress_info.get('progress', 0),
            })}\n\n"

            if task["status"] in ("completed", "failed"):
                break
            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

#### Stem File Download

```python
@app.get("/api/separate/{task_id}/stems/{stem_name}")
async def get_stem(task_id: str, stem_name: str):
    task = tasks.get(task_id)
    if not task or task["status"] != "completed":
        raise HTTPException(status_code=404, detail="Stems not ready")

    stem_path = Path(task["output_dir"]) / f"{stem_name}.wav"
    if not stem_path.exists():
        raise HTTPException(status_code=404, detail=f"Stem '{stem_name}' not found")

    return FileResponse(str(stem_path), media_type="audio/wav", filename=f"{stem_name}.wav")
```

---

## Advanced Implementation

### CPU Optimization Rules

[HARD] Set `segment=12` or lower for CPU processing. Default segment values consume excessive RAM on CPU-only servers. Lower values reduce peak memory at minimal quality cost.

[HARD] Use `shifts=1` on CPU. Each additional shift multiplies processing time linearly. `shifts=1` provides the best speed-quality trade-off for CPU.

[HARD] Never set `jobs > 0` on CPU servers with limited RAM. Parallel jobs multiply memory usage. Use sequential processing on 4-8GB RAM servers.

### Memory Management

```python
import psutil

MEMORY_PER_SEPARATION_MB = 4096  # ~4GB per active separation
MEMORY_SAFETY_MARGIN_MB = 1024   # OS/FastAPI 여유 공간

def get_max_concurrent_separations() -> int:
    """서버 RAM 기반 최대 동시 처리 수 계산."""
    total_mb = psutil.virtual_memory().total / (1024 * 1024)
    available = total_mb - MEMORY_SAFETY_MARGIN_MB
    return max(1, int(available / MEMORY_PER_SEPARATION_MB))

# 동시 처리 제한 세마포어
import threading
max_concurrent = get_max_concurrent_separations()
separation_semaphore = threading.Semaphore(max_concurrent)

def run_separation_limited(task_id: str, audio_path: Path, model: str) -> None:
    """메모리 제한 분리 실행."""
    if not separation_semaphore.acquire(timeout=0):
        tasks[task_id]["status"] = "queued"
        # 재시도 큐에 추가
        return
    try:
        run_separation(task_id, audio_path, model)
    finally:
        separation_semaphore.release()
```

[HARD] Limit concurrent separations based on available RAM. Each separation uses ~4GB. On 8GB server: max 1 concurrent. On 16GB: max 3 concurrent.

### Hash-Based Stem Caching

Cache strategy: SHA-256 hash of input file maps to output directory (`STEMS_DIR / file_hash/`). Same file always produces identical stems, avoiding re-processing. The `run_separation()` function above already implements cache check and write. Disk usage: ~4x input file size per cached result (4 WAV stems). Clean up cached directories older than 72 hours via `shutil.rmtree()` in periodic background task.

### Security and Validation

[HARD] Validate uploaded files before processing.

```python
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac"}
MAX_FILE_SIZE_MB = 100
MAX_DURATION_SECONDS = 600  # 10분

def validate_audio_file(file: UploadFile, content: bytes) -> None:
    """업로드 파일 검증."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format: {ext}")

    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(413, f"File too large: {size_mb:.1f}MB (max {MAX_FILE_SIZE_MB}MB)")
```

[HARD] Apply rate limiting per client IP. Separation is CPU-intensive -- uncontrolled access can exhaust server resources.

[HARD] Set processing timeouts. Maximum 10 minutes per separation (covers ~6 minute songs with htdemucs_ft model).

```python
async def separate_with_timeout(task_id: str, audio_path: Path, model: str):
    try:
        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(None, run_separation_limited, task_id, audio_path, model),
            timeout=600,  # 10분 타임아웃
        )
    except asyncio.TimeoutError:
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = "Separation timed out"
```

### Error Handling

Key exceptions to catch: `RuntimeError` with "out of memory" (RAM 부족), `FileNotFoundError` (파일 없음), `ValueError` (잘못된 오디오 형식). Always clean up temp input files in `finally` block.

```python
def safe_separation(task_id: str, audio_path: Path, model: str) -> None:
    try:
        run_separation(task_id, audio_path, model)
    except RuntimeError as e:
        msg = "Insufficient memory" if "out of memory" in str(e).lower() else str(e)
        tasks[task_id].update(status="failed", error=msg)
    except Exception as e:
        tasks[task_id].update(status="failed", error=f"Separation failed: {e}")
    finally:
        if audio_path.exists() and "input_" in audio_path.name:
            audio_path.unlink(missing_ok=True)
```

Temporary file cleanup: Remove `input_*` files older than 1 hour and cached stem directories older than 72 hours using `shutil.rmtree()`. Run cleanup on app startup and via periodic background task.

### Server Deployment Notes

Railway/Fly.io CPU instances (2-4 vCPU, 4-8GB RAM):
- `torch.set_num_threads(2)` for 2 vCPU, `4` for 4 vCPU
- Max 1 concurrent separation on 4GB, 1 on 8GB (with safety margin)
- First request downloads model weights (~300MB), subsequent requests use cache
- Model caching: Set `TORCH_HOME` env var to persistent volume path for model weight persistence across deploys

---

## Works Well With

- moai-tool-ytdlp: YouTube audio extraction (download -> separate pipeline)
- moai-lang-python: Python coding standards and patterns
- moai-domain-backend: FastAPI backend architecture
- expert-backend: Server-side implementation agent
