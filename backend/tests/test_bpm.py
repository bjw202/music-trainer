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
            engine="madmom",
        )
        assert result.bpm == 120.0
        assert result.beats == [0.5, 1.0, 1.5, 2.0]
        assert result.confidence == 0.95
        assert result.file_hash == "abc123"
        assert result.engine == "madmom"

    def test_bpm_result_to_dict(self) -> None:
        """BpmResult를 딕셔너리로 변환할 수 있는지 확인합니다."""
        result = BpmResult(
            bpm=100.0,
            beats=[1.0, 2.0],
            confidence=0.8,
            file_hash="test_hash",
            engine="librosa",
        )
        d = result.to_dict()
        assert d["bpm"] == 100.0
        assert d["beats"] == [1.0, 2.0]
        assert d["confidence"] == 0.8
        assert d["file_hash"] == "test_hash"
        assert d["engine"] == "librosa"

    def test_bpm_result_to_dict_includes_engine(self) -> None:
        """CT-3: to_dict() 키 집합이 정확히 5개인지 확인합니다 (AC-BPM-003).

        spec.md 6.3절 CT-3의 사후 형태다. CT-3의 사전 형태(4개)는 M1(`1073c11`)이
        `engine`을 추가하면서 이미 갱신되었으므로, 지금 고정할 수 있는 키 집합은
        `engine`을 포함한 5개다. [M5 이후에도 유지되는 테스트]
        """
        result = BpmResult(
            bpm=100.0,
            beats=[1.0, 2.0],
            confidence=0.8,
            file_hash="test_hash",
            engine="madmom",
        )
        assert set(result.to_dict().keys()) == {
            "bpm",
            "beats",
            "confidence",
            "file_hash",
            "engine",
        }


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
            engine="madmom",
        )

        # 캐시 저장
        service._save_cached_result(result)

        # 캐시 조회
        cached = service._get_cached_result(file_hash)
        assert cached is not None
        assert cached.bpm == 120.0
        assert cached.beats == [0.5, 1.0, 1.5]
        assert cached.confidence == 0.9
        assert cached.engine == "madmom"

    def test_cache_file_format(self, service: BpmService, bpm_cache_dir: Path) -> None:
        """캐시 파일이 올바른 JSON 형식인지 확인합니다."""
        file_hash = "format_test_hash"
        result = BpmResult(
            bpm=140.0,
            beats=[0.0, 0.428, 0.857],
            confidence=0.85,
            file_hash=file_hash,
            engine="librosa",
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
        assert data["engine"] == "librosa"

    def test_legacy_cache_without_engine_returns_none(
        self, service: BpmService, bpm_cache_dir: Path
    ) -> None:
        """engine 키가 없는 구 스키마 캐시는 None을 반환합니다 (AC-BPM-004)."""
        file_hash = "legacy_schema_hash"
        cache_file = bpm_cache_dir / f"{file_hash}.json"
        cache_file.write_text(
            json.dumps(
                {
                    "bpm": 120.0,
                    "beats": [0.5, 1.0, 1.5],
                    "confidence": 0.9,
                    "file_hash": file_hash,
                }
            )
        )

        assert service._get_cached_result(file_hash) is None

    def test_new_cache_with_engine_roundtrips(self, service: BpmService) -> None:
        """신 스키마 캐시는 engine 값이 왕복 일치합니다 (AC-BPM-004)."""
        file_hash = "new_schema_hash"
        result = BpmResult(
            bpm=95.0,
            beats=[0.0, 0.631],
            confidence=0.77,
            file_hash=file_hash,
            engine="madmom",
        )

        service._save_cached_result(result)

        cached = service._get_cached_result(file_hash)
        assert cached is not None
        assert cached.engine == "madmom"


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
            assert result.engine == "librosa"


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
            engine="madmom",
        )
        service._save_cached_result(cached_result)

        result = service.analyze(str(sample_audio_file))

        assert result.bpm == 130.0
        assert result.beats == [0.46, 0.92, 1.38]
        assert result.confidence == 0.92
        assert result.engine == "madmom"

    @patch("app.services.bpm_service._MADMOM_AVAILABLE", False)
    @patch("app.services.bpm_service._LIBROSA_AVAILABLE", True)
    def test_analyze_sets_engine_librosa(
        self, service: BpmService, sample_audio_file: Path
    ) -> None:
        """librosa 경로로 분석하면 engine이 "librosa"입니다 (AC-BPM-003)."""
        with patch("app.services.bpm_service._detect_with_librosa") as mock_librosa:
            mock_librosa.return_value = (100.0, np.array([0.6, 1.2, 1.8]), 0.7)

            result = service.analyze(str(sample_audio_file))

        assert result.engine == "librosa"

    @patch("app.services.bpm_service._MADMOM_AVAILABLE", True)
    def test_analyze_sets_engine_madmom(
        self, service: BpmService, sample_audio_file: Path
    ) -> None:
        """madmom 경로로 분석하면 engine이 "madmom"입니다 (AC-BPM-003)."""
        with patch("app.services.bpm_service._detect_with_madmom") as mock_madmom:
            # madmom 경로는 보정 건수까지 4-튜플로 반환한다 (SPEC-BPM-003 M2).
            mock_madmom.return_value = (
                120.0,
                np.array([0.5, 1.0, 1.5]),
                0.95,
                {"inserted": 0, "dropped": 0},
            )

            result = service.analyze(str(sample_audio_file))

        assert result.engine == "madmom"
        assert result.repair_counts == {"inserted": 0, "dropped": 0}

    @patch("app.services.bpm_service._MADMOM_AVAILABLE", False)
    @patch("app.services.bpm_service._LIBROSA_AVAILABLE", False)
    def test_analyze_no_library_available(
        self, service: BpmService, sample_audio_file: Path
    ) -> None:
        """라이브러리가 없을 때 에러를 발생시키는지 확인합니다."""
        with pytest.raises(RuntimeError, match="BPM 분석 라이브러리"):
            service.analyze(str(sample_audio_file))


