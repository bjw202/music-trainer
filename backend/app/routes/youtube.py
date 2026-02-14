"""YouTube 변환 API 라우트.

YouTube URL을 MP3로 변환하는 API 엔드포인트를 제공합니다.
"""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

from app.config import get_settings
from app.models.schemas import ConvertRequest, ConvertResponse, ProgressEvent
from app.services.youtube_service import youtube_service
from app.utils.rate_limiter import rate_limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/youtube", tags=["youtube"])


def _get_client_ip(request: Request) -> str:
    """클라이언트 IP 주소를 가져옵니다."""
    # X-Forwarded-For 헤더 확인 (프록시 뒤에 있을 경우)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    # 직접 연결인 경우
    if request.client:
        return request.client.host
    return "unknown"


@router.post(
    "/convert",
    response_model=ConvertResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def convert_youtube(
    request: Request,
    body: ConvertRequest,
) -> ConvertResponse:
    """YouTube URL을 MP3로 변환합니다.

    1. 요율 제한 확인
    2. 동영상 메타데이터 검증 (길이 제한)
    3. 백그라운드 변환 시작

    Args:
        request: FastAPI 요청 객체.
        body: 변환 요청 본문.

    Returns:
        202 응답과 태스크 ID.

    Raises:
        HTTPException: 요율 제한 초과(429), 잘못된 URL(422), 영상 길이 초과(400).
    """
    settings = get_settings()

    # 요율 제한 확인
    client_ip = _get_client_ip(request)
    rate_limiter.check_rate_limit(client_ip)

    # 동영상 메타데이터 검증
    try:
        await youtube_service.validate_video(body.url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    # 태스크 생성 및 백그라운드 변환 시작
    task_id = youtube_service.create_task()
    asyncio.create_task(youtube_service.start_conversion(body.url, task_id))

    return ConvertResponse(
        task_id=task_id,
        status="processing",
        message="변환을 시작합니다",
    )


@router.get("/progress/{task_id}")
async def get_progress(task_id: str) -> EventSourceResponse:
    """변환 진행 상태를 SSE 스트리밍으로 전송합니다.

    Args:
        task_id: 태스크 ID.

    Returns:
        SSE 이벤트 스트림.
    """

    async def event_generator():
        """SSE 이벤트를 생성합니다."""
        while True:
            task = youtube_service.get_task(task_id)

            if task is None:
                # 태스크를 찾을 수 없음
                event = ProgressEvent(
                    status="error",
                    percent=0.0,
                    stage="오류",
                    error_type="not_found",
                    message="태스크를 찾을 수 없습니다.",
                )
                yield {"data": event.model_dump_json()}
                return

            task_status = task.get("status", "pending")

            if task_status == "complete":
                event = ProgressEvent(
                    status="complete",
                    percent=100.0,
                    stage="완료",
                    download_url=f"/api/v1/youtube/download/{task_id}",
                )
                yield {"data": event.model_dump_json()}
                return

            if task_status == "error":
                error_type = task.get("error", "unknown_error")
                event = ProgressEvent(
                    status="error",
                    percent=task.get("progress", 0.0),
                    stage=task.get("stage", "오류"),
                    error_type=error_type,
                    message=_get_error_message(error_type),
                )
                yield {"data": event.model_dump_json()}
                return

            # 진행 중
            event = ProgressEvent(
                status=task_status,
                percent=task.get("progress", 0.0),
                stage=task.get("stage", "처리 중"),
                estimated_remaining=task.get("estimated_remaining"),
            )
            yield {"data": event.model_dump_json()}

            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())


@router.get("/download/{task_id}")
async def download_file(task_id: str) -> FileResponse:
    """변환된 MP3 파일을 다운로드합니다.

    Args:
        task_id: 태스크 ID.

    Returns:
        MP3 파일 응답.

    Raises:
        HTTPException: 파일을 찾을 수 없을 때(404).
    """
    filepath = youtube_service.get_download_path(task_id)
    if filepath is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="파일을 찾을 수 없거나 만료되었습니다.",
        )

    task = youtube_service.get_task(task_id)
    title = task.get("title", "audio") if task else "audio"
    safe_title = "".join(c for c in title if c.isalnum() or c in (" ", "-", "_")).strip()
    if not safe_title:
        safe_title = "audio"

    return FileResponse(
        path=str(filepath),
        media_type="audio/mpeg",
        filename=f"{safe_title}.mp3",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_title}.mp3"',
        },
    )


def _get_error_message(error_type: str) -> str:
    """에러 타입에 따른 사용자 친화적 메시지를 반환합니다."""
    messages = {
        "download_failed": "동영상을 다운로드할 수 없습니다.",
        "conversion_failed": "오디오 변환에 실패했습니다.",
        "timeout": "변환 시간이 초과되었습니다.",
        "io_error": "파일 처리 중 오류가 발생했습니다.",
        "not_found": "태스크를 찾을 수 없습니다.",
    }
    return messages.get(error_type, "알 수 없는 오류가 발생했습니다.")
