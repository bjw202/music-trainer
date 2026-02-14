"""YouTube 서비스 테스트 (yt-dlp 모킹)."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from app.services.youtube_service import YouTubeService


@pytest.fixture
def service(tmp_path: Path) -> YouTubeService:
    """테스트용 YouTubeService를 생성합니다."""
    download_dir = tmp_path / "downloads"
    download_dir.mkdir()
    return YouTubeService(download_dir=str(download_dir))


class TestCreateTask:
    """태스크 생성 테스트."""

    def test_create_task_returns_uuid(self, service: YouTubeService) -> None:
        """create_task가 UUID 문자열을 반환하는지 확인합니다."""
        task_id = service.create_task()
        assert isinstance(task_id, str)
        assert len(task_id) == 36  # UUID 형식

    def test_create_task_initializes_status(self, service: YouTubeService) -> None:
        """생성된 태스크가 올바른 초기 상태를 갖는지 확인합니다."""
        task_id = service.create_task()
        task = service.get_task(task_id)
        assert task is not None
        assert task["status"] == "pending"
        assert task["progress"] == 0.0
        assert task["stage"] == "대기 중"
        assert task["filename"] is None
        assert task["error"] is None

    def test_create_multiple_tasks(self, service: YouTubeService) -> None:
        """여러 태스크를 독립적으로 생성할 수 있는지 확인합니다."""
        task_id_1 = service.create_task()
        task_id_2 = service.create_task()
        assert task_id_1 != task_id_2
        assert len(service.tasks) == 2


class TestValidateVideo:
    """동영상 검증 테스트."""

    @pytest.mark.asyncio
    async def test_validate_video_success(self, service: YouTubeService) -> None:
        """유효한 동영상 정보를 반환하는지 확인합니다."""
        mock_info = {
            "title": "Test Video",
            "duration": 300,  # 5분
            "uploader": "Test User",
        }
        with patch.object(
            YouTubeService,
            "_extract_info",
            return_value=mock_info,
        ):
            result = await service.validate_video("https://youtu.be/test123")
            assert result["title"] == "Test Video"
            assert result["duration"] == 300
            assert result["uploader"] == "Test User"

    @pytest.mark.asyncio
    async def test_validate_video_too_long(self, service: YouTubeService) -> None:
        """30분 초과 동영상이 거부되는지 확인합니다."""
        mock_info = {
            "title": "Long Video",
            "duration": 2000,  # 33분
            "uploader": "Test User",
        }
        with patch.object(
            YouTubeService,
            "_extract_info",
            return_value=mock_info,
        ):
            with pytest.raises(ValueError, match="동영상이 너무 깁니다"):
                await service.validate_video("https://youtu.be/test123")

    @pytest.mark.asyncio
    async def test_validate_video_at_limit(self, service: YouTubeService) -> None:
        """정확히 30분인 동영상이 허용되는지 확인합니다."""
        mock_info = {
            "title": "Exact Limit Video",
            "duration": 1800,  # 정확히 30분
            "uploader": "Test User",
        }
        with patch.object(
            YouTubeService,
            "_extract_info",
            return_value=mock_info,
        ):
            result = await service.validate_video("https://youtu.be/test123")
            assert result["duration"] == 1800

    @pytest.mark.asyncio
    async def test_validate_video_download_error(self, service: YouTubeService) -> None:
        """DownloadError가 ValueError로 변환되는지 확인합니다."""
        import yt_dlp

        with patch.object(
            YouTubeService,
            "_extract_info",
            side_effect=yt_dlp.utils.DownloadError("Not found"),
        ):
            with pytest.raises(ValueError, match="동영상 정보를 가져올 수 없습니다"):
                await service.validate_video("https://youtu.be/test123")

    @pytest.mark.asyncio
    async def test_validate_video_no_info(self, service: YouTubeService) -> None:
        """정보 추출 실패 시 ValueError가 발생하는지 확인합니다."""
        with patch.object(
            YouTubeService,
            "_extract_info",
            return_value=None,
        ):
            with pytest.raises(ValueError, match="동영상 정보를 가져올 수 없습니다"):
                await service.validate_video("https://youtu.be/test123")


class TestStartConversion:
    """변환 시작 테스트."""

    @pytest.mark.asyncio
    async def test_start_conversion_creates_task_directory(
        self,
        service: YouTubeService,
    ) -> None:
        """변환 시작 시 태스크 디렉터리가 생성되는지 확인합니다."""
        task_id = service.create_task()

        with patch.object(
            YouTubeService,
            "_download",
        ) as mock_download:
            # MP3 파일 생성 시뮬레이션
            def create_mp3(*args, **kwargs):
                task_dir = service.download_dir / task_id
                task_dir.mkdir(parents=True, exist_ok=True)
                mp3_file = task_dir / "test123.mp3"
                mp3_file.write_bytes(b"fake mp3 data")

            mock_download.side_effect = create_mp3

            await service.start_conversion("https://youtu.be/test123", task_id)

            task = service.get_task(task_id)
            assert task is not None
            assert task["status"] == "complete"
            assert task["progress"] == 100.0

    @pytest.mark.asyncio
    async def test_start_conversion_handles_download_error(
        self,
        service: YouTubeService,
    ) -> None:
        """다운로드 실패 시 에러 상태로 변경되는지 확인합니다."""
        import yt_dlp

        task_id = service.create_task()

        with patch.object(
            YouTubeService,
            "_download",
            side_effect=yt_dlp.utils.DownloadError("Network error"),
        ):
            await service.start_conversion("https://youtu.be/test123", task_id)

            task = service.get_task(task_id)
            assert task is not None
            assert task["status"] == "error"
            assert task["error"] == "download_failed"

    @pytest.mark.asyncio
    async def test_start_conversion_handles_timeout(
        self,
        service: YouTubeService,
    ) -> None:
        """타임아웃 시 에러 상태로 변경되는지 확인합니다."""
        task_id = service.create_task()

        async def slow_download(*args, **kwargs):
            await asyncio.sleep(500)

        with patch.object(
            YouTubeService,
            "_download",
            side_effect=lambda *a, **k: asyncio.sleep(500),
        ):
            # 타임아웃을 짧게 설정하여 테스트
            with patch("app.services.youtube_service.asyncio.wait_for") as mock_wait:
                mock_wait.side_effect = TimeoutError()
                await service.start_conversion("https://youtu.be/test123", task_id)

                task = service.get_task(task_id)
                assert task is not None
                assert task["status"] == "error"
                assert task["error"] == "timeout"

    @pytest.mark.asyncio
    async def test_start_conversion_handles_os_error(
        self,
        service: YouTubeService,
    ) -> None:
        """OS 에러 시 에러 상태로 변경되는지 확인합니다."""
        task_id = service.create_task()

        with patch.object(
            YouTubeService,
            "_download",
            side_effect=OSError("Disk full"),
        ):
            await service.start_conversion("https://youtu.be/test123", task_id)

            task = service.get_task(task_id)
            assert task is not None
            assert task["status"] == "error"
            assert task["error"] == "io_error"

    @pytest.mark.asyncio
    async def test_start_conversion_no_mp3_produced(
        self,
        service: YouTubeService,
    ) -> None:
        """MP3 파일이 생성되지 않으면 에러 상태로 변경되는지 확인합니다."""
        task_id = service.create_task()

        def create_empty_dir(*args, **kwargs):
            task_dir = service.download_dir / task_id
            task_dir.mkdir(parents=True, exist_ok=True)
            # MP3 파일 미생성

        with patch.object(
            YouTubeService,
            "_download",
            side_effect=create_empty_dir,
        ):
            await service.start_conversion("https://youtu.be/test123", task_id)

            task = service.get_task(task_id)
            assert task is not None
            assert task["status"] == "error"
            assert task["error"] == "conversion_failed"


class TestProgressUpdates:
    """진행 상태 업데이트 테스트."""

    def test_initial_progress_is_zero(self, service: YouTubeService) -> None:
        """초기 진행률이 0인지 확인합니다."""
        task_id = service.create_task()
        task = service.get_task(task_id)
        assert task is not None
        assert task["progress"] == 0.0

    def test_active_count_initially_zero(self, service: YouTubeService) -> None:
        """초기 활성 변환 수가 0인지 확인합니다."""
        assert service.active_count == 0


class TestConcurrentLimit:
    """동시 다운로드 제한 테스트."""

    @pytest.mark.asyncio
    async def test_semaphore_limits_concurrency(self, service: YouTubeService) -> None:
        """세마포어가 동시 다운로드 수를 제한하는지 확인합니다."""
        # 세마포어 카운트 확인 (max_concurrent_downloads)
        # Semaphore의 _value가 설정값과 일치하는지 확인
        assert service._semaphore._value == 5


class TestGetDownloadPath:
    """다운로드 경로 조회 테스트."""

    def test_get_download_path_no_task(self, service: YouTubeService) -> None:
        """존재하지 않는 태스크의 경로 조회가 None을 반환하는지 확인합니다."""
        result = service.get_download_path("nonexistent-id")
        assert result is None

    def test_get_download_path_no_filename(self, service: YouTubeService) -> None:
        """파일명이 없는 태스크의 경로 조회가 None을 반환하는지 확인합니다."""
        task_id = service.create_task()
        result = service.get_download_path(task_id)
        assert result is None

    def test_get_download_path_file_exists(
        self,
        service: YouTubeService,
        tmp_path: Path,
    ) -> None:
        """파일이 존재하면 경로를 반환하는지 확인합니다."""
        task_id = service.create_task()
        mp3_file = tmp_path / "test.mp3"
        mp3_file.write_bytes(b"fake mp3")
        service._tasks[task_id]["filename"] = str(mp3_file)

        result = service.get_download_path(task_id)
        assert result is not None
        assert result == mp3_file

    def test_get_download_path_file_not_exists(
        self,
        service: YouTubeService,
    ) -> None:
        """파일이 존재하지 않으면 None을 반환하는지 확인합니다."""
        task_id = service.create_task()
        service._tasks[task_id]["filename"] = "/nonexistent/path.mp3"

        result = service.get_download_path(task_id)
        assert result is None
