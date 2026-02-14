---
name: moai-tool-ytdlp
description: >
  yt-dlp Python API specialist for server-side YouTube audio extraction.
  Use when implementing YouTube URL to MP3 conversion with FastAPI backend.
  Covers YoutubeDL embedding, format selection, progress hooks,
  post-processors, error handling, and security best practices.
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
  tags: "yt-dlp, youtube, audio extraction, ffmpeg, media processing, FastAPI"
  context7-libraries: "yt-dlp/yt-dlp"
  related-skills: "moai-lang-python, moai-domain-backend"

# MoAI Extension: Progressive Disclosure
progressive_disclosure:
  enabled: true
  level1_tokens: 100
  level2_tokens: 5000

# MoAI Extension: Triggers
triggers:
  keywords: ["yt-dlp", "ytdlp", "youtube", "youtube-dl", "video download", "audio extraction", "mp3 conversion"]
  agents: ["expert-backend"]
  phases: ["run"]
  languages: ["python"]
---

# yt-dlp Python Embedding Guide

Server-side YouTube audio extraction using yt-dlp Python API with FastAPI integration.

## Quick Reference

### Installation and Setup

```bash
pip install yt-dlp
```

Requirements:
- Python 3.10+ (CPython) or 3.11+ (PyPy)
- ffmpeg and ffprobe (required for audio extraction and format conversion)
- yt-dlp-ejs + JavaScript runtime (deno, node, or bun) for full YouTube support
- Optional: mutagen (thumbnail embedding), pycryptodomex (AES-128 HLS)

Latest version: 2026.2.4

### Minimal Audio Download Example

```python
import yt_dlp

ydl_opts = {
    'format': 'bestaudio/best',
    'outtmpl': '%(title)s.%(ext)s',
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '192',
    }],
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(url, download=True)
```

### Key Options Quick Reference

Essential options: `format` (format selector), `outtmpl` (output template), `postprocessors` (post-processing pipeline), `progress_hooks` (progress callbacks), `paths` (output dirs), `restrictfilenames` (ASCII-safe names), `socket_timeout` (timeout seconds), `cookiefile` (cookies.txt path), `noplaylist` (single video only), `quiet`/`no_warnings` (suppress output), `retries`/`fragment_retries` (retry counts), `overwrites` (overwrite control).

---

## Implementation Guide

### Core API Patterns

#### extract_info() - Metadata Only (No Download)

```python
with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
    info = ydl.extract_info(url, download=False)
    title = info.get('title')
    duration = info.get('duration')  # 초 단위
    thumbnail = info.get('thumbnail')
    filesize = info.get('filesize_approx')
```

Use `download=False` for validation and metadata preview before committing to download.

#### extract_info() - Full Download with Post-Processing

```python
with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(url, download=True)
    # download=True triggers postprocessors pipeline
```

[HARD] `download=True` is required for post-processors to execute. With `download=False`, FFmpegExtractAudio will not run.

#### Format Selection for Audio

```python
# 최고 품질 오디오 스트림 선택
'format': 'bestaudio/best'

# m4a 형식 우선 선택 (MP4 컨테이너, AAC 코덱)
'format': 'bestaudio[ext=m4a]/bestaudio/best'

# 파일 크기 제한 (서버 환경에서 권장)
'format': 'bestaudio[filesize<50M]/bestaudio'
```

Format fallback: `bestaudio/best` tries audio-only stream first, falls back to best combined stream if none exists.

#### Post-Processor Configuration

```python
'postprocessors': [
    {'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'},
    {'key': 'FFmpegMetadata'},      # 메타데이터 임베딩 (제목, 아티스트)
    {'key': 'EmbedThumbnail'},      # 썸네일 임베딩
]
```

Supported codecs: mp3, aac, flac, m4a, opus, wav. Quality: `0`-`10` for VBR (0=best), or bitrate string (`'192'`, `'320'`).

#### Progress Hooks

```python
def progress_hook(d: dict) -> None:
    status = d['status']  # 'downloading', 'finished', 'error'

    if status == 'downloading':
        downloaded = d.get('downloaded_bytes', 0)
        total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
        speed = d.get('speed', 0)  # bytes/sec
        eta = d.get('eta', 0)      # 남은 초

        if total > 0:
            percent = (downloaded / total) * 100
            # 프론트엔드로 진행률 전송

    elif status == 'finished':
        filepath = d.get('filename')
        # 다운로드 완료, 후처리 시작됨

    elif status == 'error':
        # 에러 발생
        pass

ydl_opts = {
    'progress_hooks': [progress_hook],
}
```

#### Postprocessor Hooks