class TestRepairBeats:
    """국소 보정 불변식 테스트 (AC-BPM-002 / REQ-BPM-002-INV)."""

    @staticmethod
    def _assert_superset(original: np.ndarray, repaired: np.ndarray) -> None:
        """원본의 각 값이 결과에 오차 1e-9 이내로 존재하는지 확인합니다."""
        for value in original:
            assert np.min(np.abs(repaired - value)) <= 1e-9, (
                f"원본 비트 {value} 가 결과에서 사라졌거나 이동했다"
            )

    def test_repair_preserves_original_beats(self) -> None:
        """등간격 40비트 + 미세 지터: 원본 값이 그대로 보존됩니다."""
        from app.services.bpm_service import _repair_beats

        rng = np.random.default_rng(20260905)
        base = np.arange(40, dtype=float) * 0.5
        original = base + rng.uniform(-0.01, 0.01, size=base.shape)
        original = np.sort(original)

        repaired, counts = _repair_beats(original)

        self._assert_superset(original, repaired)
        assert len(repaired) == len(original) + counts["inserted"] - counts["dropped"]

    def test_repair_interpolates_gap(self) -> None:
        """한 지점의 간격을 2배로 벌리면 정확히 1개가 삽입됩니다."""
        from app.services.bpm_service import _repair_beats

        # 0.5초 등간격 20비트에서 인덱스 10의 비트를 빼 간격을 2배(1.0초)로 만든다.
        original = np.delete(np.arange(20, dtype=float) * 0.5, 10)

        repaired, counts = _repair_beats(original)

        assert counts == {"inserted": 1, "dropped": 0}
        assert len(repaired) == len(original) + 1
        # 삽입 위치는 벌어진 간격의 한가운데 (= 원래 있던 자리)
        assert np.min(np.abs(repaired - 5.0)) <= 1e-9
        # 나머지 비트는 이동하지 않는다
        self._assert_superset(original, repaired)

    def test_repair_drops_duplicate(self) -> None:
        """0.3배 간격의 중복 비트 1개만 제거되고 나머지는 불변입니다."""
        from app.services.bpm_service import _repair_beats

        base = np.arange(20, dtype=float) * 0.5
        duplicate = base[10] + 0.15  # 0.3 * 0.5 = 0.15초 뒤의 중복 비트
        original = np.sort(np.append(base, duplicate))

        repaired, counts = _repair_beats(original)

        assert counts == {"inserted": 0, "dropped": 1}
        assert len(repaired) == len(original) - 1
        # 제거된 것은 중복 비트 하나뿐이다
        assert np.min(np.abs(repaired - duplicate)) > 1e-9
        # 원래의 등간격 비트는 전부 값 그대로 남는다
        self._assert_superset(base, repaired)

    def test_repair_no_cumulative_shift(self) -> None:
        """보정 대상이 없는 60비트 배열은 입력과 완전히 동일하게 나옵니다."""
        from app.services.bpm_service import _repair_beats

        original = np.arange(60, dtype=float) * 0.48

        repaired, counts = _repair_beats(original)

        assert counts == {"inserted": 0, "dropped": 0}
        assert len(repaired) == len(original)
        assert np.max(np.abs(repaired - original)) <= 1e-9


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


