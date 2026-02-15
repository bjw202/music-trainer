"""pytest 픽스처 모듈.

테스트에 필요한 공통 픽스처를 정의합니다.
"""

from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.config import Settings
from app.main import create_app
from app.services.separation_service import SeparationService
from app.services.youtube_service import YouTubeService
from app.utils.rate_limiter import RateLimiter


@pytest.fixture
def tmp_download_dir(tmp_path: Path) -> Path:
    """테스트용 임시 다운로드 디렉터리를 생성합니다."""
    download_dir = tmp_path / "downloads"
    download_dir.mkdir()
    return download_dir


@pytest.fixture
def mock_settings(tmp_download_dir: Path) -> Settings:
    """테스트용 Settings 인스턴스를 반환합니다."""
    return Settings(
        download_dir=str(tmp_download_dir),
        max_duration_seconds=1800,
        max_concurrent_downloads=5,
        rate_limit_per_minute=10,
        cors_origins=["http://localhost:5173", "http://localhost:3000"],
        port=8000,
    )


@pytest.fixture
def youtube_service(tmp_download_dir: Path) -> YouTubeService:
    """테스트용 YouTubeService 인스턴스를 반환합니다."""
    return YouTubeService(download_dir=str(tmp_download_dir))


@pytest.fixture
def stems_cache_dir(tmp_path: Path) -> Path:
    """테스트용 스템 캐시 디렉터리를 생성합니다."""
    cache_dir = tmp_path / "stems_cache"
    cache_dir.mkdir()
    return cache_dir


@pytest.fixture
def separation_service(stems_cache_dir: Path) -> SeparationService:
    """테스트용 SeparationService 인스턴스를 반환합니다."""
    return SeparationService(cache_dir=str(stems_cache_dir))


@pytest.fixture
def rate_limiter() -> RateLimiter:
    """테스트용 RateLimiter 인스턴스를 반환합니다."""
    return RateLimiter(max_requests_per_minute=10)


@pytest_asyncio.fixture
async def async_client(mock_settings: Settings, tmp_download_dir: Path, tmp_path: Path) -> AsyncClient:
    """테스트용 AsyncClient를 생성합니다.

    yt-dlp 호출을 모킹하고, 설정을 테스트용으로 교체합니다.
    """
    with patch("app.config.get_settings", return_value=mock_settings):
        with patch("app.services.youtube_service.get_settings", return_value=mock_settings):
            # 전역 rate_limiter 초기화
            from app.utils.rate_limiter import rate_limiter as global_rate_limiter
            global_rate_limiter.reset()
            global_rate_limiter.max_requests_per_minute = 10

            # 전역 youtube_service 설정 업데이트
            from app.services.youtube_service import youtube_service as global_service
            global_service.download_dir = tmp_download_dir
            global_service._tasks.clear()

            # 전역 separation_service 설정 업데이트
            from app.services.separation_service import separation_service as global_separation_service
            test_stems_cache = tmp_path / "test_stems_cache"
            test_stems_cache.mkdir(exist_ok=True)
            global_separation_service.cache_dir = test_stems_cache
            global_separation_service._tasks.clear()

            app = create_app()
            transport = ASGITransport(app=app)
            async with AsyncClient(
                transport=transport,
                base_url="http://test",
            ) as client:
                yield client
