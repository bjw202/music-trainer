"""임시 파일 정리 서비스.

백그라운드에서 주기적으로 실행되어 만료된 파일과 태스크를 정리합니다.
"""

from __future__ import annotations

import asyncio
import logging
import shutil
import time
from pathlib import Path

logger = logging.getLogger(__name__)

# 파일 만료 시간 (1시간)
FILE_EXPIRY_SECONDS: int = 3600

# 디스크 사용량 제한 (10GB)
MAX_DISK_USAGE_BYTES: int = 10 * 1024 * 1024 * 1024

# 정리 주기 (10분)
CLEANUP_INTERVAL_SECONDS: int = 600


def cleanup_old_files(download_dir: Path) -> int:
    """만료된 파일을 정리합니다.

    Args:
        download_dir: 다운로드 디렉터리 경로.

    Returns:
        삭제된 디렉터리 수.
    """
    if not download_dir.exists():
        return 0

    now = time.time()
    deleted_count = 0

    for item in download_dir.iterdir():
        if not item.is_dir():
            continue

        try:
            # 디렉터리의 수정 시간 확인
            mtime = item.stat().st_mtime
            if now - mtime > FILE_EXPIRY_SECONDS:
                shutil.rmtree(item)
                deleted_count += 1
                logger.info("Cleaned up expired directory: %s", item.name)
        except OSError as e:
            logger.warning("Failed to clean up %s: %s", item.name, e)

    return deleted_count


def check_disk_usage(download_dir: Path) -> int:
    """디스크 사용량이 제한을 초과하면 강제 정리합니다.

    Args:
        download_dir: 다운로드 디렉터리 경로.

    Returns:
        강제 삭제된 디렉터리 수.
    """
    if not download_dir.exists():
        return 0

    # 현재 디스크 사용량 계산
    total_size = 0
    dirs_with_mtime: list[tuple[Path, float]] = []

    for item in download_dir.iterdir():
        if not item.is_dir():
            continue
        try:
            dir_size = sum(
                f.stat().st_size for f in item.rglob("*") if f.is_file()
            )
            total_size += dir_size
            dirs_with_mtime.append((item, item.stat().st_mtime))
        except OSError:
            continue

    if total_size <= MAX_DISK_USAGE_BYTES:
        return 0

    # 가장 오래된 디렉터리부터 삭제
    dirs_with_mtime.sort(key=lambda x: x[1])
    deleted_count = 0

    for dir_path, _ in dirs_with_mtime:
        if total_size <= MAX_DISK_USAGE_BYTES:
            break
        try:
            dir_size = sum(
                f.stat().st_size for f in dir_path.rglob("*") if f.is_file()
            )
            shutil.rmtree(dir_path)
            total_size -= dir_size
            deleted_count += 1
            logger.info("Force cleaned directory due to disk limit: %s", dir_path.name)
        except OSError as e:
            logger.warning("Failed to force clean %s: %s", dir_path.name, e)

    return deleted_count


def cleanup_expired_tasks(tasks: dict, expiry_seconds: int = FILE_EXPIRY_SECONDS) -> int:
    """완료/실패한 태스크를 인메모리 딕셔너리에서 제거합니다.

    Note:
        태스크 딕셔너리에 '_created_at' 키가 있어야 합니다.
        없는 경우 건너뜁니다.

    Args:
        tasks: 태스크 딕셔너리.
        expiry_seconds: 만료 시간 (초).

    Returns:
        제거된 태스크 수.
    """
    now = time.time()
    expired_ids: list[str] = []

    # 완료/실패 상태 (YouTubeService: complete/error, SeparationService: completed/failed)
    terminal_statuses = ("complete", "completed", "error", "failed")

    for task_id, task_data in tasks.items():
        # dict와 dataclass 모두 지원
        if isinstance(task_data, dict):
            status = task_data.get("status")
            created_at = task_data.get("_created_at", 0)
        else:
            status = getattr(task_data, "status", None)
            created_at = getattr(task_data, "_created_at", 0)

        if status not in terminal_statuses:
            continue
        if created_at and now - created_at > expiry_seconds:
            expired_ids.append(task_id)

    for task_id in expired_ids:
        tasks.pop(task_id, None)

    if expired_ids:
        logger.info("Removed %d expired tasks from memory", len(expired_ids))

    return len(expired_ids)


async def run_cleanup_loop(download_dir: Path, tasks: dict | None = None) -> None:
    """백그라운드 정리 루프를 실행합니다.

    10분마다 만료된 파일과 태스크를 정리합니다.

    Args:
        download_dir: 다운로드 디렉터리 경로.
        tasks: 태스크 딕셔너리 (선택사항).
    """
    while True:
        try:
            await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
            cleanup_old_files(download_dir)
            check_disk_usage(download_dir)
            if tasks is not None:
                cleanup_expired_tasks(tasks)
        except asyncio.CancelledError:
            logger.info("Cleanup loop cancelled")
            break
        except Exception:
            logger.exception("Error in cleanup loop")