```python
def postprocessor_hook(d: dict) -> None:
    if d['status'] == 'finished':
        filepath = d.get('filename')  # 후처리(MP3 변환 등) 완료

ydl_opts = {'postprocessor_hooks': [postprocessor_hook]}
```

### FastAPI Server Integration

#### Async Endpoint with Background Processing

```python
import asyncio
import uuid
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
import yt_dlp

app = FastAPI()
DOWNLOAD_DIR = Path("/tmp/ytdlp_downloads")
DOWNLOAD_DIR.mkdir(exist_ok=True)

# 작업 상태 추적 (프로덕션: Redis 사용 권장)
tasks: dict[str, dict] = {}

async def download_audio(task_id: str, url: str) -> None:
    """백그라운드에서 오디오 다운로드 수행."""
    def progress_hook(d):
        if d['status'] == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
            downloaded = d.get('downloaded_bytes', 0)
            tasks[task_id]['progress'] = (downloaded / total * 100) if total else 0
        elif d['status'] == 'finished':
            tasks[task_id]['progress'] = 100

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': str(DOWNLOAD_DIR / f'{task_id}.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'progress_hooks': [progress_hook],
        'restrictfilenames': True,
        'noplaylist': True,
        'socket_timeout': 30,
        'quiet': True,
        'no_warnings': True,
    }

    try:
        # yt-dlp는 동기 라이브러리 - 스레드풀에서 실행
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(
            None,
            lambda: _run_download(ydl_opts, url),
        )
        tasks[task_id]['status'] = 'completed'
        tasks[task_id]['filename'] = f'{task_id}.mp3'
        tasks[task_id]['title'] = info.get('title', 'Unknown')
    except Exception as e:
        tasks[task_id]['status'] = 'failed'
        tasks[task_id]['error'] = str(e)

def _run_download(opts: dict, url: str) -> dict:
    """동기 다운로드 실행 (스레드풀 전용)."""
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=True)
```

[HARD] yt-dlp is a synchronous library. Always use `run_in_executor()` or a thread pool in async contexts to prevent event loop blocking.

[HARD] Create a new YoutubeDL instance per request. Do NOT share instances across threads -- yt-dlp is not thread-safe.

#### SSE Progress Streaming

```python
from fastapi.responses import StreamingResponse
import json

@app.get("/api/download/{task_id}/progress")
async def stream_progress(task_id: str):
    async def event_generator():
        while True:
            task = tasks.get(task_id)
            if not task:
                yield f"data: {json.dumps({'error': 'Task not found'})}\n\n"
                break

            yield f"data: {json.dumps({
                'status': task['status'],
                'progress': task.get('progress', 0),
            })}\n\n"

            if task['status'] in ('completed', 'failed'):
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
```

#### File Streaming Response

```python
@app.get("/api/download/{task_id}/file")
async def get_file(task_id: str):
    task = tasks.get(task_id)
    if not task or task['status'] != 'completed':
        raise HTTPException(status_code=404, detail="File not ready")

    filepath = DOWNLOAD_DIR / task['filename']
    return FileResponse(
        path=str(filepath),
        filename=f"{task.get('title', 'audio')}.mp3",
        media_type="audio/mpeg",
    )
```

#### Temporary File Cleanup

```python
import time

async def cleanup_old_files(max_age_seconds: int = 3600) -> None:
    """1시간 이상 된 임시 파일 정리."""
    now = time.time()
    for filepath in DOWNLOAD_DIR.iterdir():
        if now - filepath.stat().st_mtime > max_age_seconds:
            filepath.unlink(missing_ok=True)
```

---

## Advanced Implementation

### Security Best Practices

[HARD] URL Validation - Only Allow Trusted Domains

```python
from urllib.parse import urlparse

ALLOWED_HOSTS = {
    'www.youtube.com', 'youtube.com',
    'm.youtube.com', 'youtu.be',
    'music.youtube.com',
}

def validate_youtube_url(url: str) -> bool:
    """허용된 YouTube 도메인만 통과."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False
        if parsed.hostname not in ALLOWED_HOSTS:
            return False
        return True
    except Exception:
        return False
```

Without domain validation, yt-dlp can download from thousands of sites, creating SSRF and abuse vectors.

[HARD] Sanitize Output Filenames

```python
ydl_opts = {
    'restrictfilenames': True,          # ASCII-safe 파일명 강제
    'outtmpl': str(DOWNLOAD_DIR / '%(id)s.%(ext)s'),  # 비디오 ID 기반 파일명
}
```

Never use `%(title)s` for server-side filenames without `restrictfilenames: True`. User-controlled metadata in filenames enables path traversal attacks.

[HARD] Enforce Resource Limits

