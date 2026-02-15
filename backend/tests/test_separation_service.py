"""음원 분리 서비스 테스트."""

from __future__ import annotations

import asyncio
import hashlib
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from app.services.separation_service import SeparationService, SeparationTask


@pytest.fixture
def stems_cache_dir(tmp_path: Path) -> Path:
    """테스트용 스템 캐시 디렉터리를 생성합니다."""
    cache_dir = tmp_path / "stems_cache"
    cache_dir.mkdir()
    return cache_dir


@pytest.fixture
def service(stems_cache_dir: Path) -> SeparationService:
    """테스트용 SeparationService 인스턴스를 반환합니다."""
    return SeparationService(cache_dir=str(stems_cache_dir))


@pytest.fixture
def sample_audio_file(tmp_path: Path) -> Path:
    """테스트용 오디오 파일을 생성합니다."""
    audio_file = tmp_path / "test_audio.mp3"
    audio_file.write_bytes(b"fake audio content" * 1000)
    return audio_file


class TestSeparationServiceInit:
    """SeparationService 초기화 테스트."""

    def test_init_creates_cache_dir(self, tmp_path: Path) -> None:
        """초기화 시 캐시 디렉터리가 생성되는지 확인합니다."""
        cache_dir = tmp_path / "new_cache"
        service = SeparationService(cache_dir=str(cache_dir))
        assert cache_dir.exists()
        assert service.cache_dir == cache_dir

    def test_init_with_existing_cache_dir(self, stems_cache_dir: Path) -> None:
        """기존 캐시 디렉터리로 초기화하는지 확인합니다."""
        service = SeparationService(cache_dir=str(stems_cache_dir))
        assert service.cache_dir == stems_cache_dir

    def test_default_semaphore_limit(self, service: SeparationService) -> None:
        """기본 세마포어 제한이 2인지 확인합니다."""
        assert service._semaphore._value == 2

    def test_custom_semaphore_limit(self, stems_cache_dir: Path) -> None:
        """사용자 정의 세마포어 제한을 설정할 수 있는지 확인합니다."""
        service = SeparationService(cache_dir=str(stems_cache_dir), max_concurrent=1)
        assert service._semaphore._value == 1


class TestCreateTask:
    """태스크 생성 테스트."""

    def test_create_task_returns_uuid(self, service: SeparationService) -> None:
        """create_task가 UUID 문자열을 반환하는지 확인합니다."""
        task_id = service.create_task()
        assert isinstance(task_id, str)
        assert len(task_id) == 36  # UUID 형식

    def test_create_task_initializes_status(self, service: SeparationService) -> None:
        """생성된 태스크가 올바른 초기 상태를 갖는지 확인합니다."""
        task_id = service.create_task()
        task = service.get_task(task_id)
        assert task is not None
        assert task.status == "pending"
        assert task.progress == 0.0

    def test_create_multiple_tasks(self, service: SeparationService) -> None:
        """여러 태스크를 독립적으로 생성할 수 있는지 확인합니다."""
        task_id_1 = service.create_task()
        task_id_2 = service.create_task()
        assert task_id_1 != task_id_2
        assert len(service._tasks) == 2


class TestFileHash:
    """파일 해시 테스트."""

    def test_get_file_hash(self, service: SeparationService, sample_audio_file: Path) -> None:
        """파일 해시가 올바르게 계산되는지 확인합니다."""
        hash1 = service._get_file_hash(sample_audio_file)
        hash2 = service._get_file_hash(sample_audio_file)
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 해시 길이

    def test_different_files_different_hashes(
        self, service: SeparationService, tmp_path: Path
    ) -> None:
        """다른 파일이 다른 해시를 갖는지 확인합니다."""
        file1 = tmp_path / "file1.mp3"
        file2 = tmp_path / "file2.mp3"
        file1.write_bytes(b"content1")
        file2.write_bytes(b"content2")

        hash1 = service._get_file_hash(file1)
        hash2 = service._get_file_hash(file2)
        assert hash1 != hash2


