"""YouTube 다운로드 및 MP3 변환 서비스.

yt-dlp를 래핑하여 비동기 변환 기능을 제공합니다.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import os
import uuid
from pathlib import Path
from typing import Any

import yt_dlp

from app.config import get_settings

logger = logging.getLogger(__name__)

# 태스크 상태 타입
TaskStatus = dict[str, Any]


class YouTubeService:
    """YouTube 다운로드 및 MP3 변환 서비스.

    동시 다운로드 수를 세마포어로 제한하고,
    인메모리 딕셔너리로 태스크 상태를 추적합니다.
    """

    # 쿠키 파일 경로 (앱 시작 시 한 번만 디코딩/저장)
    _cookie_path: str | None = None

    def __init__(self, download_dir: str | None = None) -> None:
        settings = get_settings()
        self.download_dir = Path(download_dir or settings.download_dir)
        self._semaphore = asyncio.Semaphore(settings.max_concurrent_downloads)
        self._tasks: dict[str, TaskStatus] = {}
        self._setup_cookies(settings.youtube_cookies)

    def _setup_cookies(self, youtube_cookies: str) -> None:
        """base64 인코딩된 쿠키를 디코딩하여 파일로 저장합니다."""
        if not youtube_cookies:
            logger.info("YouTube cookies not configured, proceeding without authentication")
            return

        cookie_path = "/tmp/yt_cookies.txt"
        try:
            decoded = base64.b64decode(youtube_cookies)
            with open(cookie_path, "wb") as f:
                f.write(decoded)
            self._cookie_path = cookie_path
            logger.info("YouTube cookies loaded successfully: %s", cookie_path)
        except Exception:
            logger.exception("Failed to decode YouTube cookies, proceeding without authentication")
            self._cookie_path = None

    def _get_cookie_opts(self) -> dict[str, Any]:
        """쿠키 파일이 설정된 경우 yt-dlp cookiefile 옵션을 반환합니다."""
        if self._cookie_path:
            return {"cookiefile": self._cookie_path}
        return {}

    @property
    def tasks(self) -> dict[str, TaskStatus]:
        """현재 태스크 상태 딕셔너리를 반환합니다."""
        return self._tasks

    @property
    def active_count(self) -> int:
        """현재 진행 중인 변환 수를 반환합니다."""
        return sum(
            1
            for t in self._tasks.values()
            if t.get("status") in ("downloading", "converting", "processing")
        )

    def create_task(self) -> str:
        """새 태스크를 생성하고 task_id를 반환합니다."""
        task_id = str(uuid.uuid4())
        self._tasks[task_id] = {
            "status": "pending",
            "progress": 0.0,
            "stage": "대기 중",
            "filename": None,
            "title": None,
            "error": None,
        }
        return task_id

    async def validate_video(self, url: str) -> dict[str, Any]:
        """동영상 메타데이터를 추출하여 유효성을 검사합니다.

        Args:
            url: YouTube URL.

        Returns:
            동영상 메타데이터 딕셔너리.

        Raises:
            ValueError: 동영상이 너무 길거나 추출 실패 시.
        """
        settings = get_settings()

        ydl_opts: dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
            "noplaylist": True,
            "socket_timeout": 30,
        }
        ydl_opts.update(self._get_cookie_opts())

        loop = asyncio.get_event_loop()

        try:
            # yt-dlp는 동기 라이브러리이므로 executor에서 실행
            # [HARD] 요청마다 새 YoutubeDL 인스턴스 생성 (스레드 안전)
            info = await loop.run_in_executor(
                None,
                self._extract_info,
                url,
                ydl_opts,
            )
        except yt_dlp.utils.DownloadError as e:
            msg = f"동영상 정보를 가져올 수 없습니다: {e}"
            raise ValueError(msg) from e
        except yt_dlp.utils.ExtractorError as e:
            msg = f"동영상 추출 중 오류가 발생했습니다: {e}"
            raise ValueError(msg) from e

        if not info:
            msg = "동영상 정보를 가져올 수 없습니다."
            raise ValueError(msg)

        duration = info.get("duration", 0) or 0
        if duration > settings.max_duration_seconds:
            minutes = settings.max_duration_seconds // 60
            msg = f"동영상이 너무 깁니다. 최대 {minutes}분까지 지원합니다."
            raise ValueError(msg)

        return {
            "title": info.get("title", "Unknown"),
            "duration": duration,
            "uploader": info.get("uploader", "Unknown"),
        }

    @staticmethod
    def _extract_info(url: str, ydl_opts: dict[str, Any]) -> dict[str, Any] | None:
        """yt-dlp로 동영상 정보를 추출합니다 (동기 메서드)."""
        # [HARD] 요청마다 새 YoutubeDL 인스턴스 생성
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(url, download=False)

    async def start_conversion(self, url: str, task_id: str) -> None:
        """YouTube URL을 MP3로 변환합니다.

        세마포어로 동시 다운로드 수를 제한하고,
        진행 상태를 태스크 딕셔너리에 업데이트합니다.

        Args:
            url: YouTube URL.
            task_id: 태스크 ID.
        """
        async with self._semaphore:
            self._tasks[task_id]["status"] = "downloading"
            self._tasks[task_id]["stage"] = "다운로드 중"

            # 비디오 ID로 파일명 생성 (보안)
            # [HARD] 비디오 제목이 아닌 ID를 사용
            output_template = str(
                self.download_dir / f"{task_id}" / "%(id)s.%(ext)s"
            )

            # 태스크 디렉터리 생성
            task_dir = self.download_dir / task_id
            task_dir.mkdir(parents=True, exist_ok=True)

            def progress_hook(d: dict[str, Any]) -> None:
                """yt-dlp 진행 상태 콜백."""
                if d["status"] == "downloading":
                    total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                    downloaded = d.get("downloaded_bytes", 0)
                    if total > 0:
                        percent = (downloaded / total) * 70  # 다운로드 = 0~70%
                    else:
                        percent = 0.0
                    self._tasks[task_id]["progress"] = round(percent, 1)
                    self._tasks[task_id]["stage"] = "다운로드 중"

                    eta = d.get("eta")
                    if eta is not None:
                        self._tasks[task_id]["estimated_remaining"] = int(eta)

                elif d["status"] == "finished":
                    self._tasks[task_id]["progress"] = 70.0
                    self._tasks[task_id]["status"] = "converting"
                    self._tasks[task_id]["stage"] = "변환 중"

            ydl_opts: dict[str, Any] = {
                "format": "bestaudio/best",
                "postprocessors": [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "mp3",
                        "preferredquality": "192",
                    }
                ],
                "outtmpl": output_template,
                "restrictfilenames": True,  # [HARD]
                "noplaylist": True,
                "socket_timeout": 30,  # [HARD]
                "progress_hooks": [progress_hook],
                "quiet": True,
                "no_warnings": True,
            }
            ydl_opts.update(self._get_cookie_opts())

            loop = asyncio.get_event_loop()

            try:
                # [HARD] run_in_executor로 yt-dlp 실행
                # [HARD] 전체 타임아웃 300초
                await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        self._download,
                        url,
                        ydl_opts,
                    ),
                    timeout=300,
                )

                # 변환 완료 후 MP3 파일 찾기
                mp3_files = list(task_dir.glob("*.mp3"))
                if mp3_files:
                    mp3_file = mp3_files[0]
                    self._tasks[task_id]["status"] = "complete"
                    self._tasks[task_id]["progress"] = 100.0
                    self._tasks[task_id]["stage"] = "완료"
                    self._tasks[task_id]["filename"] = str(mp3_file)
                else:
                    self._tasks[task_id]["status"] = "error"
                    self._tasks[task_id]["error"] = "conversion_failed"
                    self._tasks[task_id]["stage"] = "변환 실패"

            except TimeoutError:
                self._tasks[task_id]["status"] = "error"
                self._tasks[task_id]["error"] = "timeout"
                self._tasks[task_id]["stage"] = "시간 초과"
                logger.error("Conversion timeout for task %s", task_id)

            except yt_dlp.utils.DownloadError as e:
                self._tasks[task_id]["status"] = "error"
                self._tasks[task_id]["error"] = "download_failed"
                self._tasks[task_id]["stage"] = "다운로드 실패"
                logger.error("Download error for task %s: %s", task_id, e)

            except OSError as e:
                self._tasks[task_id]["status"] = "error"
                self._tasks[task_id]["error"] = "io_error"
                self._tasks[task_id]["stage"] = "파일 처리 오류"
                logger.error("IO error for task %s: %s", task_id, e)

            except Exception:
                self._tasks[task_id]["status"] = "error"
                self._tasks[task_id]["error"] = "unknown_error"
                self._tasks[task_id]["stage"] = "알 수 없는 오류"
                logger.exception("Unexpected error for task %s", task_id)

    @staticmethod
    def _download(url: str, ydl_opts: dict[str, Any]) -> None:
        """yt-dlp로 다운로드를 실행합니다 (동기 메서드).

        [HARD] 요청마다 새 YoutubeDL 인스턴스를 생성합니다.
        """
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

    def get_task(self, task_id: str) -> TaskStatus | None:
        """태스크 상태를 반환합니다."""
        return self._tasks.get(task_id)

    def remove_task(self, task_id: str) -> None:
        """태스크를 제거합니다."""
        self._tasks.pop(task_id, None)

    def get_download_path(self, task_id: str) -> Path | None:
        """태스크의 다운로드 파일 경로를 반환합니다."""
        task = self._tasks.get(task_id)
        if not task or not task.get("filename"):
            return None
        filepath = Path(task["filename"])
        if filepath.exists():
            return filepath
        return None


# 전역 서비스 인스턴스
youtube_service = YouTubeService()
