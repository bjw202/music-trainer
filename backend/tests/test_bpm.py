"""BPM 분석 서비스 및 API 테스트."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest

from app.services.bpm_service import BpmService, BpmResult


@pytest.fixture
def bpm_cache_dir(tmp_path: Path) -> Path:
    """테스트용 BPM 캐시 디렉터리를 생성합니다."""
    cache_dir = tmp_path / "bpm_cache"
    cache_dir.mkdir()
    return cache_dir


@pytest.fixture
def service(bpm_cache_dir: Path) -> BpmService:
    """테스트용 BpmService 인스턴스를 반환합니다."""
    return BpmService(cache_dir=str(bpm_cache_dir))


@pytest.fixture
def sample_audio_file(tmp_path: Path) -> Path:
    """테스트용 오디오 파일을 생성합니다."""
    audio_file = tmp_path / "test_audio.mp3"
    audio_file.write_bytes(b"fake audio content for bpm test" * 100)
    return audio_file


class TestBpmResult:
    """BpmResult 데이터 모델 테스트."""

    def test_bpm_result_creation(self) -> None:
        """BpmResult가 올바른 필드를 갖는지 확인합니다."""
        result = BpmResult(
            bpm=120.0,
            beats=[0.5, 1.0, 1.5, 2.0],
            confidence=0.95,
            file_hash="abc123",
        )
        assert result.bpm == 120.0
        assert result.beats == [0.5, 1.0, 1.5, 2.0]
        assert result.confidence == 0.95
        assert result.file_hash == "abc123"

    def test_bpm_result_to_dict(self) -> None:
        """BpmResult를 딕셔너리로 변환할 수 있는지 확인합니다."""
        result = BpmResult(
            bpm=100.0,
            beats=[1.0, 2.0],
            confidence=0.8,
            file_hash="test_hash",
        )
        d = result.to_dict()
        assert d["bpm"] == 100.0
        assert d["beats"] == [1.0, 2.0]
        assert d["confidence"] == 0.8
        assert d["file_hash"] == "test_hash"


class TestBpmServiceInit:
    """BpmService 초기화 테스트."""

    def test_init_creates_cache_dir(self, tmp_path: Path) -> None:
        """초기화 시 캐시 디렉터리가 생성되는지 확인합니다."""
        cache_dir = tmp_path / "new_bpm_cache"
        service = BpmService(cache_dir=str(cache_dir))
        assert cache_dir.exists()
        assert service.cache_dir == cache_dir

    def test_init_with_existing_cache_dir(self, bpm_cache_dir: Path) -> None:
        """기존 캐시 디렉터리로 초기화하는지 확인합니다."""
        service = BpmService(cache_dir=str(bpm_cache_dir))
        assert service.cache_dir == bpm_cache_dir


class TestFileHash:
    """파일 해시 테스트."""

    def test_get_file_hash(self, service: BpmService, sample_audio_file: Path) -> None:
        """파일 해시가 올바르게 계산되는지 확인합니다."""
        hash1 = service._get_file_hash(sample_audio_file)
        hash2 = service._get_file_hash(sample_audio_file)
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 해시 길이

    def test_different_files_different_hashes(
        self, service: BpmService, tmp_path: Path
    ) -> None:
        """다른 파일이 다른 해시를 갖는지 확인합니다."""
        file1 = tmp_path / "file1.mp3"
        file2 = tmp_path / "file2.mp3"
        file1.write_bytes(b"content1")
        file2.write_bytes(b"content2")

        hash1 = service._get_file_hash(file1)
        hash2 = service._get_file_hash(file2)
        assert hash1 != hash2


class TestCaching:
    """캐싱 테스트."""

    def test_get_cached_result_none_when_no_cache(self, service: BpmService) -> None:
        """캐시가 없을 때 None을 반환하는지 확인합니다."""
        result = service._get_cached_result("nonexistent_hash")
        assert result is None

    def test_save_and_get_cached_result(
        self, service: BpmService
    ) -> None:
        """결과를 캐시하고 조회할 수 있는지 확인합니다."""
        file_hash = "test_hash_123"
        result = BpmResult(
            bpm=120.0,
            beats=[0.5, 1.0, 1.5],
            confidence=0.9,
            file_hash=file_hash,
        )

        # 캐시 저장
        service._save_cached_result(result)

        # 캐시 조회
        cached = service._get_cached_result(file_hash)
        assert cached is not None
        assert cached.bpm == 120.0
        assert cached.beats == [0.5, 1.0, 1.5]
        assert cached.confidence == 0.9

    def test_cache_file_format(self, service: BpmService, bpm_cache_dir: Path) -> None:
        """캐시 파일이 올바른 JSON 형식인지 확인합니다."""
        file_hash = "format_test_hash"
        result = BpmResult(
            bpm=140.0,
            beats=[0.0, 0.428, 0.857],
            confidence=0.85,
            file_hash=file_hash,
        )

        service._save_cached_result(result)

        # 직접 파일 읽기로 형식 확인
        cache_file = bpm_cache_dir / f"{file_hash}.json"
        assert cache_file.exists()

        with cache_file.open("r") as f:
            data = json.load(f)

        assert data["bpm"] == 140.0
        assert data["beats"] == [0.0, 0.428, 0.857]
        assert data["confidence"] == 0.85


class TestMadmomDetection:
    """madmom BPM 감지 테스트."""

    @patch("app.services.bpm_service._MADMOM_AVAILABLE", True)
    def test_detect_with_madmom_success(self, service: BpmService, tmp_path: Path) -> None:
        """madmom으로 BPM 감지가 성공하는지 확인합니다."""
        audio_file = tmp_path / "test.mp3"
        audio_file.write_bytes(b"fake audio")

        with patch("app.services.bpm_service._detect_with_madmom") as mock_detect:
            mock_detect.return_value = (120.0, [0.5, 1.0, 1.5], 0.95)

            result = service._detect_with_madmom(str(audio_file))

            assert result[0] == 120.0
            assert result[1] == [0.5, 1.0, 1.5]
            assert result[2] == 0.95

    @patch("app.services.bpm_service._MADMOM_AVAILABLE", False)
    @patch("app.services.bpm_service._LIBROSA_AVAILABLE", True)
    def test_detect_falls_back_to_librosa(self, service: BpmService, tmp_path: Path) -> None:
        """madmom 미설치 시 librosa로 폴백하는지 확인합니다."""
        audio_file = tmp_path / "test.mp3"
        audio_file.write_bytes(b"fake audio")

        # Mock both detection functions - return numpy array for beats
        with patch("app.services.bpm_service._detect_with_madmom") as mock_madmom, \
             patch("app.services.bpm_service._detect_with_librosa") as mock_librosa:
            mock_librosa.return_value = (110.0, np.array([0.55, 1.1]), 0.7)

            result = service.analyze(str(audio_file))

            # librosa should have been called, not madmom
            mock_librosa.assert_called_once()
            mock_madmom.assert_not_called()
            assert result.bpm == 110.0
            assert result.confidence == 0.7


class TestLibrosaFallback:
    """librosa 폴백 테스트."""

    @patch("app.services.bpm_service._LIBROSA_AVAILABLE", True)
    def test_detect_with_librosa_success(
        self, service: BpmService, tmp_path: Path
    ) -> None:
        """librosa로 BPM 감지가 성공하는지 확인합니다."""
        audio_file = tmp_path / "test.mp3"
        audio_file.write_bytes(b"fake audio")

        with patch("app.services.bpm_service._detect_with_librosa") as mock_detect:
            mock_detect.return_value = (100.0, [0.6, 1.2, 1.8], 0.7)

            result = service._detect_with_librosa(str(audio_file))

            assert result[0] == 100.0
            assert result[1] == [0.6, 1.2, 1.8]
            assert result[2] == 0.7


class TestAnalyze:
    """analyze 통합 테스트."""

    def test_analyze_returns_cached_result(
        self, service: BpmService, sample_audio_file: Path
    ) -> None:
        """캐시된 결과가 있으면 캐시를 반환하는지 확인합니다."""
        file_hash = service._get_file_hash(sample_audio_file)
        cached_result = BpmResult(
            bpm=130.0,
            beats=[0.46, 0.92, 1.38],
            confidence=0.92,
            file_hash=file_hash,
        )
        service._save_cached_result(cached_result)

        result = service.analyze(str(sample_audio_file))

        assert result.bpm == 130.0
        assert result.beats == [0.46, 0.92, 1.38]
        assert result.confidence == 0.92

    @patch("app.services.bpm_service._MADMOM_AVAILABLE", False)
    @patch("app.services.bpm_service._LIBROSA_AVAILABLE", False)
    def test_analyze_no_library_available(
        self, service: BpmService, sample_audio_file: Path
    ) -> None:
        """라이브러리가 없을 때 에러를 발생시키는지 확인합니다."""
        with pytest.raises(RuntimeError, match="BPM 분석 라이브러리"):
            service.analyze(str(sample_audio_file))


class TestConfidenceCalculation:
    """신뢰도 계산 테스트."""

    def test_calculate_confidence_consistent_tempo(self) -> None:
        """일정한 템포에서 높은 신뢰도를 반환하는지 확인합니다."""
        import numpy as np
        from app.services.bpm_service import _calculate_confidence

        # 일정한 간격의 비트
        beats = np.array([0.5, 1.0, 1.5, 2.0, 2.5, 3.0])
        confidence = _calculate_confidence(beats)

        assert confidence > 0.9  # 일정한 템포는 높은 신뢰도

    def test_calculate_confidence_irregular_tempo(self) -> None:
        """불규칙한 템포에서 낮은 신뢰도를 반환하는지 확인합니다."""
        import numpy as np
        from app.services.bpm_service import _calculate_confidence

        # 불규칙한 간격의 비트
        beats = np.array([0.5, 1.2, 1.5, 2.3, 2.6, 3.5])
        confidence = _calculate_confidence(beats)

        assert confidence < 0.9  # 불규칙한 템포는 낮은 신뢰도