class TestGetCachedStems:
    """캐시된 스템 조회 테스트."""

    def test_no_cache_returns_none(self, service: SeparationService) -> None:
        """캐시가 없을 때 None을 반환하는지 확인합니다."""
        result = service._get_cached_stems("nonexistent_hash")
        assert result is None

    def test_existing_cache_returns_stems(
        self, service: SeparationService, stems_cache_dir: Path
    ) -> None:
        """기존 캐시가 있으면 스템 경로를 반환하는지 확인합니다."""
        # 캐시 디렉터리 구조 생성
        test_hash = "abc123"
        hash_dir = stems_cache_dir / test_hash
        hash_dir.mkdir()
        (hash_dir / "vocals.wav").write_bytes(b"vocals")
        (hash_dir / "drums.wav").write_bytes(b"drums")
        (hash_dir / "bass.wav").write_bytes(b"bass")
        (hash_dir / "other.wav").write_bytes(b"other")

        result = service._get_cached_stems(test_hash)
        assert result is not None
        assert result["vocals"].exists()
        assert result["drums"].exists()
        assert result["bass"].exists()
        assert result["other"].exists()


class TestUpdateProgress:
    """진행률 업데이트 테스트."""

    def test_update_progress(self, service: SeparationService) -> None:
        """진행률이 올바르게 업데이트되는지 확인합니다."""
        task_id = service.create_task()
        service._update_progress(task_id, 50.0, "separating")
        task = service.get_task(task_id)
        assert task is not None
        assert task.progress == 50.0
        assert task.status == "separating"


class TestActiveCount:
    """활성 태스크 수 테스트."""

    def test_active_count_initially_zero(self, service: SeparationService) -> None:
        """초기 활성 태스크 수가 0인지 확인합니다."""
        assert service.active_count == 0

    def test_active_count_includes_processing_tasks(self, service: SeparationService) -> None:
        """처리 중인 태스크가 활성 태스크 수에 포함되는지 확인합니다."""
        task_id = service.create_task()
        service._tasks[task_id].status = "processing"
        assert service.active_count == 1


class TestCleanup:
    """정리 테스트."""

    def test_remove_task(self, service: SeparationService) -> None:
        """태스크가 제거되는지 확인합니다."""
        task_id = service.create_task()
        assert service.get_task(task_id) is not None
        service.remove_task(task_id)
        assert service.get_task(task_id) is None


class TestSeparationTaskModel:
    """SeparationTask 데이터 모델 테스트."""

    def test_task_creation(self) -> None:
        """태스크가 올바른 필드를 갖는지 확인합니다."""
        task = SeparationTask(
            status="pending",
            progress=0.0,
            file_hash=None,
            stems=None,
            error=None,
        )
        assert task.status == "pending"
        assert task.progress == 0.0
        assert task.file_hash is None
        assert task.stems is None
        assert task.error is None


class TestModelLoading:
    """모델 로딩 테스트."""

    @pytest.mark.asyncio
    async def test_ensure_model_loaded_sets_model(self, service: SeparationService) -> None:
        """모델이 로드되는지 확인합니다."""
        # 초기에는 모델이 로드되지 않음
        assert service._model is None

        # 모델 로드
        await service._ensure_model_loaded()

        # 모델이 로드됨
        assert service._model is not None


class TestCacheDirectoryCreation:
    """캐시 디렉터리 생성 테스트."""

    def test_create_cache_directory_for_hash(
        self, service: SeparationService, stems_cache_dir: Path
    ) -> None:
        """해시용 캐시 디렉터리가 생성되는지 확인합니다."""
        test_hash = "test_hash_123"
        cache_path = service._get_cache_path(test_hash)
        assert cache_path == stems_cache_dir / test_hash

        # 디렉터리 생성
        cache_path.mkdir(parents=True, exist_ok=True)
        assert cache_path.exists()
