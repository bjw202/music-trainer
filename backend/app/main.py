"""Guitar MP3 Trainer API 메인 애플리케이션.

FastAPI 앱 설정, 미들웨어, 라우터 등록, 시작/종료 이벤트를 정의합니다.
"""

from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import bpm, health, separation, youtube
from app.services.cleanup_service import run_cleanup_loop
from app.services.separation_service import separation_service
from app.services.youtube_service import youtube_service

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def _cleanup_expired_separation_tasks(download_path: Path) -> None:
    """만료된 분리 태스크를 정리합니다.

    Args:
        download_path: 다운로드 디렉터리 경로 (cleanup_service와 호환성).
    """
    from app.services.cleanup_service import cleanup_expired_tasks, FILE_EXPIRY_SECONDS

    while True:
        try:
            await asyncio.sleep(600)  # 10분마다 실행
            cleanup_expired_tasks(
                separation_service.tasks,
                expiry_seconds=FILE_EXPIRY_SECONDS,
            )
        except asyncio.CancelledError:
            logger.info("Separation task cleanup cancelled")
            break
        except Exception:
            logger.exception("Error in separation task cleanup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 시작/종료 이벤트를 관리합니다."""
    settings = get_settings()

    # 시작: 다운로드 디렉터리 생성
    download_path = Path(settings.download_dir)
    download_path.mkdir(parents=True, exist_ok=True)
    logger.info("Download directory: %s", download_path)

    # 스템 캐시 디렉터리 생성
    stems_cache_path = Path(separation_service.cache_dir)
    stems_cache_path.mkdir(parents=True, exist_ok=True)
    logger.info("Stems cache directory: %s", stems_cache_path)

    # 백그라운드 정리 태스크 시작 (다운로드 + 스템 캐시 정리)
    cleanup_task = asyncio.create_task(
        run_cleanup_loop(download_path, youtube_service.tasks)
    )
    logger.info("Cleanup background task started")

    # 스템 분리 태스크도 정리에 포함
    asyncio.create_task(
        _cleanup_expired_separation_tasks(download_path)
    )
    logger.info("Separation task cleanup started")

    yield

    # 종료: 정리 태스크 취소
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info("Application shutdown complete")


def create_app() -> FastAPI:
    """FastAPI 애플리케이션을 생성합니다."""
    settings = get_settings()

    app = FastAPI(
        title="Guitar MP3 Trainer API",
        version="1.0.0",
        description="YouTube 동영상을 MP3로 변환하는 API",
        lifespan=lifespan,
    )

    # CORS 미들웨어
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 요청/응답 로깅 미들웨어
    @app.middleware("http")
    async def log_requests(request: Request, call_next) -> Response:
        """모든 HTTP 요청과 응답을 로깅합니다."""
        start_time = time.time()

        response = await call_next(request)

        duration = time.time() - start_time
        logger.info(
            "%s %s -> %d (%.3fs)",
            request.method,
            request.url.path,
            response.status_code,
            duration,
        )

        return response

    # 라우터 등록
    app.include_router(health.router, prefix="/api/v1")
    app.include_router(youtube.router, prefix="/api/v1")
    app.include_router(separation.router, prefix="/api/v1")
    app.include_router(bpm.router, prefix="/api/v1")

    return app


app = create_app()