```python
MAX_DURATION_SECONDS = 600        # 10분 최대
MAX_FILESIZE_BYTES = 100_000_000  # 100MB 최대

async def validate_before_download(url: str) -> dict:
    """다운로드 전 메타데이터로 제한 확인."""
    with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
        info = ydl.extract_info(url, download=False)

    duration = info.get('duration', 0)
    if duration > MAX_DURATION_SECONDS:
        raise ValueError(f"Video too long: {duration}s (max {MAX_DURATION_SECONDS}s)")

    filesize = info.get('filesize_approx', 0)
    if filesize and filesize > MAX_FILESIZE_BYTES:
        raise ValueError(f"File too large: {filesize} bytes")

    return info
```

[HARD] Apply Rate Limiting

```python
from fastapi import Request
from collections import defaultdict
import time

download_tracker: dict[str, list[float]] = defaultdict(list)
MAX_DOWNLOADS_PER_HOUR = 10

def check_rate_limit(client_ip: str) -> None:
    now = time.time()
    hour_ago = now - 3600
    # 1시간 이내 요청만 유지
    download_tracker[client_ip] = [
        t for t in download_tracker[client_ip] if t > hour_ago
    ]
    if len(download_tracker[client_ip]) >= MAX_DOWNLOADS_PER_HOUR:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    download_tracker[client_ip].append(now)
```

[HARD] Set Download Timeouts

```python
ydl_opts = {
    'socket_timeout': 30,     # 네트워크 타임아웃 (초)
}

# 전체 작업 타임아웃은 asyncio.wait_for()로 제어
try:
    await asyncio.wait_for(
        download_audio(task_id, url),
        timeout=300,  # 5분 전체 타임아웃
    )
except asyncio.TimeoutError:
    tasks[task_id]['status'] = 'failed'
    tasks[task_id]['error'] = 'Download timed out'
```

### Error Handling Patterns

```python
from yt_dlp.utils import DownloadError, ExtractorError

def safe_download(opts: dict, url: str) -> dict | None:
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            return ydl.extract_info(url, download=True)

    except DownloadError as e:
        # 동영상 비공개, 삭제, 지역 제한 등
        error_msg = str(e).lower()
        if 'private' in error_msg or 'unavailable' in error_msg:
            raise HTTPException(status_code=404, detail="Video unavailable")
        if 'geo' in error_msg or 'country' in error_msg:
            raise HTTPException(status_code=403, detail="Geo-restricted content")
        if 'age' in error_msg:
            raise HTTPException(status_code=403, detail="Age-restricted content")
        raise HTTPException(status_code=500, detail=f"Download failed: {e}")

    except ExtractorError as e:
        # URL 파싱 실패, 지원되지 않는 사이트 등
        raise HTTPException(status_code=400, detail=f"Cannot extract: {e}")

    except OSError as e:
        # 디스크 공간 부족, 파일 권한 등
        raise HTTPException(status_code=500, detail="Storage error")

    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal error")
```

### Configuration Reference

#### Production Options Template

```python
PRODUCTION_OPTS = {
    'format': 'bestaudio[ext=m4a]/bestaudio/best',
    'noplaylist': True,
    'outtmpl': str(DOWNLOAD_DIR / '%(id)s.%(ext)s'),
    'paths': {'temp': str(DOWNLOAD_DIR / 'tmp')},
    'restrictfilenames': True,
    'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'}],
    'socket_timeout': 30,
    'retries': 3,
    'fragment_retries': 3,
    'quiet': True,
    'no_warnings': True,
    'overwrites': False,
}
```

#### Output Template Variables

`%(id)s` (video ID), `%(title)s` (title), `%(ext)s` (extension), `%(duration)s` (seconds), `%(uploader)s` (channel), `%(upload_date)s` (YYYYMMDD), `%(channel_id)s`, `%(view_count)s`, `%(like_count)s`.

#### Format Selection Cheat Sheet

`bestaudio` (best audio-only), `bestaudio/best` (audio-only with fallback), `bestaudio[ext=m4a]` (M4A/AAC), `bestaudio[ext=webm]` (WebM/Opus), `bestaudio[filesize<50M]` (size limit), `bestaudio[acodec=opus]` (Opus codec).

#### Cookie/Auth Handling

```python
'cookiefile': '/path/to/cookies.txt'           # Netscape HTTP Cookie File 형식
'cookiesfrombrowser': ('chrome',)              # 브라우저 쿠키 추출 (서버 비권장)
# 프로필 지정: ('chrome', 'Profile 1')
```

[HARD] Never use `cookiesfrombrowser` in server environments. Use `cookiefile` with properly secured cookie files if authentication is needed.

---

## Works Well With

- moai-lang-python: Python coding standards and patterns
- moai-domain-backend: FastAPI backend architecture
- expert-backend: Server-side implementation agent
- moai-workflow-templates: FastAPI project scaffolding
