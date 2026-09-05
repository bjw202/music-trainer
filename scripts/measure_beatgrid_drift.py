#!/usr/bin/env python
"""비트 그리드 드리프트 측정.

방출된 비트 그리드(`BpmService.analyze(path).beats`)가 감지기 원본 출력에서
얼마나 벗어났는지를 ms 단위로 잰다.

원본: `metronome-update-plan-docs/tools/measure_beatgrid_drift.py` (git untracked).
본 파일은 그 측정 코어의 포팅본이며, SPEC-BPM-003 REQ-BPM-005가 요구한
정규화 세 가지를 적용했다.

  (a) 리포지터리 루트를 스크립트 자신의 위치에서 유도한다 (환경 변수 불필요)
  (b) 특정 가상환경 인터프리터 경로를 문구에서 제거했다
  (c) 인덱스 정렬 차분을 최근접 대응 + 비트 분류로 일반화했다

사용법:

    <백엔드 런타임 인터프리터> scripts/measure_beatgrid_drift.py <audio-path> \\
        [--json] [--threshold-ms 1.0] [--no-cache] [--legacy-index-diff]

인터프리터는 madmom이 동작하는 백엔드 가상환경의 것을 쓴다. 다른 인터프리터로
돌리면 librosa 경로로 빠져 madmom 드리프트를 재지 못한다.

출력 스트림 규약: stdout은 측정 결과만 담는다. 진행 안내·캐시 안내·경고·오류는
전부 stderr로 나간다 (`--json` 모드의 stdout은 JSON 문서 하나뿐이다).

exit code:
    0  측정 성공, 감지기 유래 max_drift_ms ≤ threshold
    1  감지기 유래 max_drift_ms > threshold
    2  MATCH_TOLERANCE_MS > threshold_ms 불변식 위반 (측정하지 않음)
    3  스크립트 분류 건수 ≠ 서비스 보고 건수 (측정값은 출력함)
    4  입력 오류 또는 서비스가 보정 건수를 노출하지 않음 (측정하지 않음)
"""

from __future__ import annotations

import argparse
import bisect
import json
import sys
import tempfile
import warnings
from dataclasses import dataclass
from pathlib import Path

# 감지기 유래 비트로 인정할 최근접 거리 상한 (ms).
# 비트가 소수점 3자리로 반올림되므로 살아남은 원본 비트의 편차 상한은 0.5ms이며,
# 5.0ms는 그 10배다 — 반올림 오차는 흡수하고, 삽입 비트가 만드는 수백 ms 거리와는
# 두 자릿수 차이로 갈린다 (SPEC-BPM-003 REQ-BPM-005).
MATCH_TOLERANCE_MS = 5.0

# 기본 판정 임계 (ms).
DEFAULT_THRESHOLD_MS = 1.0

# 서비스가 보정 건수를 싣는 속성 이름. `_repair_beats`(M2)가 반환한
# {"inserted": int, "dropped": int}를 `BpmService.analyze` 결과가 그대로 노출한다.
SERVICE_REPAIR_ATTR = "repair_counts"

EXIT_OK = 0
EXIT_THRESHOLD_EXCEEDED = 1
EXIT_INVARIANT_VIOLATION = 2
EXIT_CROSS_CHECK_MISMATCH = 3
EXIT_INPUT_ERROR = 4


class MissingRepairCountsError(RuntimeError):
    """서비스가 보정 건수를 노출하지 않을 때 발생한다.

    0을 기본값으로 채우지 않는다 — 그러면 자기 대조가 아무것도 비교하지 않으면서
    통과하고, `max_drift_ms`가 무엇을 재고 있는지 알 수 없게 된다.
    """


@dataclass
class DriftInput:
    """측정에 필요한 입력 일체."""

    emitted: list[float]        # BpmService가 방출한 비트 그리드 (초)
    detector: list[float]       # 감지기 원본 비트, 보정 이전 (초)
    engine: str                 # "madmom" | "librosa"
    service_inserted: int | None  # 서비스가 보고한 삽입 건수
    service_dropped: int | None   # 서비스가 보고한 제거 건수


# ---------------------------------------------------------------------------
# 정규화 (a) — 리포지터리 루트 유도
# ---------------------------------------------------------------------------

def repo_root() -> Path:
    """스크립트 자신의 위치에서 리포지터리 루트를 유도한다.

    이 파일은 `<root>/scripts/` 아래에 있으므로 부모의 부모가 루트다.
    환경 변수에 의존하지 않는다.
    """
    return Path(__file__).resolve().parent.parent


