"""분리 서비스 Pydantic 스키마 테스트."""

from __future__ import annotations

import pytest

from app.models.schemas import (
    SeparationRequest,
    SeparationResponse,
    SeparationProgress,
    StemInfo,
)


class TestSeparationRequest:
    """SeparationRequest 스키마 테스트."""

    def test_default_model_is_htdemucs(self) -> None:
        """기본 모델이 htdemucs인지 확인합니다."""
        request = SeparationRequest()
        assert request.model == "htdemucs"

    def test_custom_model(self) -> None:
        """사용자 정의 모델을 설정할 수 있는지 확인합니다."""
        request = SeparationRequest(model="htdemucs_ft")
        assert request.model == "htdemucs_ft"


class TestSeparationResponse:
    """SeparationResponse 스키마 테스트."""

    def test_separation_response_fields(self) -> None:
        """필수 필드가 존재하는지 확인합니다."""
        response = SeparationResponse(
            task_id="test-uuid-123",
            status="processing",
            message="분리를 시작합니다",
        )
        assert response.task_id == "test-uuid-123"
        assert response.status == "processing"
        assert response.message == "분리를 시작합니다"


class TestSeparationProgress:
    """SeparationProgress 스키마 테스트."""

    def test_progress_fields(self) -> None:
        """진행률 필드가 올바르게 설정되는지 확인합니다."""
        progress = SeparationProgress(
            progress=50.0,
            status="separating",
            stems=None,
        )
        assert progress.progress == 50.0
        assert progress.status == "separating"
        assert progress.stems is None

    def test_completed_progress_with_stems(self) -> None:
        """완료 상태에서 스템 목록이 포함되는지 확인합니다."""
        progress = SeparationProgress(
            progress=100.0,
            status="completed",
            stems=["vocals", "drums", "bass", "other"],
        )
        assert progress.progress == 100.0
        assert progress.status == "completed"
        assert progress.stems == ["vocals", "drums", "bass", "other"]

    def test_error_progress(self) -> None:
        """에러 상태 진행률을 확인합니다."""
        progress = SeparationProgress(
            progress=-1,
            status="failed",
            error="Out of memory",
        )
        assert progress.progress == -1
        assert progress.status == "failed"
        assert progress.error == "Out of memory"


class TestStemInfo:
    """StemInfo 스키마 테스트."""

    def test_stem_info_fields(self) -> None:
        """스템 정보 필드가 올바르게 설정되는지 확인합니다."""
        stem = StemInfo(
            name="vocals",
            url="/api/v1/separate/task-123/stems/vocals",
        )
        assert stem.name == "vocals"
        assert stem.url == "/api/v1/separate/task-123/stems/vocals"

    def test_stem_info_with_size(self) -> None:
        """파일 크기가 포함된 스템 정보를 확인합니다."""
        stem = StemInfo(
            name="drums",
            url="/api/v1/separate/task-123/stems/drums",
            size_bytes=1024000,
        )
        assert stem.size_bytes == 1024000
