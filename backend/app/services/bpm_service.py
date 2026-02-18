"""BPM 분석 서비스.

madmom(주력)과 librosa(폴백)를 사용하여 오디오 파일의 BPM과 비트 타임스탬프를 분석합니다.
SHA256 파일 해시 기반 캐싱을 지원합니다.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import collections
import collections.abc

import numpy as np

logger = logging.getLogger(__name__)

# madmom 0.16.1 호환성 패치 (Python 3.13 + NumPy 2.x)
# 1) collections.MutableSequence 등이 Python 3.10에서 collections.abc로 이동
for _attr in ("MutableSequence", "MutableMapping", "MutableSet"):
    if not hasattr(collections, _attr):
        setattr(collections, _attr, getattr(collections.abc, _attr))
# 2) np.float, np.int 등이 NumPy 1.24에서 제거됨 → numpy 스칼라 타입으로 복원
_NP_COMPAT = {"float": np.float64, "int": np.int64, "complex": np.complex128,
              "bool": np.bool_, "str": np.str_, "object": np.object_}
for _name, _type in _NP_COMPAT.items():
    if not hasattr(np, _name):
        setattr(np, _name, _type)  # type: ignore[attr-defined]

# 라이브러리 가용성 확인 (separation_service.py 패턴 참조)
_MADMOM_AVAILABLE = False
_LIBROSA_AVAILABLE = False

try:
    from madmom.features.beats import DBNBeatTrackingProcessor, RNNBeatProcessor

    _MADMOM_AVAILABLE = True
    logger.info("madmom loaded successfully for BPM detection")
except ImportError as err:
    logger.warning(
        "madmom을 로드할 수 없습니다: %s. "
        "librosa 폴백을 사용합니다. "
        "설치: pip install madmom",
        err,
    )

try:
    import librosa

    _LIBROSA_AVAILABLE = True
    logger.info("librosa loaded successfully for BPM detection (fallback)")
except ImportError as err:
    logger.warning(
        "librosa를 로드할 수 없습니다: %s. "
        "설치: pip install librosa",
        err,
    )


@dataclass
class BpmResult:
    """BPM 분석 결과 데이터 모델."""

    bpm: float
    beats: list[float]
    confidence: float
    file_hash: str

    def to_dict(self) -> dict[str, Any]:
        """딕셔너리로 변환합니다."""
        return {
            "bpm": self.bpm,
            "beats": self.beats,
            "confidence": self.confidence,
            "file_hash": self.file_hash,
        }


def _calculate_confidence(beats: np.ndarray) -> float:
    """비트 간격의 일관성을 기반으로 신뢰도를 계산합니다.

    일정한 템포에서는 높은 신뢰도(0.9+)를 반환하고,
    불규칙한 템포에서는 낮은 신뢰도를 반환합니다.

    Args:
        beats: 비트 타임스탬프 배열 (초 단위).

    Returns:
        0-1 사이의 신뢰도 점수.
    """
    if len(beats) < 2:
        return 0.0

    intervals = np.diff(beats)
    if len(intervals) == 0:
        return 0.0

    mean_interval = np.mean(intervals)
    if mean_interval == 0:
        return 0.0

    std_interval = np.std(intervals)
    # 변동계수(CV) 기반 신뢰도 계산
    # CV가 작을수록 일정한 템포
    cv = std_interval / mean_interval

    # CV 0 = 완벽한 일관성 (신뢰도 1.0)
    # CV 0.1 = 약간의 변동 (신뢰도 ~0.9)
    # CV 0.3 = 상당한 변동 (신뢰도 ~0.7)
    confidence = max(0.0, min(1.0, 1.0 - cv))

    return float(confidence)


def _smooth_beats(beats: np.ndarray, window_size: int = 8) -> np.ndarray:
    """비트 간격에 이동 중앙값 필터를 적용하여 이상치를 제거합니다.

    인트로 등 비트 감지가 불안정한 구간의 바운싱을 완화하면서
    곡 전체의 템포 변화는 유지합니다.

    Args:
        beats: 원본 비트 타임스탬프 배열 (초 단위).
        window_size: 이동 중앙값 윈도우 크기 (기본값: 8비트).

    Returns:
        스무딩된 비트 타임스탬프 배열.
    """
    if len(beats) < 4:
        return beats

    intervals = np.diff(beats)
    smoothed_intervals = np.copy(intervals)

    half_w = window_size // 2
    for i in range(len(intervals)):
        start = max(0, i - half_w)
        end = min(len(intervals), i + half_w + 1)
        smoothed_intervals[i] = np.median(intervals[start:end])

    # 스무딩된 간격으로 비트 위치 재구성 (첫 비트 위치 유지)
    smoothed_beats = np.zeros(len(beats))
    smoothed_beats[0] = beats[0]
    for i in range(len(smoothed_intervals)):
        smoothed_beats[i + 1] = smoothed_beats[i] + smoothed_intervals[i]

    return smoothed_beats


def _detect_with_madmom(audio_path: str) -> tuple[float, np.ndarray, float]:
    """madmom으로 BPM과 비트를 감지합니다.

    Args:
        audio_path: 오디오 파일 경로.

    Returns:
        (bpm, beats, confidence) 튜플.
    """
    # RNN 기반 비트 활성화 함수 추출
    act = RNNBeatProcessor()(audio_path)

    # DBN(Dynamic Bayesian Network) 기반 비트 트래킹
    proc = DBNBeatTrackingProcessor(fps=100)
    beats = proc(act)

    if len(beats) < 2:
        return 0.0, beats, 0.0

    # 비트 간격 스무딩 (인트로 등 불안정 구간 보정)
    beats = _smooth_beats(beats)

    # BPM 계산 (중앙값 사용 - 이상치에 강건)
    intervals = np.diff(beats)
    bpm = 60.0 / np.median(intervals)

    # 신뢰도 계산 (스무딩 후 재계산)
    confidence = _calculate_confidence(beats)

    return bpm, beats, confidence


def _detect_with_librosa(audio_path: str) -> tuple[float, np.ndarray, float]:
    """librosa로 BPM과 비트를 감지합니다 (폴백).

    Args:
        audio_path: 오디오 파일 경로.

    Returns:
        (bpm, beats, confidence) 튜플.
    """
    y, sr = librosa.load(audio_path, sr=22050)

    # 비트 트래킹
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)

    # 프레임을 타임스탬프로 변환
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    # librosa는 신뢰도를 제공하지 않음
    # 비트 일관성으로 직접 계산
    confidence = _calculate_confidence(beat_times)

    # 보수적 신뢰도 상한 (madmom보다 낮음)
    confidence = min(confidence, 0.8)

    return float(tempo), beat_times, confidence


class BpmService:
    """BPM 분석 서비스.

    특징:
    - madmom 주력, librosa 폴백
    - SHA256 파일 해시 기반 캐싱
    - 캐시 위치: /tmp/bpm_cache/{hash}.json
    """

    def __init__(self, cache_dir: str | None = None) -> None:
        """BpmService를 초기화합니다.

        Args:
            cache_dir: BPM 캐시 디렉터리 경로.
        """
        self.cache_dir = Path(cache_dir or "/tmp/bpm_cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        logger.info("BpmService initialized with cache_dir=%s", self.cache_dir)

    def _get_file_hash(self, file_path: Path) -> str:
        """파일의 SHA256 해시를 계산합니다.

        Args:
            file_path: 파일 경로.

        Returns:
            16진수 해시 문자열.
        """
        sha256 = hashlib.sha256()
        with file_path.open("rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _get_cached_result(self, file_hash: str) -> BpmResult | None:
        """캐시된 BPM 결과를 조회합니다.

        Args:
            file_hash: 파일 해시.

        Returns:
            캐시된 결과, 또는 None.
        """
        cache_file = self.cache_dir / f"{file_hash}.json"
        if not cache_file.exists():
            return None

        try:
            data = json.loads(cache_file.read_text())
            return BpmResult(
                bpm=data["bpm"],
                beats=data["beats"],
                confidence=data["confidence"],
                file_hash=file_hash,
            )
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning("Failed to read cache file %s: %s", cache_file, e)
            return None

    def _save_cached_result(self, result: BpmResult) -> None:
        """BPM 결과를 캐시에 저장합니다.

        Args:
            result: 분석 결과.
        """
        cache_file = self.cache_dir / f"{result.file_hash}.json"
        cache_file.write_text(json.dumps(result.to_dict(), indent=2))

    def _detect_with_madmom(self, audio_path: str) -> tuple[float, np.ndarray, float]:
        """madjom으로 BPM 감지 (래퍼 메서드)."""
        return _detect_with_madmom(audio_path)

    def _detect_with_librosa(self, audio_path: str) -> tuple[float, np.ndarray, float]:
        """librosa로 BPM 감지 (래퍼 메서드)."""
        return _detect_with_librosa(audio_path)

    def analyze(self, file_path: str) -> BpmResult:
        """오디오 파일의 BPM과 비트를 분석합니다.

        캐시된 결과가 있으면 반환하고, 없으면 분석 후 캐시합니다.

        Args:
            file_path: 오디오 파일 경로.

        Returns:
            BpmResult 인스턴스.

        Raises:
            FileNotFoundError: 파일이 존재하지 않을 때.
            RuntimeError: 분석 실패 시.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")

        # 파일 해시 계산
        file_hash = self._get_file_hash(path)

        # 캐시 확인
        cached = self._get_cached_result(file_hash)
        if cached is not None:
            logger.info("Using cached BPM result for hash=%s", file_hash[:16])
            return cached

        # 분석 실행
        try:
            if _MADMOM_AVAILABLE:
                bpm, beats, confidence = self._detect_with_madmom(str(path))
                algorithm = "madmom"
            elif _LIBROSA_AVAILABLE:
                bpm, beats, confidence = self._detect_with_librosa(str(path))
                algorithm = "librosa"
            else:
                raise RuntimeError(
                    "BPM 분석 라이브러리가 설치되지 않았습니다. "
                    "madmom 또는 librosa를 설치하세요."
                )

            # 결과 생성
            result = BpmResult(
                bpm=round(bpm, 1),
                beats=[round(float(b), 3) for b in beats.tolist()],
                confidence=round(confidence, 3),
                file_hash=file_hash,
            )

            # 캐시 저장
            self._save_cached_result(result)

            logger.info(
                "BPM analysis completed: bpm=%.1f, beats=%d, confidence=%.2f, algorithm=%s",
                result.bpm,
                len(result.beats),
                result.confidence,
                algorithm,
            )

            return result

        except Exception as e:
            logger.error("BPM analysis failed for %s: %s", file_path, e)
            raise RuntimeError(f"BPM 분석 실패: {e}") from e


# 전역 서비스 인스턴스
bpm_service = BpmService()