def _ensure_backend_importable() -> None:
    """`app.services.bpm_service`를 import할 수 있도록 backend를 경로에 넣는다."""
    backend = repo_root() / "backend"
    if backend.is_dir() and str(backend) not in sys.path:
        sys.path.insert(0, str(backend))


# ---------------------------------------------------------------------------
# 불변식 방어 (N1)
# ---------------------------------------------------------------------------

def check_tolerance_invariant(
    threshold_ms: float, tolerance_ms: float = MATCH_TOLERANCE_MS
) -> None:
    """`MATCH_TOLERANCE_MS > threshold_ms`를 측정 전에 확인한다.

    성립하지 않으면 임계를 위반한 비트가 최근접 감지기 비트와 tolerance 안에서
    만나지 못해 전부 "삽입"으로 재분류되고 `max_drift_ms`에서 빠진다. 즉 기준을
    위반한 비트만 골라 지표에서 사라지게 만들 수 있다.
    """
    assert tolerance_ms > threshold_ms, (
        f"MATCH_TOLERANCE_MS({tolerance_ms}) must exceed threshold_ms({threshold_ms}): "
        "otherwise threshold-violating beats are reclassified as inserted and "
        "vanish from max_drift_ms"
    )


# ---------------------------------------------------------------------------
# 측정 코어
# ---------------------------------------------------------------------------

def _nearest_distance_ms(value: float, sorted_ref: list[float]) -> float:
    """`value`에서 가장 가까운 `sorted_ref` 원소까지의 절대 거리 (ms)."""
    if not sorted_ref:
        return float("inf")
    i = bisect.bisect_left(sorted_ref, value)
    best = float("inf")
    for j in (i - 1, i):
        if 0 <= j < len(sorted_ref):
            best = min(best, abs(value - sorted_ref[j]))
    return best * 1000.0


def measure_nearest_match(
    emitted: list[float],
    detector: list[float],
    tolerance_ms: float = MATCH_TOLERANCE_MS,
) -> dict:
    """최근접 대응으로 `emitted`를 분류하고 감지기 유래 비트만 통계 낸다.

    - 감지기 유래 비트: 최근접 `detector`와의 거리가 `tolerance_ms` 이내
    - 삽입 비트: 그 밖 — 건수로만 보고하고 드리프트 통계에서 제외한다
    - 제거된 비트: 최근접 `emitted`가 `tolerance_ms` 밖인 `detector` 원소
    """
    ref_emitted = sorted(emitted)
    ref_detector = sorted(detector)

    deviations: list[float] = []
    inserted_count = 0
    for beat in emitted:
        dist = _nearest_distance_ms(beat, ref_detector)
        if dist <= tolerance_ms:
            deviations.append(dist)
        else:
            inserted_count += 1

    dropped_count = sum(
        1
        for beat in detector
        if _nearest_distance_ms(beat, ref_emitted) > tolerance_ms
    )

    return {
        "max_drift_ms": max(deviations) if deviations else 0.0,
        "last_beat_drift_ms": deviations[-1] if deviations else 0.0,
        "mean_drift_ms": (sum(deviations) / len(deviations)) if deviations else 0.0,
        "beat_count": len(emitted),
        "matched_count": len(deviations),
        "inserted_count": inserted_count,
        "dropped_count": dropped_count,
    }


def measure_legacy_index_diff(emitted: list[float], detector: list[float]) -> dict:
    """원본의 계산 방식 — 인덱스 정렬 차분 (`emitted[i] - detector[i]`).

    원본은 비트 개수를 바꾸지 않는 변환만 다뤘으므로 이 계산이 성립했다.
    골든 픽스처 대조 전용이며 기본 경로가 아니다. 분류를 하지 않으므로
    분류 관련 항목은 `None`으로 보고한다.
    """
    if len(emitted) != len(detector):
        raise ValueError(
            "--legacy-index-diff requires equal beat counts: "
            f"emitted={len(emitted)} detector={len(detector)}"
        )
    devs = [abs(e - d) * 1000.0 for e, d in zip(emitted, detector)]
    return {
        "max_drift_ms": max(devs) if devs else 0.0,
        "last_beat_drift_ms": devs[-1] if devs else 0.0,
        "mean_drift_ms": (sum(devs) / len(devs)) if devs else 0.0,
        "beat_count": len(emitted),
        "matched_count": None,
        "inserted_count": None,
        "dropped_count": None,
    }


# ---------------------------------------------------------------------------
# 실제 측정 입력 수집 (기본 provider)
# ---------------------------------------------------------------------------