class TestCharacterization:
    """SPEC-BPM-003 6.3절 특성화 테스트 (DDD PRESERVE 단계).

    변경 **전**의 동작을 자동 재실행 가능한 형태로 고정한다.
    """

    def test_ct2_detect_with_madmom_returns_detector_output(
        self, tmp_path: Path
    ) -> None:
        """CT-2: `_detect_with_madmom`의 반환 비트와 감지기 원본의 관계를 고정한다.

        **사후 형태로 작성했다.** spec.md 6.3절 CT-2는 변경 전 "다름" → 변경 후
        "국소 보정 대상이 없는 입력에서 같음"으로 뒤집히는 테스트로 규정하는데,
        M2(`1cfd6ab`)가 이미 전역 재구성 호출을 `_repair_beats`로 교체했으므로
        이 시점에 참인 명제는 **"같음"** 이다. 성립하지 않는 사전 단언을 지어내지
        않는다.

        [HARD] 모킹 계층 (spec.md D15): `RNNBeatProcessor` /
        `DBNBeatTrackingProcessor`만 패치하고 `_detect_with_madmom`은 **실제 코드
        그대로 실행한다.** `_detect_with_madmom` 자체를 패치하면 모킹된 반환값을
        자기 자신과 비교하는 공허한 확인이 된다(기존
        `test_detect_with_madmom_success`의 결함). `create=True`는 madmom 미설치
        머신에서도 함수 본문이 실행되게 하기 위한 것이며 검증 대상 코드를
        우회하지 않는다.
        """
        from unittest.mock import MagicMock

        from app.services import bpm_service

        audio_file = tmp_path / "test.mp3"
        audio_file.write_bytes(b"fake audio")

        # 국소 보정 대상이 없는 입력: 완전 등간격이라 삽입도 제거도 발동하지 않는다.
        detector_beats = np.arange(32, dtype=float) * 0.5 + 0.25

        with patch(
            "app.services.bpm_service.RNNBeatProcessor", create=True
        ) as mock_rnn, patch(
            "app.services.bpm_service.DBNBeatTrackingProcessor", create=True
        ) as mock_dbn:
            mock_dbn.return_value.return_value = detector_beats

            # 검증 대상 함수 자체는 패치되지 않았음을 명시적으로 확인한다 (D15).
            assert not isinstance(bpm_service._detect_with_madmom, MagicMock)
            assert isinstance(bpm_service.RNNBeatProcessor, MagicMock)
            assert isinstance(bpm_service.DBNBeatTrackingProcessor, MagicMock)

            bpm, beats, confidence, repair_counts = bpm_service._detect_with_madmom(
                str(audio_file)
            )

            mock_rnn.assert_called_once()

        # 국소 보정만 남은 현재 코드에서는 감지기 원본이 그대로 방출된다.
        assert len(beats) == len(detector_beats)
        np.testing.assert_allclose(beats, detector_beats)
        assert repair_counts == {"inserted": 0, "dropped": 0}
        assert bpm == pytest.approx(120.0)
        assert confidence == pytest.approx(1.0)


