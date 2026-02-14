"""Pydantic 요청/응답 스키마 모듈.

API 엔드포인트에서 사용되는 모든 요청/응답 모델을 정의합니다.
"""

from __future__ import annotations

from pydantic import BaseModel, field_validator

from app.utils.validators import validate_youtube_url


class ConvertRequest(BaseModel):
    """YouTube 변환 요청 모델."""

    url: str

    @field_validator("url")
    @classmethod
    def url_must_be_valid_youtube(cls, v: str) -> str:
        """URL이 유효한 YouTube URL인지 검증합니다."""
        if not v or not v.strip():
            msg = "URL을 입력해주세요."
            raise ValueError(msg)
        v = v.strip()
        if not validate_youtube_url(v):
            msg = "유효한 YouTube URL이 아닙니다."
            raise ValueError(msg)
        return v


class ConvertResponse(BaseModel):
    """YouTube 변환 응답 모델."""

    task_id: str
    status: str
    message: str


class ProgressEvent(BaseModel):
    """진행 상태 이벤트 모델 (SSE 스트리밍용)."""

    status: str
    percent: float
    stage: str
    estimated_remaining: int | None = None
    download_url: str | None = None
    error_type: str | None = None
    message: str | None = None


class HealthResponse(BaseModel):
    """헬스 체크 응답 모델."""

    status: str
    ffmpeg_available: bool
    disk_space_mb: float
    active_conversions: int


class ErrorResponse(BaseModel):
    """에러 응답 모델."""

    detail: str
    error_type: str | None = None