def read_service_repair_counts(result) -> tuple[int, int]:
    """서비스가 보고한 보정 건수를 읽는다.

    `_repair_beats`(SPEC-BPM-003 M2)가 반환한 건수를 `BpmService.analyze`의 결과가
    `SERVICE_REPAIR_ATTR`로 노출하면 이 경로가 그대로 켜진다. 그 전까지는 예외로
    중단한다 — 0을 채워 넣으면 자기 대조가 공허해지기 때문이다.
    """
    counts = getattr(result, SERVICE_REPAIR_ATTR, None)
    if counts is None:
        raise MissingRepairCountsError(
            f"BpmResult.{SERVICE_REPAIR_ATTR} 가 없다 — 서비스가 국소 보정 건수를 "
            "노출하지 않는다. SPEC-BPM-003 REQ-BPM-002의 _repair_beats 가 "
            '{"inserted": int, "dropped": int} 를 반환하고 BpmService.analyze 가 '
            f"이를 결과의 {SERVICE_REPAIR_ATTR} 로 실어야 자기 대조가 성립한다. "
            "건수를 0으로 가정하지 않는다 — 그러면 대조가 아무것도 비교하지 않는다."
        )
    try:
        return int(counts["inserted"]), int(counts["dropped"])
    except (TypeError, KeyError) as exc:
        raise MissingRepairCountsError(
            f"BpmResult.{SERVICE_REPAIR_ATTR} 의 형태가 "
            '{"inserted": int, "dropped": int} 가 아니다: ' + repr(counts)
        ) from exc


def collect_drift_input(
    audio_path: Path, *, use_cache: bool, need_repair_counts: bool
) -> DriftInput:
    """감지기 원본과 방출 그리드를 실제로 수집한다."""
    warnings.filterwarnings("ignore")
    _ensure_backend_importable()

    # bpm_service 모듈을 거쳐야 madmom 호환 shim이 적용된다.
    from app.services import bpm_service as svc  # type: ignore[import-not-found]

    if svc._MADMOM_AVAILABLE:
        engine = "madmom"
        print("  감지기 원본 획득 중 (madmom RNN + DBN)...", file=sys.stderr)
        act = svc.RNNBeatProcessor()(str(audio_path))
        detector = [float(b) for b in svc.DBNBeatTrackingProcessor(fps=100)(act)]
    elif svc._LIBROSA_AVAILABLE:
        engine = "librosa"
        print("  감지기 원본 획득 중 (librosa beat_track)...", file=sys.stderr)
        _, beats, _ = svc._detect_with_librosa(str(audio_path))
        detector = [float(b) for b in beats]
    else:
        raise RuntimeError("madmom·librosa 어느 쪽도 사용할 수 없어 측정할 수 없다.")

    if use_cache:
        service = svc.BpmService()
        print("  캐시를 사용한다 — 결과가 이전 실행으로 가려질 수 있다. "
              "--no-cache 로 우회한다.", file=sys.stderr)
        result = service.analyze(str(audio_path))
    else:
        with tempfile.TemporaryDirectory(prefix="drift-nocache-") as tmp:
            service = svc.BpmService(cache_dir=tmp)
            print("  캐시를 사용하지 않는다 (--no-cache).", file=sys.stderr)
            result = service.analyze(str(audio_path))

    service_inserted: int | None = None
    service_dropped: int | None = None
    if need_repair_counts:
        service_inserted, service_dropped = read_service_repair_counts(result)

    return DriftInput(
        emitted=[float(b) for b in result.beats],
        detector=detector,
        engine=getattr(result, "engine", engine),
        service_inserted=service_inserted,
        service_dropped=service_dropped,
    )


# ---------------------------------------------------------------------------
# 출력
# ---------------------------------------------------------------------------