class TestConfidenceFormulaPinned:
    """SPEC-BPM-003 AC-BPM-007 (a-2) — 동결 대상 두 지점을 값으로 고정한다.

    기존 `TestConfidenceCalculation`은 `> 0.9` / `< 0.9` 두 부등호 단언뿐이라
    `1.0 - cv`를 `1.0 - cv*0.5`로 바꾸거나 librosa 상한을 `0.9`로 올려도 그대로
    통과한다. 즉 REQ-BPM-007의 동결을 강제하지 못한다. AC-BPM-007 (a)의 diff
    검사도 파일이 옮겨지거나 커밋이 재작성되면 무력해진다. 이 클래스는 그 둘의
    **병행 방어선**이며, 값 자체를 고정한다.

    동결 대상 (spec.md REQ-BPM-007):
      (1) `_calculate_confidence` 안의 `max(0.0, min(1.0, 1.0 - cv))`
      (2) `_detect_with_librosa` 안의 `confidence = min(confidence, 0.8)`
    """

    def test_confidence_formula_pinned(self) -> None:
        """등간격이 아닌 알려진 배열에서 `1.0 - std/mean`을 정확히 재현한다.

        기대값을 상수로 적지 않고 테스트 안에서 다시 계산한다 — 상수로 적으면
        공식이 바뀌었을 때 "테스트를 새 값으로 고치면 통과"하는 경로가 열린다.
        """
        from app.services.bpm_service import _calculate_confidence

        beats = np.array([0.0, 0.5, 1.1, 1.5, 2.1, 2.5])

        intervals = np.diff(beats)
        expected = 1.0 - float(np.std(intervals)) / float(np.mean(intervals))

        actual = _calculate_confidence(beats)

        # 이 배열은 클램프에 걸리지 않는 구간에 있다 — 클램프가 차이를 가리지 않는다.
        assert 0.0 < expected < 1.0, expected
        assert abs(actual - expected) <= 1e-12, (
            f"신뢰도 공식이 변경되었다: actual={actual!r}, expected={expected!r}"
        )

    def test_confidence_formula_pinned_boundaries(self) -> None:
        """클램프 `max(0.0, min(1.0, ...))`의 양 끝을 고정한다."""
        from app.services.bpm_service import _calculate_confidence

        # 완전 등간격 → cv == 0 → 정확히 1.0
        uniform = np.arange(8, dtype=float) * 0.5
        assert _calculate_confidence(uniform) == 1.0

        # 표준편차가 평균을 넘는 배열 → 1.0 - cv < 0 → 하한 클램프로 정확히 0.0
        intervals = [0.001, 0.001, 0.001, 4.0]
        beats = [0.0]
        for gap in intervals:
            beats.append(beats[-1] + gap)
        skewed = np.asarray(beats, dtype=float)

        diffs = np.diff(skewed)
        assert float(np.std(diffs)) > float(np.mean(diffs)), (
            "입력이 하한 클램프를 건드리지 않는다"
        )
        assert _calculate_confidence(skewed) == 0.0

    def test_librosa_confidence_cap_pinned(self) -> None:
        """librosa 경로의 보수적 상한 `min(confidence, 0.8)`을 값으로 고정한다.

        [HARD] `_detect_with_librosa` 자체를 패치하지 않는다 — 패치하면 상한 줄이
        실행되지 않아 아무것도 고정하지 못한다(spec.md D15 CT-2의 모킹 계층 원칙과
        동일). librosa 호출부(`load` / `beat.beat_track` / `frames_to_time`)만
        패치하고 함수 본문은 실제로 실행되게 한다.

        완전 등간격 비트를 돌려주므로 상한이 없다면 신뢰도는 1.0이 된다. 즉 이
        테스트는 상한이 실제로 적용될 때만 통과한다.
        """
        from unittest.mock import MagicMock

        from app.services import bpm_service

        uniform_beat_times = np.arange(16, dtype=float) * 0.5

        fake_librosa = MagicMock()
        fake_librosa.load.return_value = (np.zeros(1000, dtype=float), 22050)
        fake_librosa.beat.beat_track.return_value = (120.0, np.arange(16))
        fake_librosa.frames_to_time.return_value = uniform_beat_times

        with patch.object(bpm_service, "librosa", fake_librosa):
            bpm, beats, confidence = bpm_service._detect_with_librosa("dummy.mp3")

        # 상한이 없었다면 이 입력의 신뢰도는 1.0 이다.
        assert bpm_service._calculate_confidence(uniform_beat_times) == 1.0
        assert confidence == 0.8, f"librosa 신뢰도 상한이 변경되었다: {confidence!r}"
        assert bpm == pytest.approx(120.0)
        np.testing.assert_allclose(beats, uniform_beat_times)
