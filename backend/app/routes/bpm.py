"""BPM 분석 API 라우트.

오디오 파일의 BPM과 비트 타임스탬프를 분석하는 API 엔드포인트를 제공합니다.
"""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path

import aiofiles
from fastapi import APIRouter, HTTPException, Request, UploadFile, status

from app.models.schemas import BpmAnalysisResponse
from app.services.bpm_service import bpm_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bpm", tags=["bpm"])

# 지원되는 오디오 형식
SUPPORTED_FORMATS = {"audio/mpeg", "audio/wav", "audio/x-wav", "audio/flac"}

# 최대 파일 크기 (100MB - BPM 분석은 스템 분리보다 작은 파일도 가능)
MAX_FILE_SIZE = 100 * 1024 * 1024


@router.post("/analyze", response_model=BpmAnalysisResponse, status_code=status.HTTP_200_OK)
async def analyze_bpm(
    request: Request,
    file: UploadFile,
) -> BpmAnalysisResponse:
    """오디오 파일의 BPM과 비트 타임스탬프를 분석합니다.

    동기식 API: madmom BPM 분석은 3-8초 소요되어
    단순 요청/응답으로 충분합니다.

    Args:
        request: FastAPI 요청 객체.
        file: 업로드된 오디오 파일.

    Returns:
        200 응답과 BPM 분석 결과.

    Raises:
        HTTPException: 파일 형식이 지원되지 않을 때(400),
                      파일 크기 초과 시(413),
                      분석 실패 시(500).
    """
    # 파일 형식 검증
    content_type = file.content_type or ""
    if content_type not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 형식입니다. 지원 형식: MP3, WAV, FLAC",
        )

    # 파일 크기 검증 (content-length 확인)
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"파일이 너무 큽니다. 최대 {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )

    # 임시 파일 저장
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
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"파일이 너무 큽니다. 최대 {MAX_FILE_SIZE // (1024 * 1024)}MB",
            )

        # BPM 분석 (동기 실행 - 충분히 빠름)
        import asyncio

        result = await asyncio.to_thread(bpm_service.analyze, str(temp_path))

        return BpmAnalysisResponse(
            bpm=result.bpm,
            beats=result.beats,
            confidence=result.confidence,
            file_hash=result.file_hash,
        )

    except HTTPException:
        raise

    except FileNotFoundError as e:
        logger.error("File not found: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"파일을 찾을 수 없습니다: {e}",
        ) from e

    except RuntimeError as e:
        logger.error("BPM analysis failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BPM 분석 실패: {e}",
        ) from e

    except Exception as e:
        logger.exception("Unexpected error during BPM analysis: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"처리 중 오류가 발생했습니다: {e}",
        ) from e

    finally:
        # 임시 파일 삭제
        temp_path.unlink(missing_ok=True)