def format_table(stats: dict, threshold_ms: float, legacy: bool) -> str:
    """사람이 읽는 표. stdout으로 나가는 유일한 내용이다."""
    def cell(key: str) -> str:
        value = stats[key]
        return "-" if value is None else str(value)

    mode = "인덱스 정렬 차분 (legacy)" if legacy else "최근접 대응 + 비트 분류"
    lines = [
        "=" * 60,
        f"비트 그리드 드리프트 — {stats['engine']} · {mode}",
        "=" * 60,
        f"  비트 수            : {stats['beat_count']}",
        f"  감지기 유래 비트   : {cell('matched_count')}",
        f"  삽입 비트          : {cell('inserted_count')}"
        f"  (서비스 보고: {cell('service_inserted')})",
        f"  제거 비트          : {cell('dropped_count')}"
        f"  (서비스 보고: {cell('service_dropped')})",
        f"  최대 이탈          : {stats['max_drift_ms']:.3f} ms",
        f"  마지막 비트 이탈   : {stats['last_beat_drift_ms']:.3f} ms",
        f"  평균 이탈          : {stats['mean_drift_ms']:.3f} ms",
        f"  임계               : {threshold_ms:.3f} ms",
        "=" * 60,
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="measure_beatgrid_drift.py",
        description="방출된 비트 그리드와 감지기 원본 출력 사이의 편차를 측정한다.",
    )
    parser.add_argument("audio_path", help="측정 대상 오디오 파일 경로")
    parser.add_argument("--json", action="store_true", help="기계 판독용 JSON을 stdout에 출력")
    parser.add_argument(
        "--threshold-ms",
        type=float,
        default=DEFAULT_THRESHOLD_MS,
        help=f"감지기 유래 max_drift_ms 판정 임계 (기본 {DEFAULT_THRESHOLD_MS})",
    )
    parser.add_argument("--no-cache", action="store_true", help="BPM 캐시를 사용하지 않는다")
    parser.add_argument(
        "--legacy-index-diff",
        action="store_true",
        help="원본 계산 방식(인덱스 정렬 차분)으로 측정한다. 골든 대조 전용.",
    )
    return parser


def main(argv: list[str] | None = None, provider=None) -> int:
    args = build_parser().parse_args(argv)
    provider = provider or collect_drift_input

    # 0. [HARD] 측정 전에 불변식을 확인한다. 위반이면 측정하지 않는다.
    try:
        check_tolerance_invariant(args.threshold_ms)
    except AssertionError as exc:
        print(f"불변식 위반: {exc}", file=sys.stderr)
        return EXIT_INVARIANT_VIOLATION

    audio_path = Path(args.audio_path)
    if not audio_path.is_file():
        print(f"오디오 파일을 찾을 수 없다: {audio_path}", file=sys.stderr)
        return EXIT_INPUT_ERROR

    try:
        data = provider(
            audio_path,
            use_cache=not args.no_cache,
            need_repair_counts=not args.legacy_index_diff,
        )
    except MissingRepairCountsError as exc:
        print(f"측정 중단: {exc}", file=sys.stderr)
        return EXIT_INPUT_ERROR
    except Exception as exc:  # noqa: BLE001 — CLI 경계에서 stderr로 보고한다
        print(f"측정 실패: {type(exc).__name__}: {exc}", file=sys.stderr)
        return EXIT_INPUT_ERROR

    try:
        if args.legacy_index_diff:
            stats = measure_legacy_index_diff(data.emitted, data.detector)
        else:
            stats = measure_nearest_match(data.emitted, data.detector)
    except ValueError as exc:
        print(f"측정 실패: {exc}", file=sys.stderr)
        return EXIT_INPUT_ERROR

    stats["engine"] = data.engine
    stats["service_inserted"] = data.service_inserted
    stats["service_dropped"] = data.service_dropped

    # 출력은 대조 실패 여부와 무관하게 먼저 낸다 (측정값은 보고한다).
    if args.json:
        print(json.dumps(stats, ensure_ascii=False))
    else:
        print(format_table(stats, args.threshold_ms, args.legacy_index_diff))

    # 4'. [HARD] 스크립트 분류 건수 ↔ 서비스 보고 건수 자기 대조.
    if not args.legacy_index_diff:
        mismatches = []
        if stats["inserted_count"] != stats["service_inserted"]:
            mismatches.append(
                f"inserted_count={stats['inserted_count']} != "
                f"service_inserted={stats['service_inserted']}"
            )
        if stats["dropped_count"] != stats["service_dropped"]:
            mismatches.append(
                f"dropped_count={stats['dropped_count']} != "
                f"service_dropped={stats['service_dropped']}"
            )
        if mismatches:
            print(
                "분류 대조 실패 — 스크립트가 분류한 집합과 서비스가 실제로 보정한 집합이 "
                "다르다. 이 상태에서는 max_drift_ms 가 무엇을 재고 있는지 알 수 없다: "
                + "; ".join(mismatches),
                file=sys.stderr,
            )
            return EXIT_CROSS_CHECK_MISMATCH

    if stats["max_drift_ms"] > args.threshold_ms:
        print(
            f"임계 초과: max_drift_ms={stats['max_drift_ms']:.3f} > "
            f"threshold_ms={args.threshold_ms:.3f}",
            file=sys.stderr,
        )
        return EXIT_THRESHOLD_EXCEEDED

    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
