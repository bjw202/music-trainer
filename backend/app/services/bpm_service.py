"""BPM 분석 서비스.

madmom(주력)과 librosa(폴백)를 사용하여 오디오 파일의 BPM과 비트 타임스탬프를 분석합니다.
SHA256 파일 해시 기반 캐싱을 지원합니다.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
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
    engine: str  # 사용된 감지 엔진 ("madmom" | "librosa"). 기본값 없음 — "모름" 전파 방지

    # 국소 보정 건수 {"inserted": int, "dropped": int} (SPEC-BPM-003 spec.md 4.1절).
    # 직렬화하지 않는다 — 캐시·API 스키마의 키 집합은 위 5개로 고정이다. 캐시에서
    # 복원된 결과는 None이며, 이는 "그 실행에서 보정 건수를 관측하지 않았다"는 사실이다.
    repair_counts: dict[str, int] | None = field(
        default=None, compare=False, repr=False
    )

    def to_dict(self) -> dict[str, Any]:
        """딕셔너리로 변환합니다."""
        return {
            "bpm": self.bpm,
            "beats": self.beats,
            "confidence": self.confidence,
            "file_hash": self.file_hash,
            "engine": self.engine,
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


# 국소 보정 임계값 (SPEC-BPM-003 REQ-BPM-002).
# 경험값이며 유도된 상수가 아니다 — 후속 SPEC에서 조정할 수 있도록 모듈 상수로 둔다.
REPAIR_GAP_RATIO = 1.75  # 간격이 국소 중앙값의 이 배 이상이면 누락으로 보고 보간한다
REPAIR_DUPLICATE_RATIO = 0.50  # 이 배 이하이면 중복으로 보고 뒤쪽 비트를 제거한다
REPAIR_WINDOW_SIZE = 8  # 국소 중앙값을 구하는 창의 폭 (4/4 기준 두 마디)


def _repair_beats(
    beats: np.ndarray, window_size: int = REPAIR_WINDOW_SIZE
) -> tuple[np.ndarray, dict[str, int]]:
    """비트 그리드를 국소 보정합니다 (누락 보간 / 중복 제거).

    비트 위치를 간격의 누적 합산으로 다시 쌓던 이전의 전역 재구성 방식과 달리,
    **살아남은 원본 비트를 이동시키지 않습니다.**
    국소 중앙값은 오직 판정에만 쓰이며 어떤 비트의 위치도 대체하지 않습니다
    (SPEC-BPM-003 REQ-BPM-002-INV).

    Args:
        beats: 감지기 원본 비트 타임스탬프 배열 (초 단위).
        window_size: 국소 중앙값 판정 창의 폭.

    Returns:
        (보정된 비트 배열, {"inserted": 삽입 건수, "dropped": 제거 건수}) 튜플.
        건수는 로그뿐 아니라 반환값으로도 노출됩니다 — 드리프트 측정 스크립트가
        자신의 분류 건수와 기계적으로 대조해야 하기 때문입니다 (spec.md 4.1절).
    """
    counts = {"inserted": 0, "dropped": 0}

    if len(beats) < 4:
        return beats, counts

    intervals = np.diff(beats)
    half_w = window_size // 2

    repaired: list[float] = [float(beats[0])]

    for i in range(len(intervals)):
        start = max(0, i - half_w)
        end = min(len(intervals), i + half_w + 1)
        local_median = float(np.median(intervals[start:end]))
        gap = float(intervals[i])

        if local_median <= 0.0:
            repaired.append(float(beats[i + 1]))
            continue

        if gap >= REPAIR_GAP_RATIO * local_median:
            # 누락 보간: 간격 안쪽만 등간격으로 채운다. 양 끝 원본 비트는 그대로 둔다.
            missing = int(round(gap / local_median)) - 1
            if missing > 0:
                step = gap / (missing + 1)
                base = float(beats[i])
                for k in range(1, missing + 1):
                    repaired.append(base + step * k)
                counts["inserted"] += missing
            repaired.append(float(beats[i + 1]))
        elif gap <= REPAIR_DUPLICATE_RATIO * local_median:
            # 중복 제거: 뒤쪽 비트를 결과에 넣지 않는다. 앞쪽 비트는 이미 들어가 있다.
            counts["dropped"] += 1
        else:
            repaired.append(float(beats[i + 1]))

    logger.info(
        "Beat grid repaired: inserted=%d, dropped=%d (in=%d, out=%d)",
        counts["inserted"],
        counts["dropped"],
        len(beats),
        len(repaired),
    )

    return np.asarray(repaired, dtype=float), counts


def _detect_with_madmom(
    audio_path: str,
) -> tuple[float, np.ndarray, float, dict[str, int]]:
    """madmom으로 BPM과 비트를 감지합니다.

    Args:
        audio_path: 오디오 파일 경로.

    Returns:
        (bpm, beats, confidence, repair_counts) 튜플.
        `repair_counts`는 국소 보정 건수이며, 드리프트 측정 스크립트가 자신의
        분류 건수와 대조하는 데 쓰입니다 (SPEC-BPM-003 spec.md 4.1절).
    """
    # RNN 기반 비트 활성화 함수 추출
    act = RNNBeatProcessor()(audio_path)

    # DBN(Dynamic Bayesian Network) 기반 비트 트래킹
    proc = DBNBeatTrackingProcessor(fps=100)
    beats = proc(act)

    if len(beats) < 2:
        return 0.0, beats, 0.0, {"inserted": 0, "dropped": 0}

    # 국소 보정 (누락 보간 / 중복 제거). 살아남은 원본 비트는 이동하지 않는다.
    beats, repair_counts = _repair_beats(beats)

    # BPM 계산 (중앙값 사용 - 이상치에 강건)
    intervals = np.diff(beats)
    bpm = 60.0 / np.median(intervals)

    # 신뢰도 계산 (보정 후 재계산)
    confidence = _calculate_confidence(beats)

    return bpm, beats, confidence, repair_counts


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
                # .get() 금지 — 구 스키마 캐시는 KeyError로 걸러 재분석을 유도한다
                engine=data["engine"],
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

    def _detect_with_madmom(
        self, audio_path: str
    ) -> tuple[float, np.ndarray, float, dict[str, int]]:
        """madmom으로 BPM 감지 (래퍼 메서드)."""
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
                bpm, beats, confidence, repair_counts = self._detect_with_madmom(
                    str(path)
                )
                algorithm = "madmom"
            elif _LIBROSA_AVAILABLE:
                bpm, beats, confidence = self._detect_with_librosa(str(path))
                algorithm = "librosa"
                # librosa 경로는 국소 보정을 거치지 않는다 — 0건이 사실이다.
                repair_counts = {"inserted": 0, "dropped": 0}
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
                engine=algorithm,
                repair_counts=repair_counts,
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
