"""헬스 체크 엔드포인트 테스트."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_returns_200(async_client: AsyncClient) -> None:
    """헬스 체크 엔드포인트가 200을 반환하는지 확인합니다."""
    response = await async_client.get("/api/v1/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "ffmpeg_available" in data
    assert "disk_space_mb" in data
    assert "active_conversions" in data


@pytest.mark.asyncio
async def test_health_check_all_fields_present(async_client: AsyncClient) -> None:
    """헬스 체크 응답에 모든 필수 필드가 있는지 확인합니다."""
    response = await async_client.get("/api/v1/health")

    data = response.json()
    required_fields = {"status", "ffmpeg_available", "disk_space_mb", "active_conversions"}
    assert required_fields.issubset(set(data.keys()))


@pytest.mark.asyncio
async def test_health_check_ffmpeg_available(async_client: AsyncClient) -> None:
    """ffmpeg가 설치된 환경에서 ffmpeg_available이 True인지 확인합니다."""
    with patch(
        "app.routes.health.check_ffmpeg_available",
        return_value=True,
    ):
        response = await async_client.get("/api/v1/health")
        data = response.json()
        assert data["ffmpeg_available"] is True


@pytest.mark.asyncio
async def test_health_check_ffmpeg_not_available(async_client: AsyncClient) -> None:
    """ffmpeg가 없는 환경에서 ffmpeg_available이 False인지 확인합니다."""
    with patch(
        "app.routes.health.check_ffmpeg_available",
        return_value=False,
    ):
        response = await async_client.get("/api/v1/health")
        data = response.json()
        assert data["ffmpeg_available"] is False


@pytest.mark.asyncio
async def test_health_check_active_conversions_zero(async_client: AsyncClient) -> None:
    """초기 상태에서 active_conversions가 0인지 확인합니다."""
    response = await async_client.get("/api/v1/health")
    data = response.json()
    assert data["active_conversions"] == 0


@pytest.mark.asyncio
async def test_health_check_disk_space_positive(async_client: AsyncClient) -> None:
    """디스크 공간이 양수인지 확인합니다."""
    response = await async_client.get("/api/v1/health")
    data = response.json()
    assert data["disk_space_mb"] >= 0
