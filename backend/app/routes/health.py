"""헬스 체크 라우트.

서버 상태, ffmpeg 가용성, 디스크 공간, 활성 변환 수를 확인합니다.
"""

from __future__ import annotations

import shutil
import subprocess

from fastapi import APIRouter

from app.models.schemas import HealthResponse
from app.services.youtube_service import youtube_service

router = APIRouter(tags=["health"])


def check_ffmpeg_available() -> bool:
    """ffmpeg가 시스템에 설치되어 있는지 확인합니다."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            timeout=5,
            check=False,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False


def get_disk_space_mb() -> float:
    """다운로드 디렉터리의 사용 가능한 디스크 공간(MB)을 반환합니다."""
    try:
        from app.config import get_settings

        settings = get_settings()
        usage = shutil.disk_usage(settings.download_dir)
        return round(usage.free / (1024 * 1024), 1)
    except OSError:
        return 0.0


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """서버 헬스 체크 엔드포인트.

    Returns:
        서버 상태, ffmpeg 가용성, 디스크 공간, 활성 변환 수.
    """
    return HealthResponse(
        status="healthy",
        ffmpeg_available=check_ffmpeg_available(),
        disk_space_mb=get_disk_space_mb(),
        active_conversions=youtube_service.active_count,
    )
