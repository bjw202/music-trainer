"""YouTube API 엔드포인트 테스트."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient


class TestConvertEndpoint:
    """POST /api/v1/youtube/convert 테스트."""

    @pytest.mark.asyncio
    async def test_convert_valid_url_returns_202(
        self,
        async_client: AsyncClient,
    ) -> None:
        """유효한 URL로 변환 요청 시 202를 반환합니다."""
        mock_info = {
            "title": "Test Video",
            "duration": 300,
            "uploader": "Test User",
        }
        with patch(
            "app.services.youtube_service.YouTubeService._extract_info",
            return_value=mock_info,
        ):
            with patch(
                "app.services.youtube_service.YouTubeService._download",
            ):
                response = await async_client.post(
                    "/api/v1/youtube/convert",
                    json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                )

                assert response.status_code == 202
                data = response.json()
                assert "task_id" in data
                assert data["status"] == "processing"
                assert data["message"] == "변환을 시작합니다"

    @pytest.mark.asyncio
    async def test_convert_invalid_url_returns_422(
        self,
        async_client: AsyncClient,
    ) -> None:
        """유효하지 않은 URL로 변환 요청 시 422를 반환합니다."""
        response = await async_client.post(
            "/api/v1/youtube/convert",
            json={"url": "https://www.google.com"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_convert_empty_url_returns_422(
        self,
        async_client: AsyncClient,
    ) -> None:
        """빈 URL로 변환 요청 시 422를 반환합니다."""
        response = await async_client.post(
            "/api/v1/youtube/convert",
            json={"url": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_convert_missing_url_returns_422(
        self,
        async_client: AsyncClient,
    ) -> None:
        """URL 필드가 없는 요청 시 422를 반환합니다."""
        response = await async_client.post(
            "/api/v1/youtube/convert",
            json={},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_convert_too_long_video_returns_400(
        self,
        async_client: AsyncClient,
    ) -> None:
        """30분 초과 동영상 URL로 요청 시 400을 반환합니다."""
        mock_info = {
            "title": "Very Long Video",
            "duration": 3600,  # 1시간
            "uploader": "Test User",
        }
        with patch(
            "app.services.youtube_service.YouTubeService._extract_info",
            return_value=mock_info,
        ):
            response = await async_client.post(
                "/api/v1/youtube/convert",
                json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            )
            assert response.status_code == 400
            assert "동영상이 너무 깁니다" in response.json()["detail"]


class TestRateLimiting:
    """요율 제한 테스트."""

    @pytest.mark.asyncio
    async def test_rate_limit_exceeded_returns_429(
        self,
        async_client: AsyncClient,
    ) -> None:
        """요율 제한 초과 시 429를 반환합니다."""
        mock_info = {
            "title": "Test Video",
            "duration": 300,
            "uploader": "Test User",
        }

        with patch(
            "app.services.youtube_service.YouTubeService._extract_info",
            return_value=mock_info,
        ):
            with patch(
                "app.services.youtube_service.YouTubeService._download",
            ):
                # 10번 요청 (제한 이내)
                for _ in range(10):
                    await async_client.post(
                        "/api/v1/youtube/convert",
                        json={
                            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                        },
                    )

                # 11번째 요청은 429를 반환해야 함
                response = await async_client.post(
                    "/api/v1/youtube/convert",
                    json={
                        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    },
                )
                assert response.status_code == 429


class TestProgressEndpoint:
    """GET /api/v1/youtube/progress/{task_id} 테스트."""

    @pytest.mark.asyncio
    async def test_progress_unknown_task_returns_error_event(
        self,
        async_client: AsyncClient,
    ) -> None:
        """존재하지 않는 태스크의 진행 상태 조회 시 에러 이벤트를 반환합니다."""
        response = await async_client.get(
            "/api/v1/youtube/progress/nonexistent-task-id",
            headers={"Accept": "text/event-stream"},
        )
        assert response.status_code == 200
        # SSE 응답에서 에러 이벤트 확인
        body = response.text
        assert "not_found" in body

    @pytest.mark.asyncio
    async def test_progress_complete_task(
        self,
        async_client: AsyncClient,
    ) -> None:
        """완료된 태스크의 진행 상태가 올바르게 반환되는지 확인합니다."""
        from app.services.youtube_service import youtube_service

        task_id = youtube_service.create_task()
        youtube_service._tasks[task_id]["status"] = "complete"
        youtube_service._tasks[task_id]["progress"] = 100.0

        response = await async_client.get(
            f"/api/v1/youtube/progress/{task_id}",
            headers={"Accept": "text/event-stream"},
        )
        assert response.status_code == 200
        body = response.text
        assert "complete" in body
        assert "download" in body


class TestDownloadEndpoint:
    """GET /api/v1/youtube/download/{task_id} 테스트."""

    @pytest.mark.asyncio
    async def test_download_nonexistent_task_returns_404(
        self,
        async_client: AsyncClient,
    ) -> None:
        """존재하지 않는 태스크의 다운로드 요청 시 404를 반환합니다."""
        response = await async_client.get(
            "/api/v1/youtube/download/nonexistent-task-id",
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_download_no_file_returns_404(
        self,
        async_client: AsyncClient,
    ) -> None:
        """파일이 없는 태스크의 다운로드 요청 시 404를 반환합니다."""
        from app.services.youtube_service import youtube_service

        task_id = youtube_service.create_task()
        youtube_service._tasks[task_id]["status"] = "complete"
        # filename 설정 안 함

        response = await async_client.get(
            f"/api/v1/youtube/download/{task_id}",
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_download_existing_file_returns_mp3(
        self,
        async_client: AsyncClient,
        tmp_path: Path,
    ) -> None:
        """파일이 존재하면 MP3 파일을 반환합니다."""
        from app.services.youtube_service import youtube_service

        # MP3 파일 생성
        task_id = youtube_service.create_task()
        task_dir = youtube_service.download_dir / task_id
        task_dir.mkdir(parents=True, exist_ok=True)
        mp3_file = task_dir / "test.mp3"
        mp3_file.write_bytes(b"fake mp3 content" * 100)

        youtube_service._tasks[task_id]["status"] = "complete"
        youtube_service._tasks[task_id]["filename"] = str(mp3_file)
        youtube_service._tasks[task_id]["title"] = "Test Song"

        response = await async_client.get(
            f"/api/v1/youtube/download/{task_id}",
        )
        assert response.status_code == 200
        assert "audio/mpeg" in response.headers.get("content-type", "")
        assert "attachment" in response.headers.get("content-disposition", "")
