"""음원 분리 API 라우트.

오디오 파일을 4개 스템(vocals, drums, bass, other)으로 분리하는 API 엔드포인트를 제공합니다.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import zipfile
import io

from fastapi import APIRouter, HTTPException, Request, status, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sse_starlette.sse import EventSourceResponse

from app.models.schemas import (
    SeparationProgress,
    SeparationResponse,
)
from app.services.separation_service import separation_service, STEM_NAMES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/separate", tags=["separation"])

# 지원되는 오디오 형식
SUPPORTED_FORMATS = {"audio/mpeg", "audio/wav", "audio/x-wav", "audio/flac"}

# 최대 파일 크기 (500MB)
MAX_FILE_SIZE = 500 * 1024 * 1024


@router.post(
    "",
    response_model=SeparationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def separate_audio(
    request: Request,
    file: UploadFile,
) -> SeparationResponse:
    """오디오 파일을 4개 스템으로 분리합니다.

    1. 파일 형식 및 크기 검증
    2. 백그라운드 분리 시작

    Args:
        request: FastAPI 요청 객체.
        file: 업로드된 오디오 파일.

    Returns:
        202 응답과 태스크 ID.

    Raises:
        HTTPException: 파일 형식이 지원되지 않거나 크기 제한 초과 시(400).
    """
    # 파일 형식 검증
    content_type = file.content_type or ""
    if content_type not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 형식입니다. 지원 형식: MP3, WAV, FLAC",
        )

    # 파일 크기 검증 (실제 파일 읽기 전에 content-length 확인)
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"파일이 너무 큽니다. 최대 {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )

    # 태스크 생성
    task_id = separation_service.create_task()

    # 임시 파일 저장
    import tempfile
    import aiofiles

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}")
    temp_path = Path(temp_file.name)

    try:
        # 파일 저장
        async with aiofiles.open(temp_path, "wb") as f:
            while content := await file.read(8192):
                await f.write(content)

        # 파일 크기 확인
        file_size = temp_path.stat().st_size
        if file_size > MAX_FILE_SIZE:
            temp_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"파일이 너무 큽니다. 최대 {MAX_FILE_SIZE // (1024 * 1024)}MB",
            )

        # 백그라운드 분리 시작
        asyncio.create_task(_run_separation(str(temp_path), task_id))

    except Exception as e:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"파일 처리 중 오류가 발생했습니다: {e!s}",
        ) from e

    return SeparationResponse(
        task_id=task_id,
        status="processing",
        message="분리를 시작합니다",
    )


async def _run_separation(file_path: str, task_id: str) -> None:
    """백그라운드에서 분리를 실행합니다.

    Args:
        file_path: 입력 파일 경로.
        task_id: 태스크 ID.
    """
    import tempfile

    try:
        await separation_service.separate(file_path, task_id)
    except FileNotFoundError as e:
        logger.error("File not found for task %s: %s", task_id, e)
        separation_service._update_progress(
            task_id, -1.0, "failed", str(e)
        )
    except Exception as e:
        logger.exception("Separation failed for task %s: %s", task_id, e)
        separation_service._update_progress(
            task_id, -1.0, "failed", str(e)
        )
    finally:
        # 임시 파일 삭제
        Path(file_path).unlink(missing_ok=True)


@router.get("/{task_id}/progress")
async def get_progress(task_id: str) -> EventSourceResponse:
    """분리 진행 상태를 SSE 스트리밍으로 전송합니다.

    Args:
        task_id: 태스크 ID.

    Returns:
        SSE 이벤트 스트림.
    """

    async def event_generator():
        """SSE 이벤트를 생성합니다."""
        while True:
            task = separation_service.get_task(task_id)

            if task is None:
                event = SeparationProgress(
                    progress=-1.0,
                    status="failed",
                    error="태스크를 찾을 수 없습니다.",
                )
                yield {"data": event.model_dump_json()}
                return

            task_status = task.status

            if task_status == "completed":
                stems_list = list(task.stems.keys()) if task.stems else []
                event = SeparationProgress(
                    progress=100.0,
                    status="completed",
                    stems=stems_list,
                )
                yield {"data": event.model_dump_json()}
                return

            if task_status == "failed":
                event = SeparationProgress(
                    progress=-1.0,
                    status="failed",
                    error=task.error or "분리에 실패했습니다.",
                )
                yield {"data": event.model_dump_json()}
                return

            # 진행 중
            event = SeparationProgress(
                progress=task.progress,
                status=task_status,
            )
            yield {"data": event.model_dump_json()}

            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())


@router.get("/{task_id}/stems/{stem_name}")
async def download_stem(
    task_id: str,
    stem_name: str,
) -> FileResponse:
    """분리된 스템 파일을 다운로드합니다.

    Args:
        task_id: 태스크 ID.
        stem_name: 스템 이름 (vocals, drums, bass, other).

    Returns:
        WAV 파일 응답.

    Raises:
        HTTPException: 스템 이름이 유효하지 않을 때(400), 파일을 찾을 수 없을 때(404).
    """
    # 스템 이름 검증
    if stem_name not in STEM_NAMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"잘못된 스템 이름입니다. 지원되는 스템: {', '.join(STEM_NAMES)}",
        )

    # 태스크 조회
    task = separation_service.get_task(task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="태스크를 찾을 수 없습니다.",
        )

    # 스템 파일 경로 조회
    if task.stems is None or stem_name not in task.stems:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="스템 파일을 찾을 수 없습니다.",
        )

    stem_path = task.stems[stem_name]
    if not stem_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="스템 파일이 존재하지 않습니다.",
        )

    return FileResponse(
        path=str(stem_path),
        media_type="audio/wav",
        filename=f"{stem_name}.wav",
        headers={
            "Content-Disposition": f'attachment; filename="{stem_name}.wav"',
        },
    )


@router.get("/{task_id}/stems")
async def download_all_stems(task_id: str) -> StreamingResponse:
    """분리된 모든 스템 파일을 ZIP으로 다운로드합니다.

    Args:
        task_id: 태스크 ID.

    Returns:
        ZIP 파일 응답 (4개 스템 WAV 파일 포함).

    Raises:
        HTTPException: 태스크를 찾을 수 없거나 스템 파일이 없을 때(404).
    """
    # 태스크 조회
    task = separation_service.get_task(task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="태스크를 찾을 수 없습니다.",
        )

    # 스템 파일 확인
    if task.stems is None or len(task.stems) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="스템 파일을 찾을 수 없습니다.",
        )

    # ZIP 파일 생성
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for stem_name, stem_path in task.stems.items():
            if stem_path.exists():
                zip_file.write(stem_path, f"{stem_name}.wav")

    zip_buffer.seek(0)

    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="stems_{task_id}.zip"',
        },
    )
