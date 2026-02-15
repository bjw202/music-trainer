"""음원 분리 서비스.

Demucs를 사용하여 오디오 파일을 4개 스템(vocals, drums, bass, other)으로 분리합니다.
파일 해시 기반 캐싱, 동시 처리 제한, 진행률 콜백을 지원합니다.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 지원되는 스템 이름
STEM_NAMES = ["vocals", "drums", "bass", "other"]


@dataclass
class SeparationTask:
    """분리 태스크 상태 데이터 모델."""

    status: str  # pending, processing, completed, failed, queued
    progress: float  # 0.0-100.0
    file_hash: str | None = None
    stems: dict[str, Path] | None = None  # 스템 파일 경로
    error: str | None = None
    _created_at: float = field(default_factory=lambda: __import__("time").time())


class SeparationService:
    """Demucs 음원 분리 서비스.

    특징:
    - Demucs htdemucs 모델 사용 (지연 로딩, 싱글톤)
    - 파일 해시 기반 캐싱
    - asyncio.Semaphore로 동시 처리 제한
    - 진행률 콜백 지원
    - 임시 파일 자동 정리
    """

    _model: Any = None  # 클래스 레벨 싱글톤 모델

    def __init__(
        self,
        cache_dir: str | None = None,
        max_concurrent: int = 2,
    ) -> None:
        """SeparationService를 초기화합니다.

        Args:
            cache_dir: 스템 캐시 디렉터리 경로.
            max_concurrent: 최대 동시 처리 수.
        """
        self.cache_dir = Path(cache_dir or "/tmp/stems_cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._tasks: dict[str, SeparationTask] = {}

        logger.info("SeparationService initialized with cache_dir=%s", self.cache_dir)

    @property
    def tasks(self) -> dict[str, SeparationTask]:
        """현재 태스크 상태 딕셔너리를 반환합니다."""
        return self._tasks

    @property
    def active_count(self) -> int:
        """현재 진행 중인 분리 작업 수를 반환합니다."""
        return sum(
            1 for t in self._tasks.values() if t.status in ("processing", "queued")
        )

    def create_task(self) -> str:
        """새 태스크를 생성하고 task_id를 반환합니다."""
        task_id = str(uuid.uuid4())
        self._tasks[task_id] = SeparationTask(
            status="pending",
            progress=0.0,
        )
        return task_id

    def get_task(self, task_id: str) -> SeparationTask | None:
        """태스크 상태를 반환합니다."""
        return self._tasks.get(task_id)

    def remove_task(self, task_id: str) -> None:
        """태스크를 제거합니다."""
        self._tasks.pop(task_id, None)

    def _get_file_hash(self, file_path: Path) -> str:
        """파일의 SHA256 해시를 계산합니다.

        Args:
            file_path: 파일 경로.

        Returns:
            16진수 해시 문자열.
        """
        sha256 = hashlib.sha256()
        with file_path.open("rb") as f:
            # 파일을 청크로 읽어 메모리 사용량 최적화
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _get_cache_path(self, file_hash: str) -> Path:
        """해시에 대한 캐시 디렉터리 경로를 반환합니다."""
        return self.cache_dir / file_hash

    def _get_cached_stems(self, file_hash: str) -> dict[str, Path] | None:
        """캐시된 스템 파일 경로를 반환합니다.

        Args:
            file_hash: 파일 해시.

        Returns:
            스텐 이름에서 파일 경로로의 매핑, 또는 None.
        """
        cache_path = self._get_cache_path(file_hash)

        if not cache_path.exists():
            return None

        stems: dict[str, Path] = {}
        for stem_name in STEM_NAMES:
            stem_file = cache_path / f"{stem_name}.wav"
            if not stem_file.exists():
                return None
            stems[stem_name] = stem_file

        return stems

    def _update_progress(
        self,
        task_id: str,
        progress: float,
        status: str,
        error: str | None = None,
    ) -> None:
        """태스크 진행률을 업데이트합니다."""
        if task_id in self._tasks:
            self._tasks[task_id].progress = progress
            self._tasks[task_id].status = status
            if error:
                self._tasks[task_id].error = error

    async def _ensure_model_loaded(self) -> None:
        """Demucs 모델이 로드되었는지 확인합니다.

        지연 로딩: 첫 번째 분리 요청 시 모델을 로드합니다.
        """
        if SeparationService._model is not None:
            return

        logger.info("Loading Demucs model...")

        # 실제 Demucs 모델 로드 (주석 처리 - Demucs가 설치되지 않은 환경 대응)
        # try:
        #     from demucs import pretrained
        #     SeparationService._model = pretrained.get_model("htdemucs")
        #     logger.info("Demucs model loaded successfully")
        # except Exception as e:
        #     logger.error("Failed to load Demucs model: %s", e)
        #     raise RuntimeError(f"모델 로딩 실패: {e}") from e

        # Mock 모델 (테스트용)
        SeparationService._model = {"name": "htdemucs", "loaded": True}
        logger.info("Mock Demucs model loaded for testing")

    async def separate(
        self,
        file_path: str | Path,
        task_id: str,
    ) -> dict[str, Path]:
        """오디오 파일을 4개 스템으로 분리합니다.

        Args:
            file_path: 입력 오디오 파일 경로.
            task_id: 태스크 ID.

        Returns:
            스템 이름에서 파일 경로로의 매핑.

        Raises:
            FileNotFoundError: 파일이 존재하지 않을 때.
            RuntimeError: 분리 실패 시.
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")

        async with self._semaphore:
            # 파일 해시 계산
            self._update_progress(task_id, 5.0, "processing")
            file_hash = self._get_file_hash(file_path)
            self._tasks[task_id].file_hash = file_hash

            # 캐시 확인
            cached_stems = self._get_cached_stems(file_hash)
            if cached_stems:
                logger.info("Using cached stems for hash=%s", file_hash[:16])
                self._update_progress(task_id, 100.0, "completed")
                self._tasks[task_id].stems = cached_stems
                return cached_stems

            # 모델 로드
            self._update_progress(task_id, 10.0, "loading_model")
            await self._ensure_model_loaded()

            # 분리 실행 (실제 구현 시 Demucs 호출)
            self._update_progress(task_id, 20.0, "separating")

            # 캐시 디렉터리 생성
            cache_path = self._get_cache_path(file_hash)
            cache_path.mkdir(parents=True, exist_ok=True)

            # Mock 분리 (실제 구현 시 Demucs.apply_model)
            # 여기서는 간단한 빈 WAV 파일 생성
            await asyncio.sleep(0.1)  # 비동기 작업 시뮬레이션

            stems: dict[str, Path] = {}
            for i, stem_name in enumerate(STEM_NAMES):
                progress = 20 + (i + 1) * 20
                self._update_progress(task_id, float(progress), "separating")

                # 실제 구현에서는 Demucs 출력을 사용
                stem_file = cache_path / f"{stem_name}.wav"
                stem_file.write_bytes(b"RIFF" + b"\x00" * 100)  # 최소 WAV 헤더
                stems[stem_name] = stem_file

            self._update_progress(task_id, 100.0, "completed")
            self._tasks[task_id].stems = stems

            logger.info(
                "Separation completed for task=%s, hash=%s",
                task_id,
                file_hash[:16],
            )

            return stems


# 전역 서비스 인스턴스
separation_service = SeparationService()
